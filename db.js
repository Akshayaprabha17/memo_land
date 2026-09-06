const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    salt TEXT NOT NULL,
    avatar TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'personal',
    tags TEXT,
    image TEXT,
    locked INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    pinHash TEXT,
    salt TEXT,
    sortOrder INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shares (
    token TEXT PRIMARY KEY,
    memoryId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (memoryId) REFERENCES memories(id) ON DELETE CASCADE
  );
`);

/**
 * Helper to process base64 image and save to disk
 */
function saveBase64Image(imageStr) {
  if (!imageStr) return null;
  if (!imageStr.startsWith('data:image/')) return imageStr; // Already a URL/path

  try {
    const matches = imageStr.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) return imageStr;

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 image:', err);
    return null;
  }
}

/**
 * Migration helper from JSON files to SQLite
 */
function migrateFromJson() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    const usersFile = path.join(DATA_DIR, 'users.json');
    if (fs.existsSync(usersFile)) {
      try {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
        const insertUser = db.prepare(`
          INSERT OR IGNORE INTO users (id, username, email, passwordHash, salt, avatar, createdAt)
          VALUES (@id, @username, @email, @passwordHash, @salt, @avatar, @createdAt)
        `);
        const insertMany = db.transaction((userList) => {
          for (const u of userList) insertUser.run(u);
        });
        insertMany(users);
        console.log(`Migrated ${users.length} users from users.json to SQLite.`);
      } catch (err) {
        console.error('Error migrating users.json:', err);
      }
    }
  }

  const memoryCount = db.prepare('SELECT count(*) as count FROM memories').get().count;
  if (memoryCount === 0) {
    const memoriesFile = path.join(DATA_DIR, 'memories.json');
    if (fs.existsSync(memoriesFile)) {
      try {
        const memories = JSON.parse(fs.readFileSync(memoriesFile, 'utf-8'));
        const insertMemory = db.prepare(`
          INSERT OR IGNORE INTO memories (
            id, userId, title, content, category, tags, image, locked, pinned, pinHash, salt, sortOrder, createdAt, updatedAt
          ) VALUES (
            @id, @userId, @title, @content, @category, @tags, @image, @locked, @pinned, @pinHash, @salt, @sortOrder, @createdAt, @updatedAt
          )
        `);
        const insertMany = db.transaction((memList) => {
          for (const m of memList) {
            insertMemory.run({
              id: m.id,
              userId: m.userId || 'demo-user-id',
              title: m.title || '',
              content: m.content || '',
              category: m.category || 'personal',
              tags: JSON.stringify(m.tags || []),
              image: saveBase64Image(m.image),
              locked: m.locked ? 1 : 0,
              pinned: m.pinned ? 1 : 0,
              pinHash: m.pinHash || null,
              salt: m.salt || null,
              sortOrder: m.sortOrder ?? Date.now(),
              createdAt: m.createdAt || new Date().toISOString(),
              updatedAt: m.updatedAt || new Date().toISOString()
            });
          }
        });
        insertMany(memories);
        console.log(`Migrated ${memories.length} memories from memories.json to SQLite.`);
      } catch (err) {
        console.error('Error migrating memories.json:', err);
      }
    }
  }

  const sessionCount = db.prepare('SELECT count(*) as count FROM sessions').get().count;
  if (sessionCount === 0) {
    const sessionsFile = path.join(DATA_DIR, 'sessions.json');
    if (fs.existsSync(sessionsFile)) {
      try {
        const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
        const insertSession = db.prepare(`
          INSERT OR IGNORE INTO sessions (token, userId, createdAt, expiresAt)
          VALUES (@token, @userId, @createdAt, @expiresAt)
        `);
        const insertMany = db.transaction((sessionList) => {
          for (const s of sessionList) insertSession.run(s);
        });
        insertMany(sessions);
        console.log(`Migrated ${sessions.length} sessions from sessions.json to SQLite.`);
      } catch (err) {
        console.error('Error migrating sessions.json:', err);
      }
    }
  }

  const shareCount = db.prepare('SELECT count(*) as count FROM shares').get().count;
  if (shareCount === 0) {
    const sharesFile = path.join(DATA_DIR, 'shares.json');
    if (fs.existsSync(sharesFile)) {
      try {
        const shares = JSON.parse(fs.readFileSync(sharesFile, 'utf-8'));
        const insertShare = db.prepare(`
          INSERT OR IGNORE INTO shares (token, memoryId, expiresAt)
          VALUES (@token, @memoryId, @expiresAt)
        `);
        const insertMany = db.transaction((shareList) => {
          for (const s of shareList) insertShare.run(s);
        });
        insertMany(shares);
        console.log(`Migrated ${shares.length} shares from shares.json to SQLite.`);
      } catch (err) {
        console.error('Error migrating shares.json:', err);
      }
    }
  }
}

// Run migration
migrateFromJson();

// Format memory row back to JS object
function formatMemoryRow(row) {
  if (!row) return null;
  return {
    ...row,
    locked: Boolean(row.locked),
    pinned: Boolean(row.pinned),
    tags: row.tags ? JSON.parse(row.tags) : []
  };
}

module.exports = {
  db,
  saveBase64Image,

  // Users
  getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  },
  getUserByUsernameOrEmail(login) {
    const clean = login.trim().toLowerCase();
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(clean, clean) || null;
  },
  getAllUsers() {
    return db.prepare('SELECT * FROM users').all();
  },
  createUser(user) {
    db.prepare(`
      INSERT INTO users (id, username, email, passwordHash, salt, avatar, createdAt)
      VALUES (@id, @username, @email, @passwordHash, @salt, @avatar, @createdAt)
    `).run(user);
    return this.getUserById(user.id);
  },

  // Sessions
  getSession(token) {
    const now = Date.now();
    return db.prepare('SELECT * FROM sessions WHERE token = ? AND expiresAt > ?').get(token, now) || null;
  },
  createSession(session) {
    db.prepare(`
      INSERT INTO sessions (token, userId, createdAt, expiresAt)
      VALUES (@token, @userId, @createdAt, @expiresAt)
    `).run(session);
    return session;
  },
  deleteSession(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },
  pruneExpiredSessions() {
    const now = Date.now();
    const result = db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(now);
    return result.changes;
  },

  // Memories
  getAllMemories(userId) {
    const rows = db.prepare('SELECT * FROM memories WHERE userId = ?').all(userId);
    return rows.map(formatMemoryRow);
  },
  getMemoryById(id) {
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    return formatMemoryRow(row);
  },
  getUserMemoryById(id, userId) {
    const row = db.prepare('SELECT * FROM memories WHERE id = ? AND userId = ?').get(id, userId);
    return formatMemoryRow(row);
  },
  createMemory(memoryData) {
    const imagePath = saveBase64Image(memoryData.image);
    const tagsJson = JSON.stringify(memoryData.tags || []);
    db.prepare(`
      INSERT INTO memories (
        id, userId, title, content, category, tags, image, locked, pinned, pinHash, salt, sortOrder, createdAt, updatedAt
      ) VALUES (
        @id, @userId, @title, @content, @category, @tags, @image, @locked, @pinned, @pinHash, @salt, @sortOrder, @createdAt, @updatedAt
      )
    `).run({
      ...memoryData,
      image: imagePath,
      tags: tagsJson,
      locked: memoryData.locked ? 1 : 0,
      pinned: memoryData.pinned ? 1 : 0,
      pinHash: memoryData.pinHash || null,
      salt: memoryData.salt || null
    });
    return this.getMemoryById(memoryData.id);
  },
  updateMemory(id, userId, updateFields) {
    const memory = this.getUserMemoryById(id, userId);
    if (!memory) return null;

    let imagePath = memory.image;
    if (updateFields.image !== undefined) {
      imagePath = saveBase64Image(updateFields.image);
    }

    const updated = {
      title: updateFields.title !== undefined ? updateFields.title : memory.title,
      content: updateFields.content !== undefined ? updateFields.content : memory.content,
      category: updateFields.category !== undefined ? updateFields.category : memory.category,
      tags: Array.isArray(updateFields.tags) ? JSON.stringify(updateFields.tags) : JSON.stringify(memory.tags),
      image: imagePath,
      locked: updateFields.locked !== undefined ? (updateFields.locked ? 1 : 0) : (memory.locked ? 1 : 0),
      pinned: updateFields.pinned !== undefined ? (updateFields.pinned ? 1 : 0) : (memory.pinned ? 1 : 0),
      pinHash: updateFields.pinHash !== undefined ? updateFields.pinHash : memory.pinHash,
      salt: updateFields.salt !== undefined ? updateFields.salt : memory.salt,
      updatedAt: updateFields.updatedAt || new Date().toISOString()
    };

    db.prepare(`
      UPDATE memories SET
        title = @title,
        content = @content,
        category = @category,
        tags = @tags,
        image = @image,
        locked = @locked,
        pinned = @pinned,
        pinHash = @pinHash,
        salt = @salt,
        updatedAt = @updatedAt
      WHERE id = '${id}' AND userId = '${userId}'
    `).run(updated);

    return this.getMemoryById(id);
  },
  deleteMemory(id, userId) {
    const memory = this.getUserMemoryById(id, userId);
    if (!memory) return false;

    // Delete image file if it exists in /uploads/
    if (memory.image && memory.image.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', memory.image);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    const result = db.prepare('DELETE FROM memories WHERE id = ? AND userId = ?').run(id, userId);
    return result.changes > 0;
  },
  reorderMemories(orderArray, userId) {
    const updateStmt = db.prepare('UPDATE memories SET sortOrder = ? WHERE id = ? AND userId = ?');
    const updateMany = db.transaction((items) => {
      for (const { id, sortOrder } of items) {
        updateStmt.run(sortOrder, id, userId);
      }
    });
    updateMany(orderArray);
  },

  // Shares
  createShare(shareData) {
    db.prepare(`
      INSERT INTO shares (token, memoryId, expiresAt)
      VALUES (@token, @memoryId, @expiresAt)
    `).run(shareData);
    return shareData;
  },
  getActiveShare(token) {
    const now = new Date().toISOString();
    return db.prepare('SELECT * FROM shares WHERE token = ? AND expiresAt > ?').get(token, now) || null;
  },
  pruneShares() {
    const now = new Date().toISOString();
    db.prepare('DELETE FROM shares WHERE expiresAt <= ?').run(now);
  }
};
