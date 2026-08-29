const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'memories.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Read memories from file
function readMemories() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Helper: Write memories to file
function writeMemories(memories) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(memories, null, 2), 'utf-8');
}

// GET all memories (with optional category filter)
app.get('/api/memories', (req, res) => {
  let memories = readMemories();
  const { category } = req.query;
  if (category && category !== 'all') {
    memories = memories.filter(m => m.category === category);
  }
  // Sort by newest first
  memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(memories);
});

// GET search memories
app.get('/api/memories/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const memories = readMemories();
  const query = q.toLowerCase();
  const results = memories.filter(m =>
    m.title.toLowerCase().includes(query) ||
    (!m.locked && m.content.toLowerCase().includes(query)) ||
    m.category.toLowerCase().includes(query)
  );
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(results);
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
    locked: false,
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
  const memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Memory not found.' });
  }
  const { title, content, category, locked } = req.body;
  if (title !== undefined) memories[index].title = title.trim();
  if (content !== undefined) memories[index].content = content.trim();
  if (category !== undefined) memories[index].category = category;
  if (locked !== undefined) memories[index].locked = locked;
  memories[index].updatedAt = new Date().toISOString();
  writeMemories(memories);
  res.json(memories[index]);
});

// DELETE a memory
app.delete('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  let memories = readMemories();
  const index = memories.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Memory not found.' });
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
