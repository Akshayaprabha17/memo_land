const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'memories.json');

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

function hashPin(pin, salt) {
  return crypto.pbkdf2Sync(pin, salt, 10000, 64, 'sha512').toString('hex');
}

function isPinValid(pin, memory) {
  if (!memory.locked || !memory.pinHash) return true;
  if (!pin) return false;
  const hash = hashPin(pin, memory.salt);
  return hash === memory.pinHash;
}

function stripSensitive(memory) {
  const m = { ...memory };
  if (m.locked) {
    m.content = '[LOCKED_CONTENT]';
  }
  delete m.pinHash;
  delete m.salt;
  return m;
}

// --- Per-Memory Security Endpoints ---

// Lock a specific memory
app.put('/api/memories/:id/lock', (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 characters.' });

  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });
  if (memories[index].locked) return res.status(400).json({ error: 'Memory is already locked.' });

  const salt = crypto.randomBytes(16).toString('hex');
  memories[index].salt = salt;
  memories[index].pinHash = hashPin(pin, salt);
  memories[index].locked = true;
  memories[index].updatedAt = new Date().toISOString();
  
  writeMemories(memories);
  res.json(stripSensitive(memories[index]));
});

// Permanently unlock a specific memory
app.put('/api/memories/:id/unlock', (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;
  
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });
  if (!memories[index].locked) return res.status(400).json({ error: 'Memory is not locked.' });

  if (!isPinValid(pin, memories[index])) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  memories[index].locked = false;
  delete memories[index].pinHash;
  delete memories[index].salt;
  memories[index].updatedAt = new Date().toISOString();
  
  writeMemories(memories);
  res.json(stripSensitive(memories[index]));
});

// Temporarily verify a PIN to view a memory (does not change locked state)
app.post('/api/memories/:id/verify', (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;
  
  const memories = readMemories();
  const memory = memories.find(m => m.id === id);
  if (!memory) return res.status(404).json({ error: 'Memory not found.' });
  
  if (memory.locked && !isPinValid(pin, memory)) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
  
  // Return the FULL memory including content, but strip hash/salt
  const m = { ...memory };
  delete m.pinHash;
  delete m.salt;
  res.json(m);
});

// --- Standard Memory Endpoints ---

// GET all memories
app.get('/api/memories', (req, res) => {
  let memories = readMemories();
  const { category } = req.query;

  if (category && category !== 'all') {
    memories = memories.filter(m => m.category === category);
  }

  memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(memories.map(stripSensitive));
});

// GET search memories
app.get('/api/memories/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const memories = readMemories();
  const query = q.toLowerCase();

  const results = memories.filter(m => {
    if (m.title.toLowerCase().includes(query)) return true;
    if (m.category.toLowerCase().includes(query)) return true;
    // Only search content if not locked
    if (!m.locked && m.content.toLowerCase().includes(query)) return true;
    return false;
  });

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results.map(stripSensitive));
});

// POST create a new memory
app.post('/api/memories', (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const memories = readMemories();
  const newMemory = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    category: category || 'personal',
    locked: false, // Must use /lock endpoint to lock it
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  memories.push(newMemory);
  writeMemories(memories);
  res.status(201).json(stripSensitive(newMemory));
});

// PUT update a memory (only title, content, category)
app.put('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });

  if (memories[index].locked) {
    return res.status(401).json({ error: 'Vault is locked. Cannot modify locked memory without unlocking first.' });
  }

  const { title, content, category } = req.body;
  if (title !== undefined) memories[index].title = title.trim();
  if (content !== undefined) memories[index].content = content.trim();
  if (category !== undefined) memories[index].category = category;

  memories[index].updatedAt = new Date().toISOString();
  writeMemories(memories);
  res.json(stripSensitive(memories[index]));
});

// DELETE a memory
app.delete('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  let memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });

  if (memories[index].locked) {
    return res.status(401).json({ error: 'Vault is locked. Cannot delete locked memory without unlocking first.' });
  }

  const deleted = memories.splice(index, 1)[0];
  writeMemories(memories);
  res.json(stripSensitive(deleted));
});

// Fallback: serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🔐 Memory Lock is running at http://localhost:${PORT}\n`);
});
