const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'oekaki-earth.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS species (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pixels_json TEXT NOT NULL,
  status_json TEXT NOT NULL,
  features_json TEXT NOT NULL,
  narrative TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ecosystems (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS world_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  world_seed INTEGER NOT NULL,
  admin_panel_password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((row) => row.name);
if (!userColumns.includes('role')) {
  db.prepare("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'").run();
}

const worldSettings = db.prepare('SELECT id FROM world_settings WHERE id = 1').get();
if (!worldSettings) {
  const worldSeed = Math.floor(Date.now() % 2147483647);
  db.prepare('INSERT INTO world_settings (id, world_seed) VALUES (1, ?)').run(worldSeed);
}

const worldSettingsColumns = db.prepare('PRAGMA table_info(world_settings)').all().map((row) => row.name);
if (!worldSettingsColumns.includes('admin_panel_password_hash')) {
  db.prepare('ALTER TABLE world_settings ADD COLUMN admin_panel_password_hash TEXT').run();
}

module.exports = db;
