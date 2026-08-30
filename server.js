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

// GET all memories — supports ?page, ?limit, ?sort, ?category, ?tag, ?date
app.get('/api/memories', (req, res) => {
  let memories = readMemories();
  const { category, tag, date, sort = 'newest', page = 1, limit = 12 } = req.query;

  if (category && category !== 'all') {
    memories = memories.filter(m => m.category === category);
  }
  if (tag) {
    memories = memories.filter(m => Array.isArray(m.tags) && m.tags.includes(tag));
  }
  if (date) {
    memories = memories.filter(m => m.createdAt.startsWith(date));
  }

  // Sort
  switch (sort) {
    case 'oldest':
      memories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'alpha-az':
      memories.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'alpha-za':
      memories.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'edited':
      memories.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      break;
    default: // newest
      memories.sort((a, b) => {
        const ao = a.sortOrder ?? new Date(a.createdAt).getTime();
        const bo = b.sortOrder ?? new Date(b.createdAt).getTime();
        return bo - ao;
      });
  }

  // Always float pinned memories to the very top, regardless of sort mode
  memories.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const total = memories.length;
  const start = (pageNum - 1) * limitNum;
  const paged = memories.slice(start, start + limitNum);

  res.json({
    data: paged.map(stripSensitive),
    total,
    page: pageNum,
    limit: limitNum,
    hasMore: start + limitNum < total
  });
});

// GET search memories — supports ?q, ?tag, ?date, ?sort, ?page, ?limit
app.get('/api/memories/search', (req, res) => {
  const { q, tag, date, sort = 'newest', page = 1, limit = 12 } = req.query;
  if (!q && !date) return res.json({ data: [], total: 0, page: 1, limit: 12, hasMore: false });

  let memories = readMemories();
  
  if (q) {
    const query = q.toLowerCase();
    memories = memories.filter(m => {
      if (m.title.toLowerCase().includes(query)) return true;
      if (m.category.toLowerCase().includes(query)) return true;
      if (!m.locked && m.content.toLowerCase().includes(query)) return true;
      if (Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(query))) return true;
      return false;
    });
  }

  if (tag) {
    memories = memories.filter(m => Array.isArray(m.tags) && m.tags.includes(tag));
  }
  if (date) {
    memories = memories.filter(m => m.createdAt.startsWith(date));
  }

  switch (sort) {
    case 'oldest': memories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'alpha-az': memories.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'alpha-za': memories.sort((a, b) => b.title.localeCompare(a.title)); break;
    case 'edited': memories.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); break;
    default: memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Always float pinned memories to the top
  memories.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const total = memories.length;
  const start = (pageNum - 1) * limitNum;
  const paged = memories.slice(start, start + limitNum);

  res.json({
    data: paged.map(stripSensitive),
    total,
    page: pageNum,
    limit: limitNum,
    hasMore: start + limitNum < total
  });
});

// GET all unique tags with usage counts
app.get('/api/tags', (req, res) => {
  const memories = readMemories();
  const tagMap = {};
  memories.forEach(m => {
    (m.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
  });
  const tags = Object.entries(tagMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  res.json(tags);
});

// GET stats summary
app.get('/api/stats', (req, res) => {
  const memories = readMemories();
  const total = memories.length;

  // Category breakdown
  const categories = {};
  memories.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1;
  });

  // Locked / pinned
  const locked = memories.filter(m => m.locked).length;
  const pinned = memories.filter(m => m.pinned).length;

  // Average content length (unlocked only, chars)
  const unlocked = memories.filter(m => !m.locked);
  const avgLength = unlocked.length
    ? Math.round(unlocked.reduce((sum, m) => sum + (m.content || '').length, 0) / unlocked.length)
    : 0;

  // This week count
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = memories.filter(m => new Date(m.createdAt) >= weekAgo).length;

  // Top 5 tags
  const tagMap = {};
  memories.forEach(m => {
    (m.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
  });
  const topTags = Object.entries(tagMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most active day (most memories created on a single date)
  const dayCounts = {};
  memories.forEach(m => {
    const d = m.createdAt.split('T')[0];
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  });
  const mostActiveDay = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])[0] || null;

  // Longest memory title
  const longestTitle = memories.reduce((best, m) =>
    m.title.length > (best ? best.title.length : 0) ? m : best, null);

  res.json({
    total,
    categories,
    locked,
    pinned,
    avgLength,
    thisWeek,
    topTags,
    mostActiveDay: mostActiveDay ? { date: mostActiveDay[0], count: mostActiveDay[1] } : null,
    longestTitle: longestTitle ? longestTitle.title : null
  });
});

// GET heatmap data (counts per day)
app.get('/api/heatmap', (req, res) => {
  const memories = readMemories();
  const counts = {};
  memories.forEach(m => {
    const date = m.createdAt.split('T')[0];
    counts[date] = (counts[date] || 0) + 1;
  });
  res.json(counts);
});

// POST create a new memory
app.post('/api/memories', (req, res) => {
  const { title, content, category, tags } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const memories = readMemories();
  const cleanTags = Array.isArray(tags)
    ? [...new Set(tags.map(t => t.trim().toLowerCase()).filter(t => t.length > 0))].slice(0, 10)
    : [];
  const newMemory = {
    id: uuidv4(),
    title: title.trim(),
    content: content.trim(),
    category: category || 'personal',
    tags: cleanTags,
    locked: false,
    pinned: false,
    sortOrder: Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  memories.push(newMemory);
  writeMemories(memories);
  res.status(201).json(stripSensitive(newMemory));
});

// PATCH toggle pin on a memory
app.patch('/api/memories/:id/pin', (req, res) => {
  const { id } = req.params;
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });
  memories[index].pinned = !memories[index].pinned;
  memories[index].updatedAt = new Date().toISOString();
  writeMemories(memories);
  res.json(stripSensitive(memories[index]));
});

// PUT reorder memories (accepts array of {id, sortOrder})
app.put('/api/memories/reorder', (req, res) => {
  const { order } = req.body; // [{id, sortOrder}, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array.' });
  const memories = readMemories();
  order.forEach(({ id, sortOrder }) => {
    const m = memories.find(m => m.id === id);
    if (m) m.sortOrder = sortOrder;
  });
  writeMemories(memories);
  res.json({ ok: true });
});

// PUT update a memory (title, content, category, tags)
app.put('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ error: 'Memory not found.' });

  if (memories[index].locked) {
    return res.status(401).json({ error: 'Vault is locked. Cannot modify locked memory without unlocking first.' });
  }

  const { title, content, category, tags } = req.body;
  if (title !== undefined) memories[index].title = title.trim();
  if (content !== undefined) memories[index].content = content.trim();
  if (category !== undefined) memories[index].category = category;
  if (Array.isArray(tags)) {
    memories[index].tags = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(t => t.length > 0))].slice(0, 10);
  }

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
