const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'memories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers
function readMemories() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (err) {
    return [];
  }
}

function writeMemories(memories) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(memories, null, 2), 'utf-8');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch (err) {
    return { pinHash: null, salt: null };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function hashPin(pin, salt) {
  return crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
}

function isPinValid(pin) {
  if (!pin) return false;
  const settings = readSettings();
  if (!settings.pinHash) return true; // No PIN set means everything is unlocked
  const hash = hashPin(pin, settings.salt);
  return hash === settings.pinHash;
}

// --- Security Endpoints ---

// Check if a PIN is set
app.get('/api/status', (req, res) => {
  const settings = readSettings();
  res.json({ isPinSet: !!settings.pinHash });
});

// Setup initial PIN
app.post('/api/setup', (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 characters.' });
  
  const settings = readSettings();
  if (settings.pinHash) return res.status(400).json({ error: 'PIN already set.' });

  const salt = crypto.randomBytes(16).toString('hex');
  settings.salt = salt;
  settings.pinHash = hashPin(pin, salt);
  writeSettings(settings);
  
  res.json({ success: true });
});

// Verify PIN
app.post('/api/verify', (req, res) => {
  const { pin } = req.body;
  if (isPinValid(pin)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

// --- Memory Endpoints ---

// GET all memories
app.get('/api/memories', (req, res) => {
  const clientPin = req.headers['x-vault-pin'];
  const unlocked = isPinValid(clientPin);
  
  let memories = readMemories();
  const { category } = req.query;
  
  if (category && category !== 'all') {
    memories = memories.filter(m => m.category === category);
  }
  
  // Sort by newest first
  memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Strip content for locked memories if not authenticated
  const safeMemories = memories.map(m => {
    if (m.locked && !unlocked) {
      return { ...m, content: '[LOCKED_CONTENT]' };
    }
    return m;
  });
  
  res.json(safeMemories);
});

// GET search memories
app.get('/api/memories/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  
  const clientPin = req.headers['x-vault-pin'];
  const unlocked = isPinValid(clientPin);
  
  const memories = readMemories();
  const query = q.toLowerCase();
  
  const results = memories.filter(m => {
    if (m.title.toLowerCase().includes(query)) return true;
    if (m.category.toLowerCase().includes(query)) return true;
    // Only search content if unlocked or memory is not locked
    if ((!m.locked || unlocked) && m.content.toLowerCase().includes(query)) return true;
    return false;
  });
  
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const safeResults = results.map(m => {
    if (m.locked && !unlocked) {
      return { ...m, content: '[LOCKED_CONTENT]' };
    }
    return m;
  });
  
  res.json(safeResults);
});

// POST create a new memory
app.post('/api/memories', (req, res) => {
  const { title, content, category, locked } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }
  
  // If creating as locked, must have a PIN set in the system
  if (locked) {
    const settings = readSettings();
    if (!settings.pinHash) {
      return res.status(400).json({ error: 'Cannot lock memory without setting a Vault PIN first.' });
    }
  }

  const memories = readMemories();
  const newMemory = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    category: category || 'personal',
    locked: !!locked,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  memories.push(newMemory);
  writeMemories(memories);
  res.status(201).json(newMemory);
});

// PUT update a memory
app.put('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  const clientPin = req.headers['x-vault-pin'];
  const unlocked = isPinValid(clientPin);
  
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });
  
  // If it's currently locked, require PIN to edit anything
  if (memories[index].locked && !unlocked) {
    return res.status(401).json({ error: 'Vault is locked. Cannot modify locked memory.' });
  }

  const { title, content, category, locked } = req.body;
  if (title !== undefined) memories[index].title = title.trim();
  if (content !== undefined) memories[index].content = content.trim();
  if (category !== undefined) memories[index].category = category;
  
  if (locked !== undefined) {
    if (locked) {
       const settings = readSettings();
       if (!settings.pinHash) return res.status(400).json({ error: 'Set a Vault PIN first.' });
    }
    memories[index].locked = locked;
  }
  
  memories[index].updatedAt = new Date().toISOString();
  writeMemories(memories);
  res.json(memories[index]);
});

// DELETE a memory
app.delete('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  const clientPin = req.headers['x-vault-pin'];
  const unlocked = isPinValid(clientPin);
  
  let memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });
  
  if (memories[index].locked && !unlocked) {
    return res.status(401).json({ error: 'Vault is locked. Cannot delete locked memory.' });
  }

  const deleted = memories.splice(index, 1)[0];
  writeMemories(memories);
  res.json(deleted);
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🔐 Memory Lock is running at http://localhost:${PORT}\n`);
});
