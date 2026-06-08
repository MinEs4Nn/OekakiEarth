require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const { analyzeAnimalWithLLM, nextEnvironmentWithLLM } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-this-secret';

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeColor(hex) {
  if (typeof hex !== 'string') return null;
  const value = hex.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(value)) return null;
  return value;
}

function extractDrawingFeatures(pixels) {
  const size = 32;
  const total = size * size;
  let filled = 0;
  let edgeContacts = 0;
  let transitions = 0;
  let verticalMatch = 0;
  let horizontalMatch = 0;
  const colorMap = new Map();

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      const color = normalizeColor(pixels[idx]);
      const isFilled = Boolean(color);
      if (isFilled) {
        filled += 1;
        colorMap.set(color, (colorMap.get(color) || 0) + 1);
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
          edgeContacts += 1;
        }
      }

      if (x < size - 1) {
        const right = normalizeColor(pixels[idx + 1]);
        if (Boolean(color) !== Boolean(right)) transitions += 1;
      }
      if (y < size - 1) {
        const down = normalizeColor(pixels[idx + size]);
        if (Boolean(color) !== Boolean(down)) transitions += 1;
      }

      const mirrorX = size - 1 - x;
      if (x < mirrorX) {
        const mirrorColor = normalizeColor(pixels[y * size + mirrorX]);
        if (Boolean(color) === Boolean(mirrorColor)) verticalMatch += 1;
      }

      const mirrorY = size - 1 - y;
      if (y < mirrorY) {
        const mirrorColor = normalizeColor(pixels[mirrorY * size + x]);
        if (Boolean(color) === Boolean(mirrorColor)) horizontalMatch += 1;
      }
    }
  }

  const dominantColor = [...colorMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '#95a5a6';
  const fillRatio = filled / total;
  const colorDiversity = clamp(colorMap.size / 8, 0, 1);
  const edgeRatio = filled === 0 ? 0 : edgeContacts / filled;
  const roughness = transitions / (size * (size - 1) * 2);
  const symmetry = clamp((verticalMatch + horizontalMatch) / (size * size), 0, 1);

  return {
    fillRatio,
    colorDiversity,
    edgeRatio,
    roughness,
    symmetry,
    dominantColor,
    filled
  };
}

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function issueAdminToken() {
  return jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '12h' });
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const adminToken = String(req.headers['x-admin-token'] || '').trim() || null;
  const token = adminToken || bearerToken;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.admin === true) {
      req.adminSession = true;
      return next();
    }

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function getWorldSeed() {
  const row = db.prepare('SELECT world_seed FROM world_settings WHERE id = 1').get();
  return Number(row?.world_seed) || 1;
}

function getAdminPasswordRecord() {
  return db.prepare('SELECT admin_panel_password_hash FROM world_settings WHERE id = 1').get();
}

function getDefaultAdminPassword() {
  return String(process.env.ADMIN_PANEL_PASSWORD || process.env.ADMIN_PASSWORD || 'admin').trim();
}

function verifyAdminPassword(password) {
  const record = getAdminPasswordRecord();
  if (record?.admin_panel_password_hash) {
    return bcrypt.compareSync(password, record.admin_panel_password_hash);
  }
  return password === getDefaultAdminPassword();
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'oekaki-earth', llm: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username >= 3 chars, password >= 6 chars required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const adminName = String(process.env.ADMIN_USERNAME || 'admin').trim();
  const role = username === adminName ? 'admin' : 'user';
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
  const user = { id: result.lastInsertRowid, username, role };
  return res.json({ token: issueToken(user), user });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  return res.json({ token: issueToken(user), user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.get('/api/world/config', (_, res) => {
  res.json({ worldSeed: getWorldSeed() });
});

app.post('/api/admin/unlock', (req, res) => {
  const password = String(req.body?.password || '').trim();
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  res.json({ adminToken: issueAdminToken() });
});

app.post('/api/admin/password', adminRequired, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();
  const confirmPassword = String(req.body?.confirmPassword || '').trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }

  if (!verifyAdminPassword(currentPassword)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE world_settings SET admin_panel_password_hash = ?, updated_at = datetime(\'now\') WHERE id = 1').run(passwordHash);
  res.json({ ok: true });
});

app.post('/api/analyze-animal', authRequired, async (req, res) => {
  const { name, pixels } = req.body || {};
  if (!name || !Array.isArray(pixels) || pixels.length !== 1024) {
    return res.status(400).json({ error: 'Invalid payload. name and 32x32 pixels are required.' });
  }

  const features = extractDrawingFeatures(pixels);
  if (features.filled < 8) {
    return res.status(400).json({ error: 'Drawing is too empty. Please draw at least a small creature.' });
  }

  const existingRows = db.prepare('SELECT name, status_json FROM species ORDER BY created_at DESC LIMIT 240').all();
  const existingAbilityTexts = [];
  const existingNames = [];
  const existingAbilityTags = [];
  for (const row of existingRows) {
    if (typeof row?.name === 'string' && row.name.trim()) {
      existingNames.push(row.name.trim());
    }
    try {
      const status = JSON.parse(row?.status_json || '{}');
      if (typeof status?.uniqueAbility === 'string' && status.uniqueAbility.trim()) {
        existingAbilityTexts.push(status.uniqueAbility.trim());
      }
      if (typeof status?.abilityTag === 'string' && status.abilityTag.trim()) {
        existingAbilityTags.push(status.abilityTag.trim());
      }
    } catch {
      // ignore broken historical rows
    }
  }

  const llm = await analyzeAnimalWithLLM({ name, features, existingAbilityTexts, existingNames, existingAbilityTags });
  const speciesId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO species (id, owner_user_id, name, pixels_json, status_json, features_json, narrative)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    speciesId,
    req.user.id,
    name,
    JSON.stringify(pixels),
    JSON.stringify(llm.status),
    JSON.stringify(features),
    llm.narrative
  );

  return res.json({
    id: speciesId,
    status: llm.status,
    features,
    narrative: llm.narrative
  });
});

app.post('/api/ai-ecosystem-step', authRequired, async (req, res) => {
  const next = await nextEnvironmentWithLLM(req.body || {});
  const materials = Array.isArray(next?.materials) ? next.materials : [];
  const environment = {
    temperature: Number(next?.temperature ?? 20),
    vegetation: Number(next?.vegetation ?? 55),
    water: Number(next?.water ?? 60),
    danger: Number(next?.danger ?? 30),
    event: String(next?.event || 'stable'),
    eventText: String(next?.eventText || 'AI adjusted conditions.')
  };
  return res.json({ environment, materials });
});

app.post('/api/ecosystems', authRequired, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const snapshot = req.body?.snapshot;
  const isPublic = req.body?.isPublic !== false;
  if (!title || !snapshot) {
    return res.status(400).json({ error: 'title and snapshot are required.' });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO ecosystems (id, owner_user_id, title, snapshot_json, is_public)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, title, JSON.stringify(snapshot), isPublic ? 1 : 0);

  return res.json({ id });
});

app.get('/api/ecosystems/public', (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.title, e.created_at, u.username AS owner
    FROM ecosystems e
    JOIN users u ON u.id = e.owner_user_id
    WHERE e.is_public = 1
    ORDER BY e.created_at DESC
    LIMIT 60
  `).all();
  res.json({ items: rows });
});

app.get('/api/ecosystems/:id', (req, res) => {
  const row = db.prepare(`
    SELECT e.id, e.title, e.created_at, e.snapshot_json, e.is_public, u.username AS owner
    FROM ecosystems e
    JOIN users u ON u.id = e.owner_user_id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Not found' });

  res.json({
    id: row.id,
    title: row.title,
    owner: row.owner,
    createdAt: row.created_at,
    isPublic: Boolean(row.is_public),
    snapshot: JSON.parse(row.snapshot_json)
  });
});

app.get('/api/my/species', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, pixels_json, status_json, features_json, narrative, created_at
    FROM species
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(req.user.id);

  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    pixels: JSON.parse(row.pixels_json),
    status: JSON.parse(row.status_json),
    features: JSON.parse(row.features_json),
    narrative: row.narrative,
    createdAt: row.created_at
  }));

  res.json({ items });
});

app.get('/api/admin/users', adminRequired, (_, res) => {
  const rows = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.role,
      u.created_at,
      COUNT(DISTINCT s.id) AS species_count,
      COUNT(DISTINCT e.id) AS ecosystem_count
    FROM users u
    LEFT JOIN species s ON s.owner_user_id = u.id
    LEFT JOIN ecosystems e ON e.owner_user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `).all();
  res.json({ items: rows });
});

app.get('/api/admin/species', adminRequired, (_, res) => {
  const rows = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.created_at,
      u.username AS owner,
      s.narrative
    FROM species s
    JOIN users u ON u.id = s.owner_user_id
    ORDER BY s.created_at DESC
    LIMIT 200
  `).all();
  res.json({ items: rows });
});

app.get('/api/admin/ecosystems', adminRequired, (_, res) => {
  const rows = db.prepare(`
    SELECT
      e.id,
      e.title,
      e.created_at,
      e.is_public,
      u.username AS owner
    FROM ecosystems e
    JOIN users u ON u.id = e.owner_user_id
    ORDER BY e.created_at DESC
    LIMIT 200
  `).all();
  res.json({ items: rows });
});

app.patch('/api/admin/users/:id/role', adminRequired, (req, res) => {
  const role = String(req.body?.role || '').trim();
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id.' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ ok: true });
});

app.delete('/api/admin/ecosystems/:id', adminRequired, (req, res) => {
  const result = db.prepare('DELETE FROM ecosystems WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/admin/species/:id', adminRequired, (req, res) => {
  const result = db.prepare('DELETE FROM species WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.post('/api/admin/world/regenerate', adminRequired, (req, res) => {
  const worldSeed = Math.floor((Date.now() + Math.random() * 1000000) % 2147483647);
  db.prepare('UPDATE world_settings SET world_seed = ?, updated_at = datetime(\'now\') WHERE id = 1').run(worldSeed);
  res.json({ ok: true, worldSeed });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(port, retries = 8) {
  const server = app.listen(port, () => {
    console.log(`OekakiEarth is running on http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && retries > 0) {
      const nextPort = Number(port) + 1;
      console.log(`Port ${port} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort, retries - 1);
      return;
    }

    throw error;
  });
}

startServer(Number(PORT), 8);
