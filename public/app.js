const spriteCanvas = document.getElementById('spriteCanvas');
const spriteCtx = spriteCanvas.getContext('2d', { willReadFrequently: true });
const editorCanvas = document.getElementById('editorCanvas');
const editorCtx = editorCanvas.getContext('2d');
const worldCanvas = document.getElementById('worldCanvas');
const worldCtx = worldCanvas.getContext('2d');

const colorPicker = document.getElementById('colorPicker');
const paletteEl = document.getElementById('palette');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const fillBtn = document.getElementById('fillBtn');
const clearBtn = document.getElementById('clearBtn');
const spawnBtn = document.getElementById('spawnBtn');
const saveWorldBtn = document.getElementById('saveWorldBtn');
const animalNameInput = document.getElementById('animalName');
const messageEl = document.getElementById('message');
const speciesListEl = document.getElementById('speciesList');
const extinctListEl = document.getElementById('extinctList');
const envGridEl = document.getElementById('envGrid');
const eventLogEl = document.getElementById('eventLog');
const tickLabel = document.getElementById('tickLabel');
const populationLabel = document.getElementById('populationLabel');
const toggleSimBtn = document.getElementById('toggleSimBtn');
const zoomLabel = document.getElementById('zoomLabel');
const resetViewBtn = document.getElementById('resetViewBtn');
const galleryListEl = document.getElementById('galleryList');
const refreshGalleryBtn = document.getElementById('refreshGalleryBtn');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authStatusEl = document.getElementById('authStatus');
const adminUnlockModalEl = document.getElementById('adminUnlockModal');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const unlockAdminBtn = document.getElementById('unlockAdminBtn');
const closeAdminUnlockBtn = document.getElementById('closeAdminUnlockBtn');
const adminUnlockMessageEl = document.getElementById('adminUnlockMessage');
const adminPanelEl = document.getElementById('adminPanel');
const adminSummaryEl = document.getElementById('adminSummary');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const refreshAdminBtn = document.getElementById('refreshAdminBtn');
const regenerateWorldBtn = document.getElementById('regenerateWorldBtn');
const adminCurrentPasswordInput = document.getElementById('adminCurrentPasswordInput');
const adminNewPasswordInput = document.getElementById('adminNewPasswordInput');
const adminConfirmPasswordInput = document.getElementById('adminConfirmPasswordInput');
const changeAdminPasswordBtn = document.getElementById('changeAdminPasswordBtn');
const adminPasswordMessageEl = document.getElementById('adminPasswordMessage');
const adminUsersListEl = document.getElementById('adminUsersList');
const adminSpeciesListEl = document.getElementById('adminSpeciesList');
const adminEcosystemsListEl = document.getElementById('adminEcosystemsList');

const DRAW_SIZE = 32;
const EDITOR_SIZE = 512;
const PIXEL_SCALE = EDITOR_SIZE / DRAW_SIZE;
const WORLD_COLS = 1000;
const WORLD_ROWS = 100;
const CELL = 5;
const WORLD_WIDTH = WORLD_COLS * CELL;
const WORLD_HEIGHT = WORLD_ROWS * CELL;
const MAX_ENTITIES = 420;
const ENTITY_RENDER_SCALE = 5;
const TICK_INTERVAL_MS = 3200;
const ENTITY_LIFESPAN_TICKS = Math.floor((24 * 60 * 60 * 1000) / TICK_INTERVAL_MS);
const PALETTE = ['#ffcf5a', '#ff8a80', '#7fffd4', '#7ab6ff', '#ffffff', '#0d1f2a', '#84f070', '#f7a5ff'];
let worldConfig = { worldSeed: 1 };

editorCtx.imageSmoothingEnabled = false;
worldCtx.imageSmoothingEnabled = false;

const drawingPixels = new Array(DRAW_SIZE * DRAW_SIZE).fill(null);
let tool = 'pen';
let mouseDown = false;
let authToken = localStorage.getItem('oekaki_token') || '';
let adminSessionToken = '';
let currentUser = null;
const camera = {
  zoom: 1,
  minZoom: 0.7,
  maxZoom: 10,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  lastX: 0,
  lastY: 0
};

const appState = {
  tick: 0,
  running: true,
  species: [],
  entities: [],
  environment: {
    temperature: 20,
    vegetation: 56,
    water: 60,
    danger: 28,
    event: 'stable',
    eventText: 'Simulation initialized.'
  },
  terrain: generateTerrain(worldConfig),
  terrainSettleTicks: 6,
  clouds: generateClouds(),
  effects: [],
  materials: [],
  extinctSpecies: []
};
const collapsedSpeciesTabs = new Set();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getTokenHeader() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function logEvent(text) {
  const row = document.createElement('div');
  row.className = 'log-item';
  row.textContent = `[t${appState.tick}] ${text}`;
  eventLogEl.prepend(row);
  while (eventLogEl.children.length > 64) {
    eventLogEl.removeChild(eventLogEl.lastChild);
  }
}

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? 'var(--warn)' : '#fff6cf';
}

function setAuthStatus(text, isError = false) {
  authStatusEl.textContent = text;
  authStatusEl.style.color = isError ? 'var(--warn)' : '#fff6cf';
}

function setAdminUnlockMessage(text, isError = false) {
  adminUnlockMessageEl.textContent = text;
  adminUnlockMessageEl.style.color = isError ? 'var(--warn)' : '#fff6cf';
}

function setAdminPasswordMessage(text, isError = false) {
  adminPasswordMessageEl.textContent = text;
  adminPasswordMessageEl.style.color = isError ? 'var(--warn)' : '#fff6cf';
}

function openAdminUnlockModal() {
  adminPasswordInput.value = '';
  adminUnlockModalEl.hidden = false;
  adminPasswordInput.focus();
}

function closeAdminUnlockModal() {
  adminUnlockModalEl.hidden = true;
  adminPasswordInput.value = '';
  setAdminUnlockMessage('');
}

function clearAdminSession() {
  adminSessionToken = '';
  syncAdminPanel();
}

function syncAdminPanel() {
  const isAdmin = Boolean(adminSessionToken);
  adminPanelEl.hidden = !isAdmin;
  if (!isAdmin) {
    adminSummaryEl.innerHTML = '';
    adminUsersListEl.innerHTML = '';
    adminSpeciesListEl.innerHTML = '';
    adminEcosystemsListEl.innerHTML = '';
  }
}

function setAuthenticatedUser(user) {
  currentUser = user;
  const roleLabel = user.role === 'admin' ? '管理者' : '一般';
  setAuthStatus(`ログイン中: ${user.username} / ${roleLabel}`);
  syncAdminPanel();
}

function renderAdminUsers(items) {
  adminUsersListEl.innerHTML = '';
  for (const user of items) {
    const card = document.createElement('div');
    card.className = 'admin-user';

    const top = document.createElement('div');
    top.className = 'admin-user-top';
    top.innerHTML = `<b>${user.username}</b><span class="role-pill">${user.role}</span>`;

    const meta = document.createElement('div');
    meta.className = 'admin-user-meta';
    meta.textContent = `ID ${user.id} / ${user.created_at} / species ${user.species_count} / ecosystems ${user.ecosystem_count}`;

    const actions = document.createElement('div');
    actions.className = 'admin-user-actions';
    const promote = document.createElement('button');
    promote.textContent = user.role === 'admin' ? '一般に戻す' : '管理者にする';
    if (currentUser && currentUser.id === user.id) {
      promote.disabled = true;
      promote.textContent = '自分の権限は変更不可';
    }
    promote.addEventListener('click', () => updateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin'));
    actions.appendChild(promote);

    card.append(top, meta, actions);
    adminUsersListEl.appendChild(card);
  }
}

async function loadAdminUsers() {
  try {
    const data = await api('/api/admin/users', { method: 'GET', headers: {}, adminAuth: true });
    adminSummaryEl.innerHTML = `<span>ユーザー数: ${data.items.length}</span><span>世界シード: ${worldConfig.worldSeed || 1}</span><span>世界はサーバーの単一シードで共有されています</span>`;
    renderAdminUsers(data.items);
  } catch (error) {
    if (String(error.message).toLowerCase().includes('token') || String(error.message).includes('Unauthorized')) clearAdminSession();
    adminSummaryEl.textContent = error.message;
  }
}

function renderAdminSpecies(items) {
  adminSpeciesListEl.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'admin-user';
    card.innerHTML = `
      <div class="admin-user-top"><b>${item.name}</b><span class="role-pill">種</span></div>
      <div class="admin-user-meta">owner ${item.owner} / ${item.created_at}</div>
      <div class="admin-user-meta">${item.narrative || ''}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'admin-user-actions';
    const del = document.createElement('button');
    del.textContent = '削除';
    del.addEventListener('click', async () => {
      if (!confirm(`種「${item.name}」を削除しますか？`)) return;
      await deleteAdminItem(`/api/admin/species/${item.id}`);
    });
    actions.appendChild(del);
    card.appendChild(actions);

    adminSpeciesListEl.appendChild(card);
  }
}

function renderAdminEcosystems(items) {
  adminEcosystemsListEl.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'admin-user';
    card.innerHTML = `
      <div class="admin-user-top"><b>${item.title}</b><span class="role-pill">${item.is_public ? '公開' : '非公開'}</span></div>
      <div class="admin-user-meta">owner ${item.owner} / ${item.created_at}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'admin-user-actions';
    const del = document.createElement('button');
    del.textContent = '削除';
    del.addEventListener('click', async () => {
      if (!confirm(`生態系「${item.title}」を削除しますか？`)) return;
      await deleteAdminItem(`/api/admin/ecosystems/${item.id}`);
    });
    actions.appendChild(del);
    card.appendChild(actions);

    adminEcosystemsListEl.appendChild(card);
  }
}

async function deleteAdminItem(path) {
  try {
    await api(path, { method: 'DELETE', adminAuth: true });
    await loadAdminDashboard();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function loadAdminDashboard() {
  if (!adminSessionToken) return;
  try {
    const [users, species, ecosystems] = await Promise.all([
      api('/api/admin/users', { method: 'GET', headers: {}, adminAuth: true }),
      api('/api/admin/species', { method: 'GET', headers: {}, adminAuth: true }),
      api('/api/admin/ecosystems', { method: 'GET', headers: {}, adminAuth: true })
    ]);
    adminSummaryEl.innerHTML = `<span>ユーザー数: ${users.items.length}</span><span>世界シード: ${worldConfig.worldSeed || 1}</span><span>世界はサーバーの単一シードで共有されています</span>`;
    renderAdminUsers(users.items);
    renderAdminSpecies(species.items);
    renderAdminEcosystems(ecosystems.items);
    syncAdminPanel();
  } catch (error) {
    if (String(error.message).toLowerCase().includes('token') || String(error.message).includes('Unauthorized')) clearAdminSession();
    adminSummaryEl.textContent = error.message;
  }
}

async function updateUserRole(id, role) {
  try {
    await api(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      adminAuth: true
    });
    await loadAdminDashboard();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function regenerateWorldSeed() {
  try {
    const data = await api('/api/admin/world/regenerate', { method: 'POST', adminAuth: true });
    await loadWorldConfig();
    await loadAdminDashboard();
    logEvent(`世界シードを再生成: ${data.worldSeed}`);
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function changeAdminPassword() {
  try {
    const currentPassword = adminCurrentPasswordInput.value.trim();
    const newPassword = adminNewPasswordInput.value.trim();
    const confirmPassword = adminConfirmPasswordInput.value.trim();

    await api('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      adminAuth: true
    });

    adminCurrentPasswordInput.value = '';
    adminNewPasswordInput.value = '';
    adminConfirmPasswordInput.value = '';
    setAdminPasswordMessage('管理者パスワードを変更しました。');
    logEvent('管理者パスワードを更新');
  } catch (error) {
    setAdminPasswordMessage(error.message, true);
  }
}

async function unlockAdminPanel() {
  try {
    const password = adminPasswordInput.value.trim();
    const data = await api('/api/admin/unlock', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    adminSessionToken = data.adminToken;
    closeAdminUnlockModal();
    syncAdminPanel();
    await loadAdminDashboard();
    setAdminUnlockMessage('');
  } catch (error) {
    setAdminUnlockMessage(error.message, true);
  }
}

function applyWorldConfig(config) {
  worldConfig = config || worldConfig;
  appState.terrain = generateTerrain(worldConfig);
  appState.terrainSettleTicks = 6;
  drawWorld();
}

async function loadWorldConfig() {
  try {
    const data = await api('/api/world/config', { method: 'GET', headers: {} });
    applyWorldConfig(data);
  } catch {
    applyWorldConfig(worldConfig);
  }
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getTokenHeader(),
    ...(options.headers || {})
  };

  if (options.adminAuth && adminSessionToken) {
    headers['X-Admin-Token'] = adminSessionToken;
  }

  const res = await fetch(path, {
    ...options,
    headers
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || 'API error');
  }
  return payload;
}

function buildPalette() {
  paletteEl.innerHTML = '';
  for (const color of PALETTE) {
    const button = document.createElement('button');
    button.className = 'swatch';
    button.style.background = color;
    if (color.toLowerCase() === colorPicker.value.toLowerCase()) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => {
      colorPicker.value = color;
      for (const c of paletteEl.children) c.classList.remove('active');
      button.classList.add('active');
    });
    paletteEl.appendChild(button);
  }
}

function habitatLabel(habitat) {
  if (Array.isArray(habitat)) {
    return habitat.map((item) => habitatLabel(item)).join(' / ');
  }
  const labels = {
    land: '陸',
    forest: '森',
    grass: '草原',
    shore: '水辺',
    swamp: '湿地',
    sky: '空',
    water: '水',
    soil: '土中',
    rock: '岩場',
    mountain: '山',
    cave: '洞窟',
    underground: '地中'
  };
  return labels[habitat] || '陸';
}

function generateTerrain(config = {}) {
  const seed = Number(config.worldSeed || config.seed || 1);
  const cells = [];
  const seaLevel = Math.floor(WORLD_ROWS * 0.62);
  const waterLevelByX = [];
  const waterBedByX = [];
  const undergroundSpringByX = [];
  const surfaceByX = [];
  const caveSystems = [
    { depth: 13, amp: 4.5, freq: 0.012, phase: seed * 0.004 + 0.3, wobble: 1.4, thickness: 3.2 },
    { depth: 23, amp: 6.8, freq: 0.017, phase: seed * 0.007 + 1.7, wobble: 2.2, thickness: 3.0 },
    { depth: 34, amp: 8.4, freq: 0.009, phase: seed * 0.011 + 3.1, wobble: 2.8, thickness: 3.6 }
  ];

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function seedNoise(x, y = 0, salt = 0) {
    const n = Math.sin(seed * 0.013 + x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453123;
    return n - Math.floor(n);
  }

  function surfaceNoise(x) {
    return Math.sin(x * 0.021 + seed * 0.002) * 4.4 + Math.sin(x * 0.057 + seed * 0.01 + 1.3) * 2.5 + Math.sin(x * 0.11 + seed * 0.005 + 3.2) * 1.2;
  }

  for (let x = 0; x < WORLD_COLS; x += 1) {
    const progress = x / (WORLD_COLS - 1);
    const mountainWeight = 1 - smoothstep(0.06, 0.32, progress);
    const forestWeight = smoothstep(0.08, 0.40, progress) * (1 - smoothstep(0.28, 0.52, progress));
    const grassWeight = smoothstep(0.18, 0.68, progress) * (1 - smoothstep(0.58, 0.82, progress));
    const shoreWeight = smoothstep(0.46, 0.88, progress) * (1 - smoothstep(0.76, 0.98, progress));
    const waterWeight = smoothstep(0.68, 1.00, progress);
    const totalWeight = mountainWeight + forestWeight + grassWeight + shoreWeight + waterWeight;
    const surfaceBase = (
      mountainWeight * 28 +
      forestWeight * 35 +
      grassWeight * 41 +
      shoreWeight * 45 +
      waterWeight * 47
    ) / Math.max(totalWeight, 0.001);

    surfaceByX.push(clamp(Math.floor(surfaceBase + surfaceNoise(x)), 16, 68));
    const shorelineDip = Math.sin(x * 0.014 + seed * 0.005) * 2 + Math.sin(x * 0.031 + seed * 0.01 + 0.7) * 1.2;
    const pondNoise = seedNoise(x, 0, 93);
    const waterfallNoise = seedNoise(x, 0, 94);
    const undergroundSpringNoise = seedNoise(x, 0, 95);
    const baseWaterLevel = clamp(Math.floor(seaLevel + shorelineDip), 56, 74);
    const pondDepth = pondNoise > 0.84 ? Math.floor(2 + pondNoise * 3) : 0;
    const waterfallLift = waterfallNoise > 0.92 ? Math.floor(3 + waterfallNoise * 5) : 0;
    const waterLevel = clamp(baseWaterLevel - pondDepth + waterfallLift, 54, 76);
    const waterBed = clamp(waterLevel + 1 + Math.floor(seedNoise(x, 0, 96) * 2), 58, 84);

    waterLevelByX.push(waterLevel);
    waterBedByX.push(waterBed);
    undergroundSpringByX.push(undergroundSpringNoise);
  }

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const surface = surfaceByX[x];
      const waterLevel = waterLevelByX[x];
      const waterBed = waterBedByX[x];
      const undergroundSpringNoise = undergroundSpringByX[x];
      const zone = x / WORLD_COLS;
      const zoneMix = [
        { name: 'mountain', weight: 1 - smoothstep(0.02, 0.18, zone) },
        { name: 'forest', weight: smoothstep(0.08, 0.34, zone) * (1 - smoothstep(0.30, 0.46, zone)) },
        { name: 'grass', weight: smoothstep(0.24, 0.60, zone) * (1 - smoothstep(0.54, 0.74, zone)) },
        { name: 'shore', weight: smoothstep(0.50, 0.82, zone) * (1 - smoothstep(0.76, 0.92, zone)) },
        { name: 'water', weight: smoothstep(0.72, 0.98, zone) }
      ].sort((a, b) => b.weight - a.weight);
      const primary = zoneMix[0].name;
      const secondary = zoneMix[1].name;
      const transition = zoneMix[1].weight > 0.22 && zoneMix[1].weight / Math.max(zoneMix[0].weight, 0.001) > 0.45;
      const caveNoise = seedNoise(x, y, 11) + seedNoise(x, y, 23) + seedNoise(x, y, 37) + seedNoise(x, y, 71);
      const caveCenters = caveSystems.map((system) => (
        surface
        + system.depth
        + Math.sin(x * system.freq + system.phase) * system.amp
        + Math.sin(x * system.freq * 2.5 + system.phase * 0.6) * system.wobble
      ));
      const caveDistances = caveCenters.map((center) => Math.abs(y - center));
      const caveDistance = Math.min(...caveDistances);
      const caveCrossing = caveCenters.some((center, index) => {
        const neighbor = caveCenters[(index + 1) % caveCenters.length];
        return Math.abs(center - neighbor) < 4.2;
      });
      const shaftSeed = seedNoise(x, 0, 89);
      const shaftCenter = surface + 18 + Math.sin(x * 0.051 + seed * 0.017) * 5.5;
      const shaftCenter2 = surface + 28 + Math.sin(x * 0.027 + seed * 0.023 + 1.4) * 6.0;
      const caveShaft = shaftSeed > 0.944 && y > surface + 6 && y < waterLevel + 24 && (Math.abs(y - shaftCenter) < 3.8 || Math.abs(y - shaftCenter2) < 3.2);
      const caveDepth = y - surface;
      const underwaterCaveAllowed = y > waterBed + 2;
      const caveBand = caveDepth > 9 && caveDepth < 46 && underwaterCaveAllowed && (
        caveShaft ||
        caveCrossing ||
        (caveDistance < 2.5 && caveNoise > 1.45) ||
        (caveDistance < 3.4 && caveNoise > 1.15) ||
        (caveDistance < 5.0 && caveNoise > 1.72)
      );
      let biome = 'sky';
      let deco = null;

      if (y < surface - 8) {
        biome = 'sky';
      } else if (primary === 'mountain') {
        if (y < surface - 4) biome = 'sky';
        else if (y <= surface - 2) biome = transition && secondary === 'forest' ? 'forest' : 'mountain';
        else if (y <= surface) biome = transition ? 'rock' : 'mountain';
        else biome = caveBand ? 'cave' : 'soil';
      } else if (primary === 'forest') {
        if (y < surface - 5) biome = 'sky';
        else if (y <= surface - 1) biome = transition && secondary === 'grass' ? (seedNoise(x, y, 62) > 0.45 ? 'grass' : 'forest') : 'forest';
        else if (y === surface) biome = transition ? (secondary === 'grass' ? 'grass' : 'forest') : 'forest';
        else biome = caveBand ? 'cave' : 'soil';
      } else if (primary === 'grass') {
        if (y < surface - 4) biome = 'sky';
        else if (y <= surface - 1) biome = transition && secondary === 'forest' ? (seedNoise(x, y, 63) > 0.5 ? 'forest' : 'grass') : 'grass';
        else if (y === surface) biome = transition && secondary === 'shore' ? (seedNoise(x, y, 64) > 0.35 ? 'shore' : 'grass') : 'grass';
        else if (y <= surface + 1 && transition) biome = seedNoise(x, y, 65) > 0.4 ? 'shore' : 'grass';
        else biome = caveBand ? 'cave' : 'soil';
      } else if (primary === 'shore') {
        if (y < surface - 4) biome = 'sky';
        else if (y <= surface) biome = transition && secondary === 'grass' ? (seedNoise(x, y, 66) > 0.45 ? 'grass' : 'shore') : 'shore';
        else if (y < waterLevel - 2) biome = transition ? (seedNoise(x, y, 67) > 0.35 ? 'swamp' : 'shore') : 'shore';
        else if (y <= waterBed) biome = 'water';
        else biome = caveBand ? 'cave' : 'soil';
      } else {
        if (y < surface - 4) biome = 'sky';
        else if (y <= surface) biome = transition ? (seedNoise(x, y, 68) > 0.42 ? 'shore' : 'water') : 'water';
        else if (y <= waterBed) biome = 'water';
        else biome = caveBand ? 'cave' : 'soil';
      }

      if ((biome === 'shore' || biome === 'soil' || biome === 'rock') && y > waterLevel && y <= waterBed) {
        biome = 'soil';
      }
      if (biome === 'water' && y === waterBed && seedNoise(x, y, 97) > 0.82) {
        deco = 'reed';
      }

      const undergroundSpring = undergroundSpringNoise > 0.94 && y > waterBed + 3 && y < waterBed + 16 && caveDistance < 5.6;
      if (undergroundSpring && (biome === 'cave' || biome === 'soil')) {
        biome = 'water';
      }

      if (biome === 'forest' && seedNoise(x, y, 51) > 0.66) {
        deco = seedNoise(x, y, 52) > 0.48 ? 'tree' : 'bush';
      }
      if (biome === 'grass' && seedNoise(x, y, 53) > 0.78) {
        deco = seedNoise(x, y, 54) > 0.55 ? 'grass' : 'flower';
      }
      if (biome === 'mountain' && seedNoise(x, y, 55) > 0.88) {
        deco = 'rock';
      }
      if (biome === 'swamp' && seedNoise(x, y, 56) > 0.86) {
        deco = 'mushroom';
      }
      if (biome === 'shore' && seedNoise(x, y, 57) > 0.92) {
        deco = 'reed';
      }
      if (biome === 'cave' && seedNoise(x, y, 59) > 0.9) {
        deco = seedNoise(x, y, 60) > 0.6 ? 'cave' : 'mushroom';
      }

      cells.push({
        biome,
        deco,
        fertility: clamp(48 + (biome === 'grass' ? 24 : biome === 'forest' ? 18 : biome === 'shore' ? 10 : biome === 'water' ? 5 : 0) + Math.floor(seedNoise(x, y, 61) * 20) - 10, 0, 100)
      });
    }
  }

  const sealDepthCells = Math.ceil(10 / CELL);
  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const idx = getCellIndex(x, y);
      const cell = cells[idx];
      if (!cell || cell.biome !== 'water') continue;

      for (let d = 1; d <= sealDepthCells; d += 1) {
        const by = y + d;
        if (by >= WORLD_ROWS) break;
        const belowIdx = getCellIndex(x, by);
        const belowCell = cells[belowIdx];
        if (!belowCell) continue;
        if (belowCell.biome === 'cave') {
          belowCell.biome = 'soil';
          belowCell.deco = null;
        }
      }
    }
  }

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const idx = getCellIndex(x, y);
      const cell = cells[idx];
      if (!cell || cell.biome !== 'water') continue;

      for (const nx of [x - 1, x + 1]) {
        if (nx < 0 || nx >= WORLD_COLS) continue;
        const sideIdx = getCellIndex(nx, y);
        const sideCell = cells[sideIdx];
        if (!sideCell || sideCell.biome !== 'sky') continue;

        if (y <= surfaceByX[nx] - 1) continue;

        const belowSide = y + 1 < WORLD_ROWS ? cells[getCellIndex(nx, y + 1)] : null;
        const belowWater = y + 1 < WORLD_ROWS ? cells[getCellIndex(x, y + 1)] : null;
        const templateBiome = (belowSide && belowSide.biome !== 'water' && belowSide.biome !== 'sky')
          ? belowSide.biome
          : (belowWater && belowWater.biome !== 'water' && belowWater.biome !== 'sky' ? belowWater.biome : 'soil');

        let fillBiome = 'soil';
        if (['rock', 'mountain'].includes(templateBiome)) fillBiome = 'rock';
        else if (['shore', 'swamp'].includes(templateBiome)) fillBiome = 'shore';
        else if (templateBiome === 'forest') fillBiome = 'forest';
        else if (templateBiome === 'grass') fillBiome = 'grass';

        sideCell.biome = fillBiome;
        sideCell.deco = null;
        sideCell.fertility = clamp(sideCell.fertility + (fillBiome === 'forest' ? 6 : fillBiome === 'grass' ? 4 : 2), 0, 100);
      }
    }
  }

  let forestCount = 0;
  for (const cell of cells) {
    if (cell.biome === 'forest') forestCount += 1;
  }

  if (forestCount < WORLD_COLS) {
    const patchCenterX = clamp(Math.floor(WORLD_COLS * (0.28 + seedNoise(seed, 0, 141) * 0.14)), 8, WORLD_COLS - 9);
    const patchRadius = 14;
    for (let x = patchCenterX - patchRadius; x <= patchCenterX + patchRadius; x += 1) {
      if (x < 0 || x >= WORLD_COLS) continue;

      const top = clamp(surfaceByX[x] - 2, 4, WORLD_ROWS - 2);
      const bottom = clamp(surfaceByX[x] + 2, 5, WORLD_ROWS - 2);
      for (let y = top; y <= bottom; y += 1) {
        const idx = getCellIndex(x, y);
        const cell = cells[idx];
        if (!cell) continue;
        if (cell.biome === 'water' || cell.biome === 'sky' || cell.biome === 'cave') continue;
        cell.biome = 'forest';
        if (!cell.deco && seedNoise(x, y, 142) > 0.58) {
          cell.deco = seedNoise(x, y, 143) > 0.45 ? 'tree' : 'bush';
        }
      }
      for (let y = bottom + 1; y <= Math.min(bottom + 3, WORLD_ROWS - 1); y += 1) {
        const idx = getCellIndex(x, y);
        const cell = cells[idx];
        if (!cell || cell.biome === 'water') continue;
        if (cell.biome !== 'cave') cell.biome = 'soil';
      }
    }
  }

  return cells;
}

function generateClouds() {
  const clouds = [];
  for (let i = 0; i < 24; i += 1) {
    clouds.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * (WORLD_HEIGHT * 0.32),
      w: 30 + Math.random() * 50,
      h: 10 + Math.random() * 14,
      speed: 0.12 + Math.random() * 0.35
    });
  }
  return clouds;
}

function getCellIndex(x, y) {
  return y * WORLD_COLS + x;
}

function getCell(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_COLS || y >= WORLD_ROWS) return null;
  return appState.terrain[getCellIndex(x, y)] || null;
}

function habitatAllowsBiome(habitat, biome) {
  const habitats = Array.isArray(habitat) ? habitat : [habitat];
  const habitatSet = new Set(habitats);
  if (habitatSet.has('land') && ['grass', 'forest', 'swamp', 'rock', 'mountain', 'soil'].includes(biome)) return true;
  if (habitatSet.has('forest') && ['forest', 'grass', 'swamp'].includes(biome)) return true;
  if (habitatSet.has('grass') && ['grass', 'forest'].includes(biome)) return true;
  if (habitatSet.has('shore') && ['shore', 'swamp', 'water'].includes(biome)) return true;
  if (habitatSet.has('swamp') && ['swamp', 'shore', 'water'].includes(biome)) return true;
  if (habitatSet.has('sky') && biome === 'sky') return true;
  if (habitatSet.has('water') && biome === 'water') return true;
  if (habitatSet.has('soil') && ['soil', 'cave'].includes(biome)) return true;
  if (habitatSet.has('rock') && ['rock', 'mountain'].includes(biome)) return true;
  if (habitatSet.has('mountain') && ['mountain', 'rock'].includes(biome)) return true;
  if (habitatSet.has('cave') && biome === 'cave') return true;
  if (habitatSet.has('underground') && ['soil', 'cave'].includes(biome)) return true;
  return habitatSet.has('land') && biome === 'grass';
}

function isHabitatMatch(species, x, y) {
  const cell = getCell(x, y);
  if (!cell) return false;
  const habitat = species.status.habitats || species.status.habitat || 'land';
  return habitatAllowsBiome(habitat, cell.biome);
}

function findSpawnPosition(species) {
  for (let i = 0; i < 120; i += 1) {
    const x = Math.floor(Math.random() * WORLD_COLS);
    const y = Math.floor(Math.random() * WORLD_ROWS);
    if (isHabitatMatch(species, x, y)) return { x, y };
  }
  return { x: Math.floor(Math.random() * WORLD_COLS), y: Math.floor(Math.random() * WORLD_ROWS) };
}

function getBiomeColor(cell, env) {
  if (cell.biome === 'sky') {
    const b = clamp(150 + env.water * 0.7, 120, 230);
    return `rgb(95, 165, ${Math.round(b)})`;
  }
  if (cell.biome === 'mountain') {
    return 'rgb(120, 120, 130)';
  }
  if (cell.biome === 'rock') {
    return 'rgb(104, 98, 92)';
  }
  if (cell.biome === 'cave') {
    return 'rgb(38, 34, 48)';
  }
  if (cell.biome === 'forest') {
    const g = clamp(72 + env.vegetation * 1.1, 65, 170);
    return `rgb(28, ${Math.round(g)}, 44)`;
  }
  if (cell.biome === 'water') {
    const g = clamp(90 + env.water * 0.9, 90, 190);
    return `rgb(24, ${Math.round(g)}, 188)`;
  }
  if (cell.biome === 'swamp') {
    return 'rgb(35, 92, 58)';
  }
  if (cell.biome === 'shore') {
    const s = clamp(150 + env.vegetation * 0.25, 135, 190);
    return `rgb(${Math.round(s + 30)}, ${Math.round(s + 18)}, ${Math.round(s - 35)})`;
  }
  if (cell.biome === 'grass') {
    const g = clamp(88 + env.vegetation * 1.0, 75, 190);
    return `rgb(38, ${Math.round(g)}, 52)`;
  }
  return 'rgb(93, 75, 58)';
}

function drawDecoration(cell, x, y) {
  const px = x * CELL;
  const py = y * CELL;
  if (!cell.deco) return;

  if (cell.deco === 'tree') {
    const treeSize = CELL * 5;
    const trunkW = Math.max(2, Math.floor(treeSize * 0.2));
    const trunkH = Math.max(6, Math.floor(treeSize * 0.42));
    const canopyW = Math.max(10, Math.floor(treeSize * 0.88));
    const canopyH = Math.max(8, Math.floor(treeSize * 0.58));
    const trunkX = px + Math.floor((CELL - trunkW) / 2);
    const trunkY = py + CELL - trunkH;
    const canopyX = px + Math.floor((CELL - canopyW) / 2);
    const canopyY = trunkY - canopyH + 3;

    worldCtx.fillStyle = '#8d5c31';
    worldCtx.fillRect(trunkX, trunkY, trunkW, trunkH);
    worldCtx.fillStyle = '#2ef08a';
    worldCtx.fillRect(canopyX, canopyY, canopyW, canopyH);
    worldCtx.fillRect(canopyX - 2, canopyY + Math.floor(canopyH * 0.36), Math.max(6, Math.floor(canopyW * 0.3)), Math.max(4, Math.floor(canopyH * 0.24)));
    worldCtx.fillRect(canopyX + Math.floor(canopyW * 0.7), canopyY + Math.floor(canopyH * 0.32), Math.max(6, Math.floor(canopyW * 0.3)), Math.max(4, Math.floor(canopyH * 0.26)));
    return;
  }

  if (cell.deco === 'bush') {
    worldCtx.fillStyle = '#43c96f';
    worldCtx.fillRect(px + 1, py + 2, 3, 2);
    worldCtx.fillRect(px + 2, py + 1, 1, 3);
    return;
  }

  if (cell.deco === 'rock') {
    worldCtx.fillStyle = '#b7b0a4';
    worldCtx.fillRect(px + 1, py + 2, 3, 2);
    worldCtx.fillStyle = '#8d867a';
    worldCtx.fillRect(px + 2, py + 1, 1, 1);
    return;
  }

  if (cell.deco === 'cave') {
    worldCtx.fillStyle = '#8c7be0';
    worldCtx.fillRect(px + 2, py + 1, 2, 2);
    worldCtx.fillStyle = '#44375f';
    worldCtx.fillRect(px + 3, py + 2, 1, 2);
    return;
  }

  if (cell.deco === 'mushroom') {
    worldCtx.fillStyle = '#e87d70';
    worldCtx.fillRect(px + 1, py + 1, 3, 1);
    worldCtx.fillStyle = '#f4d7cf';
    worldCtx.fillRect(px + 2, py + 2, 1, 2);
    return;
  }

  if (cell.deco === 'grass') {
    worldCtx.fillStyle = '#8ff06a';
    worldCtx.fillRect(px + 3, py + 2, 1, 3);
    worldCtx.fillRect(px + 5, py + 1, 1, 4);
    worldCtx.fillRect(px + 7, py + 2, 1, 3);
    return;
  }

  if (cell.deco === 'flower') {
    worldCtx.fillStyle = '#8ff06a';
    worldCtx.fillRect(px + 5, py + 2, 1, 5);
    worldCtx.fillStyle = '#ffd7f6';
    worldCtx.fillRect(px + 4, py + 1, 3, 2);
    worldCtx.fillStyle = '#ffeb6e';
    worldCtx.fillRect(px + 5, py + 1, 1, 1);
    return;
  }

  if (cell.deco === 'reed') {
    worldCtx.fillStyle = '#98d48c';
    worldCtx.fillRect(px + 1, py + 2, 2, 3);
    worldCtx.fillRect(px + 6, py + 0, 1, 7);
    worldCtx.fillRect(px + 0, py + 0, 4, 2);
  }

}

function spawnEffect(x, y, color, text, tag) {
  appState.effects.push({
    x,
    y,
    color,
    text,
    tag,
    life: 22,
    maxLife: 22
  });
}

function drawBoundaryDots(cell, x, y) {
  const right = getCell(x + 1, y);
  const down = getCell(x, y + 1);
  const px = x * CELL;
  const py = y * CELL;

  if (right && right.biome !== cell.biome) {
    worldCtx.fillStyle = 'rgba(245, 240, 218, 0.32)';
    for (let k = 1; k < CELL; k += 3) {
      worldCtx.fillRect(px + CELL - 1, py + k, 1, 1);
    }
  }
  if (down && down.biome !== cell.biome) {
    worldCtx.fillStyle = 'rgba(245, 240, 218, 0.32)';
    for (let k = 1; k < CELL; k += 3) {
      worldCtx.fillRect(px + k, py + CELL - 1, 1, 1);
    }
  }
}

function drawWaveAnimation() {
  worldCtx.fillStyle = 'rgba(229, 252, 255, 0.72)';
  const t = appState.tick * 0.22;
  for (let y = 1; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const cell = getCell(x, y);
      const up = getCell(x, y - 1);
      if (!cell || cell.biome !== 'water') continue;
      if (!up || up.biome === 'water') continue;

      const phase = t + x * 0.45;
      const crest = (Math.sin(phase) + 1) * 0.5;
      const waveY = y * CELL + 1 + Math.floor(crest * 2);
      worldCtx.fillRect(x * CELL + 1, waveY, CELL - 2, 1);
    }
  }
}

function drawCloudLayer() {
  for (const cloud of appState.clouds) {
    const travel = (cloud.x + appState.tick * cloud.speed) % (WORLD_WIDTH + 120);
    const x = travel - 60;
    const y = cloud.y;

    worldCtx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    worldCtx.fillRect(x, y + cloud.h * 0.45, cloud.w, cloud.h * 0.5);
    worldCtx.fillRect(x + cloud.w * 0.15, y, cloud.w * 0.35, cloud.h * 0.6);
    worldCtx.fillRect(x + cloud.w * 0.45, y - cloud.h * 0.1, cloud.w * 0.42, cloud.h * 0.72);
  }
}

function drawEffects() {
  for (const effect of appState.effects) {
    const alpha = effect.life / effect.maxLife;
    const px = effect.x * CELL + CELL / 2;
    const py = effect.y * CELL + CELL / 2 - (effect.maxLife - effect.life) * 0.18;
    worldCtx.strokeStyle = effect.color.replace('ALPHA', alpha.toFixed(2));
    worldCtx.fillStyle = effect.color.replace('ALPHA', Math.max(alpha - 0.15, 0).toFixed(2));

    if (effect.tag === 'predator_focus') {
      worldCtx.strokeRect(px - 5, py - 5, 10, 10);
      worldCtx.fillRect(px - 1, py - 7, 2, 3);
      worldCtx.fillRect(px - 7, py - 1, 3, 2);
      worldCtx.fillRect(px + 4, py - 1, 3, 2);
    } else if (effect.tag === 'aquatic_heal') {
      worldCtx.beginPath();
      worldCtx.arc(px, py, 4, 0, Math.PI * 2);
      worldCtx.stroke();
      worldCtx.fillRect(px - 1, py - 1, 2, 2);
    } else if (effect.tag === 'sky_drift') {
      worldCtx.fillRect(px - 5, py - 1, 10, 1);
      worldCtx.fillRect(px - 2, py - 3, 6, 1);
      worldCtx.fillRect(px - 1, py + 1, 4, 1);
    } else if (effect.tag === 'thick_hide') {
      worldCtx.strokeRect(px - 4, py - 4, 8, 8);
      worldCtx.strokeRect(px - 2, py - 2, 4, 4);
    } else if (effect.tag === 'fertile_aura') {
      worldCtx.fillRect(px - 1, py - 5, 2, 10);
      worldCtx.fillRect(px - 5, py - 1, 10, 2);
      worldCtx.fillRect(px - 3, py - 3, 6, 6);
    } else {
      worldCtx.strokeRect(px - 4, py - 4, 8, 8);
      worldCtx.fillRect(px - 1, py - 6, 2, 2);
      worldCtx.fillRect(px - 6, py - 1, 2, 2);
      worldCtx.fillRect(px + 4, py - 1, 2, 2);
      worldCtx.fillRect(px - 1, py + 4, 2, 2);
    }
  }
}

function drawEditor() {
  spriteCtx.clearRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  for (let y = 0; y < DRAW_SIZE; y += 1) {
    for (let x = 0; x < DRAW_SIZE; x += 1) {
      const color = drawingPixels[y * DRAW_SIZE + x];
      if (!color) continue;
      spriteCtx.fillStyle = color;
      spriteCtx.fillRect(x, y, 1, 1);
    }
  }

  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  editorCtx.fillStyle = '#0d1f2a';
  editorCtx.fillRect(0, 0, editorCanvas.width, editorCanvas.height);
  editorCtx.drawImage(spriteCanvas, 0, 0, editorCanvas.width, editorCanvas.height);

  editorCtx.strokeStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i <= DRAW_SIZE; i += 1) {
    const p = i * PIXEL_SCALE;
    editorCtx.beginPath();
    editorCtx.moveTo(p, 0);
    editorCtx.lineTo(p, editorCanvas.height);
    editorCtx.stroke();

    editorCtx.beginPath();
    editorCtx.moveTo(0, p);
    editorCtx.lineTo(editorCanvas.width, p);
    editorCtx.stroke();
  }
}

function pointerToCell(clientX, clientY) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) / rect.width) * DRAW_SIZE);
  const y = Math.floor(((clientY - rect.top) / rect.height) * DRAW_SIZE);
  return { x, y };
}

function floodFill(startX, startY, color) {
  const startIdx = startY * DRAW_SIZE + startX;
  const target = drawingPixels[startIdx];
  if (target === color) return;

  const stack = [[startX, startY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    const idx = y * DRAW_SIZE + x;
    if (drawingPixels[idx] !== target) continue;
    drawingPixels[idx] = color;

    if (x > 0) stack.push([x - 1, y]);
    if (x < DRAW_SIZE - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < DRAW_SIZE - 1) stack.push([x, y + 1]);
  }
}

function paintAtCell(x, y) {

  if (x < 0 || y < 0 || x >= DRAW_SIZE || y >= DRAW_SIZE) return;
  const color = tool === 'eraser' ? null : colorPicker.value.toLowerCase();
  if (tool === 'fill') {
    floodFill(x, y, color);
  } else {
    drawingPixels[y * DRAW_SIZE + x] = color;
  }
  drawEditor();
}

function serializeDrawing() {
  return drawingPixels.map((p) => p || null);
}

function seededPopulation() {
  return 1;
}

function spawnEntities(speciesId) {
  const species = appState.species.find((s) => s.id === speciesId);
  if (!species) return;
  if (appState.entities.some((e) => e.speciesId === speciesId)) return;
  if (appState.entities.length >= MAX_ENTITIES) return;

  const totalCount = Math.floor(rand(2, 5));
  const availableSlots = MAX_ENTITIES - appState.entities.length;
  const spawnCount = Math.max(1, Math.min(totalCount, availableSlots));
  const center = findSpawnPosition(species);
  const used = new Set([`${center.x},${center.y}`]);

  const spawnOne = (x, y) => {
    appState.entities.push({
      id: crypto.randomUUID(),
      speciesId,
      x,
      y,
      rx: x,
      ry: y,
      energy: rand(55, 95),
      age: 0,
      hp: 100,
      vx: Math.random() < 0.5 ? -1 : 1,
      vy: Math.random() < 0.5 ? -1 : 1,
      frame: Math.floor(Math.random() * 4),
      reproduceCooldown: Math.floor(rand(30, 75)),
      lastReproduceTick: -999,
      maxAge: ENTITY_LIFESPAN_TICKS
    });
  };

  spawnOne(center.x, center.y);

  for (let i = 1; i < spawnCount; i += 1) {
    let placed = false;

    for (let radius = 1; radius <= 4 && !placed; radius += 1) {
      for (let attempt = 0; attempt < 12 && !placed; attempt += 1) {
        const nx = clamp(center.x + Math.floor(rand(-radius, radius + 1)), 0, WORLD_COLS - 1);
        const ny = clamp(center.y + Math.floor(rand(-radius, radius + 1)), 0, WORLD_ROWS - 1);
        const key = `${nx},${ny}`;
        if (used.has(key)) continue;
        if (appState.entities.some((e) => e.x === nx && e.y === ny)) continue;
        if (!isHabitatMatch(species, nx, ny)) continue;
        used.add(key);
        spawnOne(nx, ny);
        placed = true;
      }
    }

    if (!placed) {
      const fallback = findSpawnPosition(species);
      const key = `${fallback.x},${fallback.y}`;
      if (!used.has(key) && !appState.entities.some((e) => e.x === fallback.x && e.y === fallback.y)) {
        used.add(key);
        spawnOne(fallback.x, fallback.y);
      }
    }
  }
}

function speciesSpriteCanvas(species) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let y = 0; y < DRAW_SIZE; y += 1) {
    for (let x = 0; x < DRAW_SIZE; x += 1) {
      const color = species.pixels[y * DRAW_SIZE + x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  species.spriteCanvas = c;
}

function createBlankPixels() {
  return new Array(DRAW_SIZE * DRAW_SIZE).fill(null);
}

function paintPixelsRect(pixels, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= DRAW_SIZE || yy >= DRAW_SIZE) continue;
      pixels[yy * DRAW_SIZE + xx] = color;
    }
  }
}

function starterAnimalPixels(kind) {
  const p = createBlankPixels();

  if (kind === '牛') {
    paintPixelsRect(p, 7, 11, 18, 10, '#f5f2ea');
    paintPixelsRect(p, 20, 13, 7, 6, '#f5f2ea');
    paintPixelsRect(p, 9, 14, 4, 3, '#3a2b22');
    paintPixelsRect(p, 16, 12, 3, 2, '#3a2b22');
    paintPixelsRect(p, 8, 21, 2, 6, '#5a3f2f');
    paintPixelsRect(p, 13, 21, 2, 6, '#5a3f2f');
    paintPixelsRect(p, 18, 21, 2, 6, '#5a3f2f');
    paintPixelsRect(p, 23, 21, 2, 6, '#5a3f2f');
    paintPixelsRect(p, 25, 11, 3, 1, '#d8c6a4');
  } else if (kind === '豚') {
    paintPixelsRect(p, 8, 13, 16, 9, '#f4a5bf');
    paintPixelsRect(p, 21, 14, 5, 5, '#f4a5bf');
    paintPixelsRect(p, 23, 15, 2, 2, '#e67ca1');
    paintPixelsRect(p, 9, 22, 2, 5, '#d4839d');
    paintPixelsRect(p, 14, 22, 2, 5, '#d4839d');
    paintPixelsRect(p, 19, 22, 2, 5, '#d4839d');
  } else if (kind === '鷹') {
    paintPixelsRect(p, 12, 7, 9, 14, '#8a684a');
    paintPixelsRect(p, 6, 11, 6, 7, '#684f38');
    paintPixelsRect(p, 21, 10, 6, 8, '#684f38');
    paintPixelsRect(p, 16, 5, 4, 4, '#d6c7a3');
    paintPixelsRect(p, 20, 8, 3, 2, '#d8a74f');
    paintPixelsRect(p, 13, 21, 2, 6, '#d8a74f');
    paintPixelsRect(p, 18, 21, 2, 6, '#d8a74f');
  } else if (kind === '魚') {
    paintPixelsRect(p, 8, 12, 14, 8, '#57d2e5');
    paintPixelsRect(p, 20, 13, 5, 6, '#57d2e5');
    paintPixelsRect(p, 5, 14, 4, 5, '#3fb8cc');
    paintPixelsRect(p, 4, 15, 2, 3, '#3fb8cc');
    paintPixelsRect(p, 12, 10, 4, 2, '#74ebfa');
    paintPixelsRect(p, 14, 20, 4, 2, '#74ebfa');
  } else if (kind === 'コウモリ') {
    paintPixelsRect(p, 12, 12, 8, 9, '#5f5f76');
    paintPixelsRect(p, 5, 10, 7, 6, '#4c4c61');
    paintPixelsRect(p, 20, 10, 7, 6, '#4c4c61');
    paintPixelsRect(p, 4, 16, 7, 4, '#4c4c61');
    paintPixelsRect(p, 21, 16, 7, 4, '#4c4c61');
    paintPixelsRect(p, 14, 10, 4, 2, '#a09fb7');
  }

  return p;
}

function starterSpeciesDefinitions() {
  return [
    {
      name: '牛',
      status: {
        role: 'herbivore', speed: 4, attack: 4, defense: 8, fertility: 6, metabolism: 4, camouflage: 4, sociality: 6,
        habitat: 'grass', habitats: ['grass', 'forest', 'shore'], abilityTag: 'thick_hide',
        uniqueAbility: '牛式装甲適応: 外圧と危険に強く、消耗を抑える。'
      },
      narrative: '大型草食。耐久に優れた基幹種。'
    },
    {
      name: '豚',
      status: {
        role: 'omnivore', speed: 5, attack: 5, defense: 6, fertility: 8, metabolism: 5, camouflage: 3, sociality: 7,
        habitat: 'soil', habitats: ['soil', 'forest', 'grass'], abilityTag: 'fertile_aura',
        uniqueAbility: '豚式繁殖共鳴: 群れの増殖テンポを安定化する。'
      },
      narrative: '繁殖力が高く、地表資源を広く利用する。'
    },
    {
      name: '鷹',
      status: {
        role: 'carnivore', speed: 8, attack: 8, defense: 5, fertility: 4, metabolism: 6, camouflage: 5, sociality: 3,
        habitat: 'sky', habitats: ['sky', 'mountain', 'forest'], abilityTag: 'sky_drift',
        uniqueAbility: '鷹式滑空巡航: 空域移動の負荷を軽減し索敵範囲を広げる。'
      },
      narrative: '空域優位の捕食者。'
    },
    {
      name: '魚',
      status: {
        role: 'omnivore', speed: 7, attack: 4, defense: 4, fertility: 7, metabolism: 5, camouflage: 6, sociality: 6,
        habitat: 'water', habitats: ['water'], abilityTag: 'aquatic_heal',
        uniqueAbility: '魚式水脈回復: 水域で自己回復し、継戦能力を保つ。'
      },
      narrative: '水域の基礎個体群。'
    },
    {
      name: 'コウモリ',
      status: {
        role: 'omnivore', speed: 7, attack: 5, defense: 5, fertility: 5, metabolism: 4, camouflage: 7, sociality: 5,
        habitat: 'cave', habitats: ['cave'], abilityTag: 'burst_speed',
        uniqueAbility: 'コウモリ式瞬走: 短時間の急加速で危機回避に優れる。'
      },
      narrative: '洞窟と夜空を往来する機動種。'
    }
  ];
}

function ensureStarterSpecies() {
  const defs = starterSpeciesDefinitions();
  for (const def of defs) {
    const exists = appState.species.some((s) => s.name === def.name);
    if (exists) continue;

    const species = {
      id: `starter-${def.name}`,
      name: def.name,
      pixels: starterAnimalPixels(def.name),
      status: normalizeSpeciesStatus(def.status, { name: def.name }),
      features: null,
      narrative: def.narrative,
      isStarter: true
    };
    speciesSpriteCanvas(species);
    appState.species.push(species);
    spawnEntities(species.id);
    logEvent(`${def.name} を初期個体として追加`);
  }
}

function normalizeSpeciesStatus(status = {}, options = {}) {
  const normalized = { ...status };
  const speciesName = String(options.name || '').trim();
  const allowedHabitats = ['land', 'shore', 'sky', 'water', 'underground', 'forest', 'grass', 'swamp', 'soil', 'rock', 'mountain', 'cave'];
  const fallbackHabitats = ['land'];
  const habitats = Array.isArray(normalized.habitats) ? normalized.habitats : (normalized.habitat ? [normalized.habitat] : fallbackHabitats);
  normalized.habitats = habitats.filter((item, index) => habitats.indexOf(item) === index && allowedHabitats.includes(item));
  if (normalized.habitats.length === 0) normalized.habitats = fallbackHabitats;
  if (!allowedHabitats.includes(normalized.habitat)) {
    normalized.habitat = normalized.habitats[0];
  }
  if (!normalized.habitat) normalized.habitat = normalized.habitats[0];

  if (speciesName.includes('魚')) {
    normalized.habitats = ['water'];
    normalized.habitat = 'water';
  } else if (speciesName.includes('コウモリ')) {
    normalized.habitats = ['cave'];
    normalized.habitat = 'cave';
  }

  if (!normalized.abilityTag) normalized.abilityTag = 'burst_speed';
  const abilityText = String(normalized.uniqueAbility || '').trim();
  const genericAbilityTexts = new Set([
    '環境順応: 周囲の変化に合わせてしぶとく生き延びる。',
    '瞬発疾走: 元気な間だけ一気に加速する。',
    '水脈再生: 水や水辺にいると少しずつ回復する。',
    '風乗り滑空: 空域で体力消費を抑えて移動できる。',
    '厚殻潜行: 危険や外圧による消耗を軽減する。',
    '豊穣の気配: 近くの繁殖成功率を少し押し上げる。',
    '捕食本能: 接触時に獲物への一撃が鋭くなる。',
    '地形破砕: 岩や土を削って洞窟や通路を作りやすい。'
  ]);
  const isGenericAbility = !abilityText || abilityText.startsWith('環境順応:') || abilityText.startsWith('順応') || genericAbilityTexts.has(abilityText);
  if (isGenericAbility) {
    const head = speciesName ? `${speciesName.slice(0, 8)}式` : '個体式';
    const byTag = {
      burst_speed: `${head}瞬走: 瞬間的な加速で先行する。`,
      aquatic_heal: `${head}水脈回復: 水域での回復効率が高い。`,
      sky_drift: `${head}滑空巡航: 空域で移動負荷を軽減する。`,
      thick_hide: `${head}装甲適応: 外圧と危険に強くなる。`,
      fertile_aura: `${head}繁殖共鳴: 周囲の繁殖成功率を押し上げる。`,
      predator_focus: `${head}狩猟焦点: 接敵時の攻勢が鋭い。`,
      terrain_breaker: `${head}掘削破砕: 地形改変の効率が高い。`
    };
    normalized.uniqueAbility = byTag[normalized.abilityTag] || `${head}環境順応: 変化に合わせて生き延びる。`;
  }

  const signatureText = `${speciesName}|${normalized.uniqueAbility}|${normalized.abilityTag}|${normalized.habitat}`;
  let signatureHash = 0;
  for (let i = 0; i < signatureText.length; i += 1) {
    signatureHash = ((signatureHash << 5) - signatureHash + signatureText.charCodeAt(i)) | 0;
  }
  const normalizedHash = Math.abs(signatureHash);
  normalized.abilityVariance = {
    speed: ((normalizedHash % 7) - 3) * 0.08,
    energy: (((normalizedHash >> 3) % 7) - 3) * 0.06,
    fertility: (((normalizedHash >> 6) % 7) - 3) * 0.03,
    defense: (((normalizedHash >> 9) % 7) - 3) * 0.05,
    attack: (((normalizedHash >> 12) % 7) - 3) * 0.07
  };

  const profileSrc = normalized.abilityProfile && typeof normalized.abilityProfile === 'object' ? normalized.abilityProfile : {};
  const hashProfile = {
    mobility: ((normalizedHash % 9) - 4) * 0.08,
    regen: (((normalizedHash >> 4) % 9) - 4) * 0.08,
    resilience: (((normalizedHash >> 8) % 9) - 4) * 0.08,
    fertility: (((normalizedHash >> 12) % 9) - 4) * 0.08,
    aggression: (((normalizedHash >> 16) % 9) - 4) * 0.08,
    terraforming: (((normalizedHash >> 20) % 9) - 4) * 0.08
  };
  normalized.abilityProfile = {
    mobility: clamp(Number.isFinite(Number(profileSrc.mobility)) ? Number(profileSrc.mobility) : hashProfile.mobility, -0.4, 1),
    regen: clamp(Number.isFinite(Number(profileSrc.regen)) ? Number(profileSrc.regen) : hashProfile.regen, -0.4, 1),
    resilience: clamp(Number.isFinite(Number(profileSrc.resilience)) ? Number(profileSrc.resilience) : hashProfile.resilience, -0.4, 1),
    fertility: clamp(Number.isFinite(Number(profileSrc.fertility)) ? Number(profileSrc.fertility) : hashProfile.fertility, -0.4, 1),
    aggression: clamp(Number.isFinite(Number(profileSrc.aggression)) ? Number(profileSrc.aggression) : hashProfile.aggression, -0.4, 1),
    terraforming: clamp(Number.isFinite(Number(profileSrc.terraforming)) ? Number(profileSrc.terraforming) : hashProfile.terraforming, -0.4, 1)
  };

  return normalized;
}

function focusCameraOnEntity(entity) {
  const targetX = worldCanvas.width / 2 - (entity.rx * CELL + CELL / 2) * camera.zoom;
  const targetY = worldCanvas.height / 2 - (entity.ry * CELL + CELL / 2) * camera.zoom;
  camera.offsetX = targetX;
  camera.offsetY = targetY;
  clampCamera();
}

function updateSpeciesPanel() {
  speciesListEl.innerHTML = '';
  extinctListEl.innerHTML = '';

  const groups = new Map();
  for (const entity of appState.entities) {
    const s = appState.species.find((sp) => sp.id === entity.speciesId);
    if (!s) continue;
    if (!groups.has(s.id)) groups.set(s.id, { species: s, entities: [] });
    groups.get(s.id).entities.push(entity);
  }

  for (const { species, entities } of groups.values()) {
    const card = document.createElement('div');
    card.className = 'species-card species-tab';

    const top = document.createElement('button');
    top.className = 'species-top species-tab-toggle';
    top.type = 'button';

    const isCollapsed = collapsedSpeciesTabs.has(species.id);
    const marker = document.createElement('span');
    marker.className = 'species-tab-marker';
    marker.textContent = isCollapsed ? '▶' : '▼';

    const name = document.createElement('b');
    name.textContent = `${species.name} (${entities.length})`;

    const pill = document.createElement('span');
    pill.className = 'role-pill';
    pill.textContent = species.status.role;

    const left = document.createElement('span');
    left.className = 'species-tab-left';
    left.append(marker, name);
    top.append(left, pill);

    const avgHp = entities.reduce((sum, e) => sum + (Number(e.hp) || 0), 0) / Math.max(entities.length, 1);
    const stats = document.createElement('div');
    stats.className = 'stat-line';
    stats.textContent = `平均HP ${Math.round(avgHp)} / 生息地 ${habitatLabel(species.status.habitats || species.status.habitat || 'land')}`;

    const hpWrap = document.createElement('div');
    hpWrap.className = 'hp-wrap';
    const hpBar = document.createElement('div');
    hpBar.className = 'hp-bar';
    hpBar.style.width = `${clamp(avgHp, 0, 100)}%`;
    hpWrap.appendChild(hpBar);

    const ability = document.createElement('div');
    ability.className = 'stat-line';
    ability.textContent = `固有能力: ${species.status.uniqueAbility || '環境順応'}`;

    card.append(top, stats, hpWrap, ability);

    const list = document.createElement('div');
    list.className = 'species-tab-body';
    if (isCollapsed) list.style.display = 'none';

    entities.forEach((entity, idx) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'species-entity-row';
      row.textContent = `個体${idx + 1}  HP ${Math.round(entity.hp)}  EN ${Math.round(entity.energy)}`;
      row.addEventListener('click', () => {
        focusCameraOnEntity(entity);
        logEvent(`${species.name} の個体${idx + 1} に視点を移動`);
      });
      list.appendChild(row);
    });

    top.addEventListener('click', () => {
      const nextCollapsed = !collapsedSpeciesTabs.has(species.id);
      if (nextCollapsed) {
        collapsedSpeciesTabs.add(species.id);
        marker.textContent = '▶';
        list.style.display = 'none';
      } else {
        collapsedSpeciesTabs.delete(species.id);
        marker.textContent = '▼';
        list.style.display = '';
      }
    });

    card.appendChild(list);
    speciesListEl.appendChild(card);
  }

  for (const extinct of appState.extinctSpecies) {
    const card = document.createElement('div');
    card.className = 'extinct-card';
    card.textContent = `${extinct.name} / t${extinct.tick} に絶滅（${extinct.reason}）`;
    extinctListEl.appendChild(card);
  }
}

function updateEnvPanel() {
  envGridEl.innerHTML = '';
  const rows = [
    ['気温', `${appState.environment.temperature.toFixed(1)} C`],
    ['植生', `${appState.environment.vegetation.toFixed(1)}`],
    ['水資源', `${appState.environment.water.toFixed(1)}`],
    ['危険度', `${appState.environment.danger.toFixed(1)}`],
    ['新物質', `${appState.materials.length} 種`]
  ];

  for (const [k, v] of rows) {
    const el = document.createElement('div');
    el.className = 'env-item';
    el.innerHTML = `<b>${k}</b><div>${v}</div>`;
    envGridEl.appendChild(el);
  }

  tickLabel.textContent = `Tick: ${appState.tick}`;
  populationLabel.textContent = `Population: ${appState.entities.length}`;
}

async function analyzeAnimal(name, pixels) {
  return api('/api/analyze-animal', {
    method: 'POST',
    body: JSON.stringify({ name, pixels })
  });
}

function drawWorld() {
  worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);

  worldCtx.save();
  worldCtx.translate(camera.offsetX, camera.offsetY);
  worldCtx.scale(camera.zoom, camera.zoom);

  const visibleLeft = Math.max(0, Math.floor((-camera.offsetX) / camera.zoom));
  const visibleTop = Math.max(0, Math.floor((-camera.offsetY) / camera.zoom));
  const visibleRight = Math.min(WORLD_WIDTH, Math.ceil((worldCanvas.width - camera.offsetX) / camera.zoom));
  const visibleBottom = Math.min(WORLD_HEIGHT, Math.ceil((worldCanvas.height - camera.offsetY) / camera.zoom));
  const startX = clamp(Math.floor(visibleLeft / CELL) - 1, 0, WORLD_COLS - 1);
  const endX = clamp(Math.ceil(visibleRight / CELL) + 1, 0, WORLD_COLS - 1);
  const startY = clamp(Math.floor(visibleTop / CELL) - 1, 0, WORLD_ROWS - 1);
  const endY = clamp(Math.ceil(visibleBottom / CELL) + 1, 0, WORLD_ROWS - 1);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const cell = appState.terrain[getCellIndex(x, y)];
      worldCtx.fillStyle = getBiomeColor(cell, appState.environment);
      worldCtx.fillRect(x * CELL, y * CELL, CELL, CELL);
      drawBoundaryDots(cell, x, y);
      drawDecoration(cell, x, y);
    }
  }

  drawCloudLayer();

  for (const entity of appState.entities) {
    const species = appState.species.find((s) => s.id === entity.speciesId);
    if (!species) continue;
    if (typeof entity.rx !== 'number') entity.rx = entity.x;
    if (typeof entity.ry !== 'number') entity.ry = entity.y;
    entity.rx += (entity.x - entity.rx) * 0.23;
    entity.ry += (entity.y - entity.ry) * 0.23;

    const entityBaseSize = species.status.speed >= 8 ? CELL * 0.9 : CELL * 0.82;
    const entitySize = entityBaseSize * ENTITY_RENDER_SCALE;
    const jitter = Math.sin((appState.tick + entity.frame) * 0.25) * 0.35;
    worldCtx.drawImage(
      species.spriteCanvas,
      entity.rx * CELL + (CELL - entitySize) / 2 + jitter,
      entity.ry * CELL + (CELL - entitySize) / 2,
      entitySize,
      entitySize
    );
  }

  drawEffects();

  worldCtx.restore();
}

function updateZoomLabel() {
  zoomLabel.textContent = `Zoom: ${camera.zoom.toFixed(2)}x`;
}

function clampCamera() {
  const scaledWidth = WORLD_WIDTH * camera.zoom;
  const scaledHeight = WORLD_HEIGHT * camera.zoom;

  if (scaledWidth <= worldCanvas.width) {
    camera.offsetX = (worldCanvas.width - scaledWidth) / 2;
  } else {
    const minX = worldCanvas.width - scaledWidth;
    camera.offsetX = clamp(camera.offsetX, minX, 0);
  }

  if (scaledHeight <= worldCanvas.height) {
    camera.offsetY = (worldCanvas.height - scaledHeight) / 2;
  } else {
    const minY = worldCanvas.height - scaledHeight;
    camera.offsetY = clamp(camera.offsetY, minY, 0);
  }
}

function resetWorldView() {
  camera.zoom = 1;
  camera.offsetX = 0;
  camera.offsetY = 0;
  clampCamera();
  updateZoomLabel();
  drawWorld();
}

function nearestEntity(src, filterFn) {
  let best = null;
  let bestDist = Infinity;
  for (const e of appState.entities) {
    if (e.id === src.id || !filterFn(e)) continue;
    const d = Math.abs(e.x - src.x) + Math.abs(e.y - src.y);
    if (d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return { best, dist: bestDist };
}

function abilityModifiers(entity, species, cell) {
  const tag = species.status.abilityTag || 'burst_speed';
  const variance = species.status.abilityVariance || { speed: 0, energy: 0, fertility: 0, defense: 0, attack: 0 };
  const profile = species.status.abilityProfile || {
    mobility: 0,
    regen: 0,
    resilience: 0,
    fertility: 0,
    aggression: 0,
    terraforming: 0
  };
  const mod = {
    speedBonus: 0,
    energyDelta: 0,
    dangerScale: 1,
    fertilityBonus: 0,
    attackBonus: 0,
    terrainDamage: 0
  };

  if (tag === 'burst_speed' && entity.energy > 70) mod.speedBonus = 1;
  if (tag === 'aquatic_heal' && (cell.biome === 'water' || cell.biome === 'shore')) mod.energyDelta += 0.9;
  if (tag === 'sky_drift' && (species.status.habitats || []).includes('sky')) {
    mod.energyDelta += 0.45;
    mod.speedBonus = 1;
  }
  if (tag === 'thick_hide') mod.dangerScale = 0.55;
  if (tag === 'fertile_aura') mod.fertilityBonus = 0.18;
  if (tag === 'predator_focus') {
    mod.attackBonus = 1.6;
    mod.terrainDamage = 0.35;
  }
  if (tag === 'terrain_breaker') {
    mod.attackBonus = 0.8;
    mod.terrainDamage = 1.8;
  }

  mod.speedBonus += variance.speed;
  mod.energyDelta += variance.energy;
  mod.fertilityBonus = clamp(mod.fertilityBonus + variance.fertility, -0.08, 0.28);
  mod.attackBonus += variance.attack;
  mod.dangerScale = clamp(mod.dangerScale - variance.defense * 0.08, 0.4, 1.3);

  mod.speedBonus += profile.mobility * 1.25;
  mod.energyDelta += profile.regen * 0.9;
  mod.fertilityBonus = clamp(mod.fertilityBonus + profile.fertility * 0.2, -0.12, 0.38);
  mod.attackBonus += profile.aggression * 1.4;
  mod.terrainDamage += profile.terraforming * 1.6;
  mod.dangerScale = clamp(mod.dangerScale - profile.resilience * 0.42, 0.35, 1.35);

  return mod;
}

function tryActivateAbility(entity, species, reason) {
  if (appState.tick - (entity.lastAbilityTick || -999) < 48) return;

  const colorMap = {
    burst_speed: 'rgba(255, 207, 90, ALPHA)',
    aquatic_heal: 'rgba(85, 225, 255, ALPHA)',
    sky_drift: 'rgba(255, 255, 255, ALPHA)',
    thick_hide: 'rgba(184, 144, 95, ALPHA)',
    fertile_aura: 'rgba(171, 255, 140, ALPHA)',
    predator_focus: 'rgba(255, 114, 114, ALPHA)',
    terrain_breaker: 'rgba(210, 170, 120, ALPHA)'
  };

  entity.lastAbilityTick = appState.tick;
  spawnEffect(
    entity.x,
    entity.y,
    colorMap[species.status.abilityTag] || 'rgba(255,255,255,ALPHA)',
    species.status.uniqueAbility,
    species.status.abilityTag
  );
  logEvent(`${species.name} の能力発動: ${species.status.uniqueAbility} (${reason})`);
}

function consumeTerrain(entity, mods = {}) {
  const idx = getCellIndex(entity.x, entity.y);
  const cell = appState.terrain[idx];
  if (!cell) return;
  const fertilityBoost = 1 + (mods.fertilityBonus || 0);
  const gain = (appState.environment.vegetation * 0.06 + cell.fertility * 0.03) * (0.7 + Math.random() * 0.6) * fertilityBoost;
  entity.energy = clamp(entity.energy + gain, 0, 120);
  cell.fertility = clamp(cell.fertility - gain * (0.35 - Math.min(mods.fertilityBonus || 0, 0.12)), 0, 100);
}

function swapTerrainCells(ax, ay, bx, by) {
  if (ax === bx && ay === by) return false;
  const source = appState.terrain[getCellIndex(ax, ay)];
  const target = appState.terrain[getCellIndex(bx, by)];
  if (!source || !target) return false;

  const sourceState = {
    biome: source.biome,
    deco: source.deco,
    fertility: source.fertility
  };

  source.biome = target.biome;
  source.deco = target.deco;
  source.fertility = target.fertility;

  target.biome = sourceState.biome;
  target.deco = null;
  target.fertility = sourceState.fertility;

  return true;
}

function isWaterFlowTarget(biome) {
  return ['soil', 'grass', 'forest', 'shore', 'swamp'].includes(biome);
}

function isWaterBlockedBiome(biome) {
  return ['soil', 'grass', 'forest', 'rock', 'mountain'].includes(biome);
}

function isWaterDownTarget(biome) {
  return ['shore', 'swamp', 'water'].includes(biome);
}

function isWaterDropTarget(biome) {
  return false;
}

function isSolidSupport(biome) {
  return ['soil', 'grass', 'forest', 'shore', 'swamp', 'rock', 'mountain'].includes(biome);
}

function canDropIntoCave(x, y) {
  const target = getCell(x, y);
  if (!target || target.biome !== 'cave') return false;

  const left = getCell(x - 1, y);
  const right = getCell(x + 1, y);
  const below = getCell(x, y + 1);

  const sideOpen = (left && (left.biome === 'cave' || left.biome === 'water')) || (right && (right.biome === 'cave' || right.biome === 'water'));
  const verticalOpen = below && (below.biome === 'cave' || below.biome === 'water');

  return sideOpen || verticalOpen;
}

function hasAdjacentWater(x, y) {
  return [
    getCell(x + 1, y),
    getCell(x - 1, y),
    getCell(x, y + 1),
    getCell(x, y - 1)
  ].some((cell) => cell && cell.biome === 'water');
}

function erodeTerrainAround(entity, species, mods) {
  const tag = species.status.abilityTag || 'burst_speed';
  const terrainDamage = mods.terrainDamage || 0;
  if (terrainDamage <= 0 || entity.energy < 12) return false;

  const force = terrainDamage + species.status.attack * 0.14 + species.status.speed * 0.08 + entity.energy / 140;
  const radius = force > 2.2 ? 2 : 1;
  let changed = false;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > radius + 0.45) continue;

      const x = clamp(entity.x + dx, 0, WORLD_COLS - 1);
      const y = clamp(entity.y + dy, 0, WORLD_ROWS - 1);
      const cell = getCell(x, y);
      if (!cell || cell.biome === 'sky' || cell.biome === 'water') continue;

      const waterNearby = hasAdjacentWater(x, y);
      const before = cell.biome;
      let next = before;

      if (tag === 'terrain_breaker') {
        if (before === 'mountain' || before === 'rock') {
          next = force > 1.2 ? 'cave' : 'rock';
        } else if (before === 'soil') {
          next = force > 1.55 ? 'cave' : 'soil';
        } else if (before === 'grass' || before === 'forest') {
          next = force > 1.0 ? 'soil' : before;
        } else if (before === 'shore' || before === 'swamp') {
          next = force > 0.95 ? 'shore' : 'soil';
        } else if (before === 'cave') {
          next = force > 1.55 ? 'cave' : 'soil';
        }
      } else if (tag === 'predator_focus') {
        if ((before === 'soil' || before === 'grass' || before === 'forest') && force > 1.35 && Math.random() < 0.25) {
          next = 'soil';
        }
      }

      if (next !== before) {
        cell.biome = next;
        cell.deco = null;
        cell.fertility = clamp(cell.fertility + (next === 'soil' ? 2 : next === 'cave' ? -3 : -8), 0, 100);
        changed = true;
      }
    }
  }

  if (changed) {
    entity.energy = clamp(entity.energy - 0.9, 0, 120);
  }

  return changed;
}

function simulateWaterFlow() {
  for (let y = WORLD_ROWS - 2; y >= 0; y -= 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const cell = getCell(x, y);
      if (!cell || cell.biome !== 'water') continue;

      const down = getCell(x, y + 1);
      const downLeft = getCell(x - 1, y + 1);
      const downRight = getCell(x + 1, y + 1);
      const left = getCell(x - 1, y);
      const right = getCell(x + 1, y);
      const floorDown = getCell(x, y + 2);
      const floorDownLeft = getCell(x - 1, y + 2);
      const floorDownRight = getCell(x + 1, y + 2);
      const supportBelow = down && isSolidSupport(down.biome);
      const ponded = supportBelow && Math.random() < 0.28;
      const leftDrop = downLeft && downLeft.biome !== 'sky' && (!left || !isSolidSupport(left.biome));
      const rightDrop = downRight && downRight.biome !== 'sky' && (!right || !isSolidSupport(right.biome));
      const canFallDown = down && isWaterDownTarget(down.biome) && (!floorDown || isSolidSupport(floorDown.biome) || floorDown.biome === 'water');
      const canFallDownLeft = downLeft && isWaterDownTarget(downLeft.biome) && (!floorDownLeft || isSolidSupport(floorDownLeft.biome) || floorDownLeft.biome === 'water');
      const canFallDownRight = downRight && isWaterDownTarget(downRight.biome) && (!floorDownRight || isSolidSupport(floorDownRight.biome) || floorDownRight.biome === 'water');

      const candidates = [];

      if (canFallDown) candidates.push({ x, y: y + 1, score: 5.4 });
      if (canFallDownLeft) candidates.push({ x: x - 1, y: y + 1, score: 4.6 });
      if (canFallDownRight) candidates.push({ x: x + 1, y: y + 1, score: 4.6 });
      if (supportBelow && ponded && leftDrop && canFallDownLeft) candidates.push({ x: x - 1, y: y + 1, score: 3.2 });
      if (supportBelow && ponded && rightDrop && canFallDownRight) candidates.push({ x: x + 1, y: y + 1, score: 3.2 });

      if (ponded) {
        if (left && isWaterFlowTarget(left.biome) && (!getCell(x - 1, y + 1) || isSolidSupport(getCell(x - 1, y + 1).biome))) {
          candidates.push({ x: x - 1, y, score: 3 });
        }
        if (right && isWaterFlowTarget(right.biome) && (!getCell(x + 1, y + 1) || isSolidSupport(getCell(x + 1, y + 1).biome))) {
          candidates.push({ x: x + 1, y, score: 3 });
        }
      }

      if (candidates.length === 0 && supportBelow) {
        if (left && isWaterFlowTarget(left.biome) && (!getCell(x - 1, y + 1) || isSolidSupport(getCell(x - 1, y + 1).biome))) candidates.push({ x: x - 1, y, score: 2 });
        if (right && isWaterFlowTarget(right.biome) && (!getCell(x + 1, y + 1) || isSolidSupport(getCell(x + 1, y + 1).biome))) candidates.push({ x: x + 1, y, score: 2 });
      }

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => b.score - a.score);
      const chosen = candidates[0];
      const chosenCell = getCell(chosen.x, chosen.y);
      if (chosenCell && isWaterBlockedBiome(chosenCell.biome)) continue;
      const chance = chosen.y > y ? 0.96 : ponded ? 0.78 : 0.28;
      if (Math.random() > chance) continue;

      swapTerrainCells(x, y, chosen.x, chosen.y);
    }
  }
}

function sealWaterSideGapsRuntime() {
  function isVoidLike(biome) {
    return biome === 'sky' || biome === 'cave';
  }

  function pickSolidFillBiome(cx, cy) {
    const neighbors = [
      getCell(cx - 1, cy),
      getCell(cx + 1, cy),
      getCell(cx, cy - 1),
      getCell(cx, cy + 1)
    ].filter(Boolean);
    if (neighbors.some((n) => n.biome === 'rock' || n.biome === 'mountain')) return 'rock';
    return 'soil';
  }

  function forceSoilPatch(cx, cy) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const tx = cx + dx;
        const ty = cy + dy;
        const target = getCell(tx, ty);
        if (!target || target.biome === 'water') continue;
        target.biome = 'soil';
        target.deco = null;
        target.fertility = clamp(target.fertility + 2, 0, 100);
      }
    }
  }

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLS; x += 1) {
      const water = getCell(x, y);
      if (!water || water.biome !== 'water') continue;

      // Collapse deep enclosed water columns that behave like leaks.
      let nearOpenSky = false;
      for (let k = 1; k <= 5; k += 1) {
        const up = getCell(x, y - k);
        if (up && up.biome === 'sky') {
          nearOpenSky = true;
          break;
        }
      }
      const leftAtY = getCell(x - 1, y);
      const rightAtY = getCell(x + 1, y);
      const belowAtY = getCell(x, y + 1);
      const enclosedColumn = !nearOpenSky
        && leftAtY && rightAtY && belowAtY
        && isSolidSupport(leftAtY.biome)
        && isSolidSupport(rightAtY.biome)
        && (isSolidSupport(belowAtY.biome) || belowAtY.biome === 'water');
      if (enclosedColumn) {
        water.biome = 'soil';
        water.deco = null;
        water.fertility = clamp(water.fertility + 2, 0, 100);
        continue;
      }

      // Hard rule: no cave is allowed in the 1-cell neighborhood around water.
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const tx = x + dx;
          const ty = y + dy;
          const near = getCell(tx, ty);
          if (!near) continue;
          const shouldSeal = near.biome === 'cave' || (near.biome === 'sky' && dy >= 0);
          if (!shouldSeal) continue;
          near.biome = pickSolidFillBiome(tx, ty);
          near.deco = null;
          near.fertility = clamp(near.fertility + 1, 0, 100);
        }
      }

      // Keep a short solid bed under water to prevent vertical leakage.
      for (let d = 1; d <= 2; d += 1) {
        const below = getCell(x, y + d);
        if (!below) break;
        if (isVoidLike(below.biome)) {
          below.biome = 'soil';
          below.deco = null;
          below.fertility = clamp(below.fertility + 2, 0, 100);
        }
      }

      for (const nx of [x - 1, x + 1]) {
        const side = getCell(nx, y);
        if (!side || !isVoidLike(side.biome)) continue;

        const belowSide = getCell(nx, y + 1);
        const belowWater = getCell(x, y + 1);
        if (!belowSide && !belowWater) continue;
        if ((belowSide && isVoidLike(belowSide.biome)) && (!belowWater || isVoidLike(belowWater.biome))) continue;

        const templateBiome = (belowSide && belowSide.biome !== 'water' && !isVoidLike(belowSide.biome))
          ? belowSide.biome
          : (belowWater && belowWater.biome !== 'water' && !isVoidLike(belowWater.biome) ? belowWater.biome : 'soil');

        let fillBiome = 'soil';
        if (['rock', 'mountain'].includes(templateBiome)) fillBiome = 'rock';
        else if (['shore', 'swamp'].includes(templateBiome)) fillBiome = 'shore';
        else if (templateBiome === 'forest') fillBiome = 'forest';
        else if (templateBiome === 'grass') fillBiome = 'grass';

        side.biome = fillBiome;
        side.deco = null;
        side.fertility = clamp(side.fertility + 1, 0, 100);
        forceSoilPatch(nx, y);

        const diagonalBelow = getCell(nx, y + 1);
        if (diagonalBelow && isVoidLike(diagonalBelow.biome)) {
          diagonalBelow.biome = 'soil';
          diagonalBelow.deco = null;
          diagonalBelow.fertility = clamp(diagonalBelow.fertility + 1, 0, 100);
        }
      }
    }
  }
}

function simulateTerrainDynamics() {
  for (let i = 0; i < 3; i += 1) {
    sealWaterSideGapsRuntime();
    simulateWaterFlow();
  }
}

function findOpenNeighborForSpecies(species, centerX, centerY) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = clamp(centerX + dx, 0, WORLD_COLS - 1);
      const ny = clamp(centerY + dy, 0, WORLD_ROWS - 1);
      if (appState.entities.some((e) => e.x === nx && e.y === ny)) continue;
      if (isHabitatMatch(species, nx, ny)) return { x: nx, y: ny };
    }
  }
  return null;
}

function reproduceIfPossible(entity, species) {
  if (appState.entities.length >= MAX_ENTITIES) return;

  entity.reproduceCooldown = Math.max(0, Number(entity.reproduceCooldown || 0) - 1);
  if (entity.reproduceCooldown > 0) return;
  if ((entity.lastReproduceTick || -1) === appState.tick) return;
  if (entity.age < 42 || entity.energy < 72 || entity.hp < 55) return;

  const mateSearch = nearestEntity(entity, (candidate) => (
    candidate.speciesId === entity.speciesId
    && candidate.id !== entity.id
    && (candidate.reproduceCooldown || 0) <= 0
    && candidate.age > 42
    && candidate.energy > 68
    && (candidate.lastReproduceTick || -1) !== appState.tick
  ));
  const mate = mateSearch.best;
  if (!mate || mateSearch.dist > 2) return;

  const cell = getCell(entity.x, entity.y) || { fertility: 50 };
  const baseChance = species.status.fertility * 0.006;
  const terrainBoost = cell.fertility * 0.0012;
  const socialBoost = species.status.sociality * 0.0025;
  const chance = clamp(baseChance + terrainBoost + socialBoost, 0.02, 0.28);
  if (Math.random() > chance) return;

  const centerX = Math.round((entity.x + mate.x) / 2);
  const centerY = Math.round((entity.y + mate.y) / 2);
  const spawnPos = findOpenNeighborForSpecies(species, centerX, centerY)
    || findOpenNeighborForSpecies(species, entity.x, entity.y)
    || findOpenNeighborForSpecies(species, mate.x, mate.y);
  if (!spawnPos) return;

  appState.entities.push({
    id: crypto.randomUUID(),
    speciesId: entity.speciesId,
    x: spawnPos.x,
    y: spawnPos.y,
    rx: spawnPos.x,
    ry: spawnPos.y,
    energy: rand(48, 72),
    age: 0,
    hp: 100,
    vx: Math.random() < 0.5 ? -1 : 1,
    vy: Math.random() < 0.5 ? -1 : 1,
    frame: Math.floor(Math.random() * 4),
    reproduceCooldown: Math.floor(rand(75, 130)),
    lastReproduceTick: appState.tick,
    maxAge: ENTITY_LIFESPAN_TICKS
  });

  entity.energy = clamp(entity.energy - 16, 0, 120);
  mate.energy = clamp(mate.energy - 16, 0, 120);
  entity.reproduceCooldown = Math.floor(rand(70, 120));
  mate.reproduceCooldown = Math.floor(rand(70, 120));
  entity.lastReproduceTick = appState.tick;
  mate.lastReproduceTick = appState.tick;

  if (Math.random() < 0.2) {
    tryActivateAbility(entity, species, '繁殖成功');
  }
  logEvent(`${species.name} が繁殖し、新個体が誕生`);
}

function moveEntity(entity, species, speed) {
  if (Math.random() < 0.14) entity.vx *= -1;
  if (Math.random() < 0.14) entity.vy *= -1;

  const stride = speed >= 8 ? 2 : 1;
  const tries = [
    [entity.vx * stride, entity.vy * stride],
    [entity.vx * stride, 0],
    [0, entity.vy * stride],
    [-entity.vx * stride, entity.vy * stride],
    [entity.vx * stride, -entity.vy * stride]
  ];

  for (const [dx, dy] of tries) {
    const nx = clamp(entity.x + dx, 0, WORLD_COLS - 1);
    const ny = clamp(entity.y + dy, 0, WORLD_ROWS - 1);
    if (isHabitatMatch(species, nx, ny)) {
      entity.x = nx;
      entity.y = ny;
      return true;
    }
  }

  const fallback = findSpawnPosition(species);
  entity.x = fallback.x;
  entity.y = fallback.y;
  entity.energy -= 0.8;
  return false;
}

function simulateLocalEcology() {
  const toRemove = new Set();
  const deathReasonById = new Map();

  for (const entity of appState.entities) {
    const species = appState.species.find((s) => s.id === entity.speciesId);
    if (!species) continue;
    const cell = getCell(entity.x, entity.y) || { biome: 'soil', fertility: 0 };
    const mods = abilityModifiers(entity, species, cell);

    entity.age += 1;
    entity.energy -= species.status.metabolism * 0.33;
    entity.energy -= Math.max(0, appState.environment.temperature - 30) * 0.05;
    entity.energy -= Math.max(0, 5 - appState.environment.temperature) * 0.04;
    entity.energy -= appState.environment.danger * 0.008 * mods.dangerScale;
    entity.energy += mods.energyDelta;
    entity.hp = clamp(Math.round((entity.energy / 120) * 100), 0, 100);

    const moved = moveEntity(entity, species, species.status.speed + mods.speedBonus);
    if (!moved) entity.energy -= 0.4;
    if (mods.speedBonus > 0 && moved && Math.random() < 0.06) {
      tryActivateAbility(entity, species, '移動強化');
    }
    if (mods.energyDelta > 0.4 && Math.random() < 0.05) {
      tryActivateAbility(entity, species, '環境回復');
    }
    if (mods.dangerScale < 1 && appState.environment.danger > 40 && Math.random() < 0.04) {
      tryActivateAbility(entity, species, '危険耐性');
    }

    if (species.status.role === 'carnivore') {
      const prey = nearestEntity(entity, (e) => {
        const preySpecies = appState.species.find((s) => s.id === e.speciesId);
        return preySpecies && preySpecies.status.role !== 'carnivore';
      });

      if (prey.best && prey.dist <= 1) {
        const preySpecies = appState.species.find((s) => s.id === prey.best.speciesId);
        const attackPower = species.status.attack + mods.attackBonus + rand(-1, 2);
        const defensePower = preySpecies.status.defense + rand(-1, 2);
        if (attackPower > defensePower) {
          prey.best.hp = clamp((prey.best.hp || 100) - attackPower * 6, 0, 100);
          if (prey.best.hp <= 0) {
            toRemove.add(prey.best.id);
            deathReasonById.set(prey.best.id, '捕食');
            entity.energy = clamp(entity.energy + 35, 0, 120);
            if (mods.attackBonus > 0) {
              tryActivateAbility(entity, species, '捕食成功');
            }
          }
        }
      }
    } else {
      consumeTerrain(entity, mods);
    }

    if (species.status.role === 'omnivore' && Math.random() < 0.4) {
      consumeTerrain(entity, mods);
    }

    if (mods.terrainDamage > 0 && Math.random() < (species.status.abilityTag === 'terrain_breaker' ? 0.34 : 0.08)) {
      if (erodeTerrainAround(entity, species, mods)) {
        tryActivateAbility(entity, species, '地形破壊');
      }
    }

    reproduceIfPossible(entity, species);

    if (entity.energy <= 0) {
      toRemove.add(entity.id);
      deathReasonById.set(entity.id, '飢え');
    } else if (entity.age > (entity.maxAge || ENTITY_LIFESPAN_TICKS)) {
      toRemove.add(entity.id);
      deathReasonById.set(entity.id, '老衰');
    }
  }

  const deadEntities = appState.entities.filter((e) => toRemove.has(e.id));
  appState.entities = appState.entities.filter((e) => !toRemove.has(e.id));

  for (const dead of deadEntities) {
    const species = appState.species.find((s) => s.id === dead.speciesId);
    if (!species) continue;
    const alreadyExtinct = appState.extinctSpecies.some((x) => x.id === species.id);
    const stillAlive = appState.entities.some((x) => x.speciesId === species.id);
    if (!alreadyExtinct && !stillAlive) {
      const reason = deathReasonById.get(dead.id) || '不明';
      appState.extinctSpecies.unshift({ id: species.id, name: species.name, tick: appState.tick, reason });
      logEvent(`${species.name} が絶滅しました（${reason}）`);
    }
  }

  appState.effects = appState.effects
    .map((effect) => ({ ...effect, life: effect.life - 1 }))
    .filter((effect) => effect.life > 0);
}

async function requestEcosystemAI() {
  if (!authToken) return;
  const speciesSummary = appState.species.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.status.role,
    abilityTag: s.status.abilityTag,
    habitats: s.status.habitats || s.status.habitat || [],
    count: appState.entities.filter((e) => e.speciesId === s.id).length
  }));

  const payload = await api('/api/ai-ecosystem-step', {
    method: 'POST',
    body: JSON.stringify({ environment: appState.environment, species: speciesSummary })
  });
  if (payload.environment) {
    appState.environment = {
      ...appState.environment,
      ...payload.environment
    };
    if (appState.tick % 8 === 0) {
      logEvent(`AI環境判断: ${payload.environment.event} / ${payload.environment.eventText || ''}`);
    }
  }

  if (Array.isArray(payload.materials)) {
    appState.materials = payload.materials.slice(0, 6);
    if (appState.materials.length > 0 && appState.tick % 6 === 0) {
      const head = appState.materials[0];
      logEvent(`AI物質生成: ${head.name} (${head.state}) / ${head.effect}`);
    }
  }
}

function recoverTerrain() {
  if (appState.terrainSettleTicks > 0) {
    appState.terrainSettleTicks -= 1;
    return;
  }
  simulateTerrainDynamics();
}


async function tickSimulation() {
  if (!appState.running) return;
  appState.tick += 1;

  try {
    await requestEcosystemAI();
  } catch (error) {
    if (appState.tick % 10 === 0) {
      logEvent('AI環境判断APIに接続できません。前回状態で継続します。');
    }
  }

  recoverTerrain();
  simulateLocalEcology();
  updateSpeciesPanel();
  updateEnvPanel();
}

async function registerAnimal() {
  if (!authToken) {
    setMessage('先にログインしてください。', true);
    return;
  }

  const name = animalNameInput.value.trim();
  if (!name) {
    setMessage('動物名を入力してください。', true);
    return;
  }

  const pixels = serializeDrawing();
  try {
    setMessage('AIが絵を解析中...');
    const result = await analyzeAnimal(name, pixels);
    const species = {
      id: result.id,
      name,
      pixels,
      status: normalizeSpeciesStatus(result.status, { name }),
      features: result.features,
      narrative: result.narrative
    };
    speciesSpriteCanvas(species);
    appState.species.push(species);

    const initialCount = seededPopulation();
    spawnEntities(species.id);

    updateSpeciesPanel();
    updateEnvPanel();
    drawWorld();

    setMessage(`${name} を登録。初期個体数 ${initialCount} で生態系に放ちました。`);
    logEvent(`${name}(${result.status.role}) が生態系へ参加`);
  } catch (error) {
    setMessage(error.message, true);
  }
}

function setTool(nextTool) {
  tool = nextTool;
  for (const [btn, key] of [[penBtn, 'pen'], [eraserBtn, 'eraser'], [fillBtn, 'fill']]) {
    if (key === tool) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

editorCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  editorCanvas.setPointerCapture(e.pointerId);
  mouseDown = true;
  const pos = pointerToCell(e.clientX, e.clientY);
  paintAtCell(pos.x, pos.y);
});

window.addEventListener('pointerup', (e) => {
  if (editorCanvas.hasPointerCapture(e.pointerId)) {
    editorCanvas.releasePointerCapture(e.pointerId);
  }
  mouseDown = false;
});

editorCanvas.addEventListener('pointermove', (e) => {
  if (!mouseDown) return;
  const pos = pointerToCell(e.clientX, e.clientY);
  paintAtCell(pos.x, pos.y);
});

worldCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

worldCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = worldCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  const worldX = (px - camera.offsetX) / camera.zoom;
  const worldY = (py - camera.offsetY) / camera.zoom;

  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const nextZoom = clamp(camera.zoom * factor, camera.minZoom, camera.maxZoom);
  if (nextZoom === camera.zoom) return;

  camera.zoom = nextZoom;
  camera.offsetX = px - worldX * camera.zoom;
  camera.offsetY = py - worldY * camera.zoom;
  clampCamera();
  updateZoomLabel();
  drawWorld();
}, { passive: false });

worldCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  worldCanvas.setPointerCapture(e.pointerId);
  camera.isPanning = true;
  camera.lastX = e.clientX;
  camera.lastY = e.clientY;
  worldCanvas.classList.add('panning');
});

worldCanvas.addEventListener('pointermove', (e) => {
  if (!camera.isPanning) return;
  const dx = e.clientX - camera.lastX;
  const dy = e.clientY - camera.lastY;
  camera.lastX = e.clientX;
  camera.lastY = e.clientY;
  camera.offsetX += dx;
  camera.offsetY += dy;
  clampCamera();
  drawWorld();
});

worldCanvas.addEventListener('pointerup', (e) => {
  if (worldCanvas.hasPointerCapture(e.pointerId)) {
    worldCanvas.releasePointerCapture(e.pointerId);
  }
  camera.isPanning = false;
  worldCanvas.classList.remove('panning');
});

worldCanvas.addEventListener('pointercancel', () => {
  camera.isPanning = false;
  worldCanvas.classList.remove('panning');
});

penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));
fillBtn.addEventListener('click', () => setTool('fill'));

clearBtn.addEventListener('click', () => {
  drawingPixels.fill(null);
  drawEditor();
  setMessage('キャンバスをクリアしました。');
});

spawnBtn.addEventListener('click', registerAnimal);
animalNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') registerAnimal();
});

toggleSimBtn.addEventListener('click', () => {
  appState.running = !appState.running;
  toggleSimBtn.textContent = appState.running ? '停止' : '再開';
  logEvent(appState.running ? 'シミュレーション再開' : 'シミュレーション停止');
});

async function registerAccount() {
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ username: usernameInput.value.trim(), password: passwordInput.value })
    });
    authToken = data.token;
    setAuthenticatedUser(data.user);
    localStorage.setItem('oekaki_token', authToken);
    setMessage('アカウント作成に成功しました。');
    await loadAdminDashboard();
  } catch (error) {
    setAuthStatus(error.message, true);
  }
}

async function loginAccount() {
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ username: usernameInput.value.trim(), password: passwordInput.value })
    });
    authToken = data.token;
    setAuthenticatedUser(data.user);
    localStorage.setItem('oekaki_token', authToken);
    setMessage('ログインしました。');
    await loadAdminDashboard();
  } catch (error) {
    setAuthStatus(error.message, true);
  }
}

function logoutAccount() {
  authToken = '';
  currentUser = null;
  clearAdminSession();
  localStorage.removeItem('oekaki_token');
  setAuthStatus('ログアウトしました。');
}

async function restoreSession() {
  if (!authToken) {
    setAuthStatus('未ログインです。');
    return;
  }
  try {
    const data = await api('/api/auth/me', { method: 'GET' });
    setAuthenticatedUser(data.user);
    await loadAdminDashboard();
  } catch {
    logoutAccount();
  }
}

async function postEcosystem() {
  if (!authToken) {
    setMessage('投稿にはログインが必要です。', true);
    return;
  }
  const title = `${currentUser.username}の生態系 t${appState.tick}`;
  const snapshot = {
    tick: appState.tick,
    environment: appState.environment,
    species: appState.species.map((s) => ({
      id: s.id,
      name: s.name,
      pixels: s.pixels,
      status: s.status,
      features: s.features,
      narrative: s.narrative,
      population: appState.entities.filter((e) => e.speciesId === s.id).length
    }))
  };

  try {
    const result = await api('/api/ecosystems', {
      method: 'POST',
      body: JSON.stringify({ title, snapshot, isPublic: true })
    });
    setMessage(`公開投稿しました。ID: ${result.id}`);
    await loadGallery();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function loadGallery() {
  try {
    const data = await api('/api/ecosystems/public', { method: 'GET', headers: {} });
    galleryListEl.innerHTML = '';

    for (const item of data.items) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <b>${item.title}</b>
        <div class="gallery-meta">by ${item.owner} / ${item.created_at}</div>
        <button data-id="${item.id}">この生態系を閲覧</button>
      `;
      card.querySelector('button').addEventListener('click', () => loadEcosystem(item.id));
      galleryListEl.appendChild(card);
    }
  } catch (error) {
    galleryListEl.innerHTML = `<div class="gallery-card">読み込み失敗: ${error.message}</div>`;
  }
}

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    openAdminUnlockModal();
  }
  if (event.key === 'Escape' && !adminUnlockModalEl.hidden) {
    closeAdminUnlockModal();
  }
});

adminPasswordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') unlockAdminPanel();
});

async function loadEcosystem(id) {
  try {
    const data = await api(`/api/ecosystems/${id}`, { method: 'GET', headers: {} });
    const snapshot = data.snapshot;
    appState.tick = snapshot.tick || 0;
    appState.environment = snapshot.environment || appState.environment;
    appState.species = (snapshot.species || []).map((s) => ({
      ...s,
      status: normalizeSpeciesStatus(s.status, { name: s.name })
    }));
    for (const s of appState.species) speciesSpriteCanvas(s);

    appState.entities = [];
    appState.extinctSpecies = [];
    for (const species of appState.species) {
      spawnEntities(species.id);
    }

    drawWorld();
    updateSpeciesPanel();
    updateEnvPanel();
    logEvent(`公開生態系を読み込み: ${data.title}`);
  } catch (error) {
    setMessage(error.message, true);
  }
}

registerBtn.addEventListener('click', registerAccount);
loginBtn.addEventListener('click', loginAccount);
logoutBtn.addEventListener('click', logoutAccount);
saveWorldBtn.addEventListener('click', postEcosystem);
refreshGalleryBtn.addEventListener('click', loadGallery);
refreshAdminBtn.addEventListener('click', loadAdminDashboard);
regenerateWorldBtn.addEventListener('click', regenerateWorldSeed);
changeAdminPasswordBtn.addEventListener('click', changeAdminPassword);
unlockAdminBtn.addEventListener('click', unlockAdminPanel);
closeAdminUnlockBtn.addEventListener('click', closeAdminUnlockModal);
closeAdminBtn.addEventListener('click', () => {
  clearAdminSession();
  closeAdminUnlockModal();
});
resetViewBtn.addEventListener('click', resetWorldView);
colorPicker.addEventListener('change', buildPalette);

setInterval(() => {
  tickSimulation();
}, TICK_INTERVAL_MS);

function renderLoop() {
  drawWorld();
  requestAnimationFrame(renderLoop);
}

drawEditor();
resetWorldView();
renderLoop();
updateEnvPanel();
buildPalette();
syncAdminPanel();
closeAdminUnlockModal();
loadWorldConfig();
ensureStarterSpecies();
restoreSession();
loadGallery();
logEvent('生態系シミュレーションを開始');
