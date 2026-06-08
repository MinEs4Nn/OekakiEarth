const OpenAI = require('openai');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function maybeCreateClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeAbilitySet(items) {
  const set = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (t) set.add(t);
  }
  return set;
}

function ensureUniqueAbilityText(text, name, existingSet) {
  const base = (typeof text === 'string' ? text.trim() : '').slice(0, 70) || '環境順応: 周囲の変化に合わせてしぶとく生き延びる。';
  if (!existingSet.has(base)) return base;

  const salt = hashString(`${name}|${base}`);
  const suffixes = ['改', '式', '変種', '零', '双', '真', '極'];
  for (let i = 0; i < suffixes.length; i += 1) {
    const suffix = suffixes[(salt + i) % suffixes.length];
    const next = `${base.slice(0, 64)} ${suffix}`.trim().slice(0, 70);
    if (!existingSet.has(next)) return next;
  }
  return `${base.slice(0, 64)} ${salt % 1000}`.trim().slice(0, 70);
}

function buildFallbackUniqueAbility(name, tag, persona, features, existingSet) {
  const tagWord = {
    burst_speed: '瞬走',
    aquatic_heal: '水脈',
    sky_drift: '風巡',
    thick_hide: '装甲',
    fertile_aura: '豊穣',
    predator_focus: '狩猟',
    terrain_breaker: '掘砕'
  };
  const traitWord = (persona?.traits || [])[0] || tagWord[tag] || '個体';
  const moodPool = {
    burst_speed: ['加速', '疾走', '瞬発', '滑走', '跳駆'],
    aquatic_heal: ['再生', '浄化', '循環', '保水', '潮流'],
    sky_drift: ['滑空', '上昇', '風読', '旋回', '巡航'],
    thick_hide: ['硬化', '防壁', '殻化', '耐圧', '守勢'],
    fertile_aura: ['共鳴', '芽吹', '増殖', '受粉', '再興'],
    predator_focus: ['猛攻', '狙撃', '追尾', '裂爪', '奇襲'],
    terrain_breaker: ['破砕', '掘削', '崩落', '穿孔', '変成']
  };
  const effectPoolByTag = {
    burst_speed: ['短時間の急加速で先手を取りやすい。', '移動の立ち上がりが速く、危機回避が得意。', '瞬発機動により索敵と追跡を両立する。'],
    aquatic_heal: ['水域で回復効率が上がり、消耗を抑える。', '水辺で代謝が安定し、継戦力が高まる。', '湿潤環境で自己修復が進みやすい。'],
    sky_drift: ['空域で移動負荷を軽減し巡回範囲を広げる。', '気流利用でエネルギー消費を抑える。', '上昇気流を捉えて長距離を移動しやすい。'],
    thick_hide: ['外圧と危険による消耗を軽減する。', '被弾時の損耗を抑えて耐久戦に強い。', '防御姿勢の維持に優れ、崩れにくい。'],
    fertile_aura: ['近傍個体の繁殖成功率を底上げする。', '群れの増殖テンポを安定化させる。', '生育環境を整え、世代交代を促進する。'],
    predator_focus: ['接敵時の攻勢が鋭く、捕食成功率を上げる。', '獲物への追撃精度を高め、隙を逃しにくい。', '奇襲時に火力が伸びて短期決着を狙える。'],
    terrain_breaker: ['地形改変効率を高め、通路形成が得意。', '岩盤や土壌の掘削により活動域を拡張する。', '地表変成で局所環境を自種向けに再構築する。']
  };
  const salt = hashString(`${name}|${tag}|${JSON.stringify(features || {})}`);
  const moods = moodPool[tag] || ['適応', '変化', '進化'];
  const effects = effectPoolByTag[tag] || ['環境変化に適応して生存効率を上げる。'];
  const mood = moods[salt % moods.length];
  const effect = effects[(salt >>> 3) % effects.length];
  const nameToken = String(name || '').trim().slice(0, 8) || '名無し';
  const base = `${nameToken}型${traitWord}${mood}: ${effect}`.slice(0, 70);
  return ensureUniqueAbilityText(base, name, existingSet);
}

function inferNameHints(name) {
  const lower = String(name || '').toLowerCase();
  const has = (list) => list.some((word) => lower.includes(word));

  if (has(['fish', 'shark', 'whale', 'dolphin', 'seal', 'otter', 'さかな', 'サカナ', 'うお', '魚', 'サメ', 'くじら', 'イルカ', 'アザラシ'])) {
    return { habitat: 'water', abilityTag: 'aquatic_heal', roleBias: 'carnivore' };
  }
  if (has(['bird', 'hawk', 'eagle', 'owl', 'sparrow', 'falcon', 'とり', 'トリ', '鳥', 'たか', 'タカ', 'ふくろう', 'フクロウ'])) {
    return { habitat: 'sky', abilityTag: 'sky_drift', roleBias: 'omnivore' };
  }
  if (has(['frog', 'crab', 'newt', 'duck', 'beaver', 'カエル', 'かえる', 'カニ', 'かに', 'アヒル', 'ビーバー'])) {
    return { habitat: 'shore', abilityTag: 'fertile_aura', roleBias: 'omnivore' };
  }
  if (has(['mole', 'worm', 'ant', 'beetle', 'モグラ', 'もぐら', 'ミミズ', 'あり', 'アリ', 'カブト', 'クワガタ'])) {
    return { habitat: 'underground', abilityTag: 'thick_hide', roleBias: 'herbivore' };
  }
  if (has(['rhino', 'elephant', 'mammoth', 'boar', 'badger', 'サイ', 'ゾウ', 'マンモス', 'イノシシ', 'アナグマ'])) {
    return { habitat: 'soil', abilityTag: 'terrain_breaker', roleBias: 'omnivore' };
  }
  if (has(['wolf', 'tiger', 'lion', 'fox', 'オオカミ', 'おおかみ', 'トラ', 'ライオン', 'キツネ', 'きつね'])) {
    return { habitat: 'land', abilityTag: 'predator_focus', roleBias: 'carnivore' };
  }

  return { habitat: null, abilityTag: null, roleBias: null };
}

function inferNamePersonality(name) {
  const lower = String(name || '').toLowerCase();
  const has = (list) => list.some((word) => lower.includes(word));
  const mods = {
    speed: 0,
    attack: 0,
    defense: 0,
    fertility: 0,
    metabolism: 0,
    camouflage: 0,
    sociality: 0
  };
  const traits = [];

  if (has(['炎', 'fire', 'flame', 'inferno', 'バーン'])) {
    mods.attack += 2;
    mods.metabolism += 1;
    traits.push('攻撃的');
  }
  if (has(['氷', 'ice', 'frost', 'snow', 'ブリザ'])) {
    mods.defense += 2;
    mods.speed -= 1;
    traits.push('耐久型');
  }
  if (has(['風', 'wind', 'gale', 'swift', 'はや', '疾風'])) {
    mods.speed += 2;
    mods.defense -= 1;
    traits.push('俊敏');
  }
  if (has(['影', 'shadow', 'dark', 'night', 'stealth', '忍'])) {
    mods.camouflage += 2;
    mods.sociality -= 1;
    traits.push('隠密');
  }
  if (has(['森', 'wood', 'leaf', 'bloom', '花', 'tree'])) {
    mods.fertility += 2;
    mods.sociality += 1;
    traits.push('共生');
  }
  if (has(['王', 'king', 'lord', '皇', '帝'])) {
    mods.attack += 1;
    mods.defense += 1;
    mods.sociality += 1;
    traits.push('支配的');
  }
  if (has(['ミニ', 'mini', 'tiny', 'ちび', 'こ']) && lower.length <= 12) {
    mods.speed += 1;
    mods.defense -= 1;
    traits.push('小型');
  }
  if (has(['ゴーレム', 'golem', 'armor', 'tank', '壁'])) {
    mods.defense += 2;
    mods.speed -= 1;
    traits.push('重装');
  }

  return {
    mods,
    traits: traits.slice(0, 3)
  };
}

function japaneseAbilityText(tag) {
  const table = {
    burst_speed: '瞬発疾走: 元気な間だけ一気に加速する。',
    aquatic_heal: '水脈再生: 水や水辺にいると少しずつ回復する。',
    sky_drift: '風乗り滑空: 空域で体力消費を抑えて移動できる。',
    thick_hide: '厚殻潜行: 危険や外圧による消耗を軽減する。',
    fertile_aura: '豊穣の気配: 近くの繁殖成功率を少し押し上げる。',
    predator_focus: '捕食本能: 接触時に獲物への一撃が鋭くなる。',
    terrain_breaker: '地形破砕: 岩や土を削って洞窟や通路を作りやすい。'
  };
  return table[tag] || '環境順応: 周囲の変化に合わせてしぶとく生き延びる。';
}

function normalizeTagSet(items) {
  const allowed = ['burst_speed', 'aquatic_heal', 'sky_drift', 'thick_hide', 'fertile_aura', 'predator_focus', 'terrain_breaker'];
  const set = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (allowed.includes(item)) set.add(item);
  }
  return set;
}

function pickAbilityTag(name, features, role, habitats, options = {}) {
  const hints = inferNameHints(name);
  const tags = ['burst_speed', 'aquatic_heal', 'sky_drift', 'thick_hide', 'fertile_aura', 'predator_focus', 'terrain_breaker'];
  const scores = {
    burst_speed: 0.1,
    aquatic_heal: 0,
    sky_drift: 0,
    thick_hide: 0,
    fertile_aura: 0,
    predator_focus: 0,
    terrain_breaker: 0
  };

  const inHabitats = (h) => Array.isArray(habitats) && habitats.includes(h);
  scores.burst_speed += (features.roughness || 0) * 0.4 + (1 - (features.fillRatio || 0)) * 0.3;
  scores.aquatic_heal += (inHabitats('water') || inHabitats('shore') ? 0.8 : 0) + (features.edgeRatio || 0) * 0.25;
  scores.sky_drift += (inHabitats('sky') ? 0.95 : 0) + (features.symmetry || 0) * 0.25;
  scores.thick_hide += (features.fillRatio || 0) * 0.45 + (role === 'herbivore' ? 0.2 : 0);
  scores.fertile_aura += (features.colorDiversity || 0) * 0.25 + (features.symmetry || 0) * 0.35 + (role !== 'carnivore' ? 0.2 : 0);
  scores.predator_focus += (role === 'carnivore' ? 0.9 : 0.1) + (features.roughness || 0) * 0.5;
  scores.terrain_breaker += (inHabitats('soil') || inHabitats('rock') || inHabitats('mountain') || inHabitats('cave') ? 0.75 : 0) + (features.fillRatio || 0) * 0.3;

  if (hints.abilityTag && scores[hints.abilityTag] != null) {
    scores[hints.abilityTag] += 0.7;
  }

  const existingTags = normalizeTagSet(options.existingAbilityTags);
  if (existingTags.size > 0) {
    for (const tag of existingTags) {
      if (scores[tag] != null) scores[tag] -= 0.15;
    }
  }

  // Break ties in a name-sensitive way so different names are less likely to converge.
  for (const tag of tags) {
    const jitter = (hashString(`${name}|${tag}`) % 17) / 100;
    scores[tag] += jitter;
  }

  const sorted = tags
    .map((tag) => ({ tag, score: scores[tag] }))
    .sort((a, b) => b.score - a.score);
  return sorted[0]?.tag || 'burst_speed';
}

function inferAbilityProfile({ tag, uniqueAbility, role, habitats, features }) {
  const text = `${uniqueAbility || ''}`;
  const has = (words) => words.some((w) => text.includes(w));
  const profile = {
    mobility: 0,
    regen: 0,
    resilience: 0,
    fertility: 0,
    aggression: 0,
    terraforming: 0
  };

  if (tag === 'burst_speed') profile.mobility += 0.65;
  if (tag === 'aquatic_heal') profile.regen += 0.7;
  if (tag === 'sky_drift') profile.mobility += 0.55;
  if (tag === 'thick_hide') profile.resilience += 0.65;
  if (tag === 'fertile_aura') profile.fertility += 0.7;
  if (tag === 'predator_focus') profile.aggression += 0.7;
  if (tag === 'terrain_breaker') profile.terraforming += 0.75;

  if (has(['疾走', '加速', '高速', '俊敏', '滑空', '跳躍'])) profile.mobility += 0.25;
  if (has(['再生', '回復', '治癒', '水脈'])) profile.regen += 0.25;
  if (has(['耐久', '防御', '硬化', '盾', '殻'])) profile.resilience += 0.25;
  if (has(['繁殖', '豊穣', '増殖', '胞子'])) profile.fertility += 0.25;
  if (has(['捕食', '狩猟', '猛攻', '牙', '本能'])) profile.aggression += 0.25;
  if (has(['破砕', '掘削', '地形', '通路', '崩し'])) profile.terraforming += 0.25;

  if (role === 'carnivore') profile.aggression += 0.14;
  if (role === 'herbivore') profile.fertility += 0.1;
  if (Array.isArray(habitats) && (habitats.includes('water') || habitats.includes('shore'))) profile.regen += 0.1;
  if (Array.isArray(habitats) && habitats.includes('sky')) profile.mobility += 0.12;
  if ((features.fillRatio || 0) > 0.45) profile.resilience += 0.08;
  if ((features.roughness || 0) > 0.45) profile.aggression += 0.08;

  return {
    mobility: clamp(profile.mobility, -0.4, 1),
    regen: clamp(profile.regen, -0.4, 1),
    resilience: clamp(profile.resilience, -0.4, 1),
    fertility: clamp(profile.fertility, -0.4, 1),
    aggression: clamp(profile.aggression, -0.4, 1),
    terraforming: clamp(profile.terraforming, -0.4, 1)
  };
}

function normalizeHabitatList(habitats) {
  const allowed = ['land', 'forest', 'grass', 'shore', 'swamp', 'water', 'soil', 'rock', 'mountain', 'cave', 'sky', 'underground'];
  const list = [];
  for (const habitat of Array.isArray(habitats) ? habitats : []) {
    if (allowed.includes(habitat) && !list.includes(habitat)) list.push(habitat);
  }
  return list;
}

function composeHabitats(name, features) {
  const hints = inferNameHints(name);
  const habitats = [];

  if (hints.habitat === 'water') habitats.push('water', 'shore');
  else if (hints.habitat === 'sky') habitats.push('sky', 'forest');
  else if (hints.habitat === 'shore') habitats.push('shore', 'swamp', 'water');
  else if (hints.habitat === 'underground') habitats.push('underground', 'soil', 'cave');
  else if (hints.habitat === 'land') habitats.push('forest', 'grass', 'rock');

  if (features.fillRatio > 0.38) habitats.push('soil', 'cave');
  if (features.fillRatio < 0.12 && features.symmetry > 0.72) habitats.push('sky');
  if (features.edgeRatio > 0.2) habitats.push('shore', 'swamp');
  if (features.roughness > 0.42) habitats.push('forest', 'rock');

  const normalized = normalizeHabitatList(habitats);
  if (normalized.length === 0) normalized.push('land');
  return normalized.slice(0, 4);
}

function fallbackStatus(name, features, options = {}) {
  const aggressionSeed = features.roughness * 0.8 + (1 - features.symmetry) * 0.4 + features.edgeRatio * 0.2;
  const herbSeed = features.symmetry * 0.6 + (1 - features.roughness) * 0.3 + features.fillRatio * 0.1;
  const hints = inferNameHints(name);
  const persona = inferNamePersonality(name);
  const existingSet = normalizeAbilitySet(options.existingAbilityTexts);
  const habitats = composeHabitats(name, features);

  let role = 'omnivore';
  if (aggressionSeed - herbSeed > 0.22) role = 'carnivore';
  if (herbSeed - aggressionSeed > 0.22) role = 'herbivore';
  if (hints.roleBias) role = hints.roleBias;

  const habitat = habitats[0] || hints.habitat || 'land';

  const abilityTag = pickAbilityTag(name, features, role, habitats, {
    existingAbilityTags: options.existingAbilityTags
  });
  const uniqueAbility = buildFallbackUniqueAbility(name, abilityTag, persona, features, existingSet);

  const status = {
    role,
    speed: clamp(Math.round(3 + features.roughness * 5 + features.colorDiversity * 2 + persona.mods.speed), 1, 10),
    attack: clamp(Math.round(2 + aggressionSeed * 7 + persona.mods.attack), 1, 10),
    defense: clamp(Math.round(2 + features.fillRatio * 6 + features.symmetry * 2 + persona.mods.defense), 1, 10),
    fertility: clamp(Math.round(2 + features.colorDiversity * 4 + features.symmetry * 4 + persona.mods.fertility), 1, 10),
    metabolism: clamp(Math.round(3 + features.fillRatio * 4 + features.roughness * 3 + persona.mods.metabolism), 1, 10),
    camouflage: clamp(Math.round(2 + (1 - features.colorDiversity) * 4 + features.fillRatio * 4 + persona.mods.camouflage), 1, 10),
    sociality: clamp(Math.round(2 + features.symmetry * 6 + persona.mods.sociality), 1, 10),
    habitat,
    habitats,
    abilityTag,
    uniqueAbility,
    abilityProfile: inferAbilityProfile({
      tag: abilityTag,
      uniqueAbility,
      role,
      habitats,
      features
    })
  };

  return {
    status,
    narrative: `${name} は ${status.role} と判定されました。名前由来の個性(${persona.traits.join('・') || '環境順応'})と見た目特徴から ${habitats.join('・')} の複数適性を持つと推定しています。`
  };
}

async function analyzeAnimalWithLLM({ name, features, existingAbilityTexts = [], existingNames = [], existingAbilityTags = [] }) {
  const client = maybeCreateClient();
  if (!client) return fallbackStatus(name, features, { existingAbilityTexts, existingAbilityTags });

  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
  const namePersona = inferNamePersonality(name);
  const existingAbilities = Array.isArray(existingAbilityTexts) ? existingAbilityTexts.slice(-24) : [];
  const existingNameRows = Array.isArray(existingNames) ? existingNames.slice(-24) : [];
  const prompt = `You are an ecosystem simulation AI.\nReturn STRICT JSON with keys: status, narrative.\nUse both the animal name and the drawing features to infer ecology. Name-derived personality must have visible influence on stats and ability choice.\nstatus keys: role(carnivore|herbivore|omnivore), speed, attack, defense, fertility, metabolism, camouflage, sociality (all integer 1-10), habitat(primary habitat), habitats(array of 1-4 biomes from [land, forest, grass, shore, swamp, water, soil, rock, mountain, cave, sky, underground]), abilityTag(burst_speed|aquatic_heal|sky_drift|thick_hide|fertile_aura|predator_focus|terrain_breaker), uniqueAbility(string in Japanese, exactly one ability, max 70 chars), abilityProfile(object with mobility, regen, resilience, fertility, aggression, terraforming each -0.4..1.0).\nConstraints: uniqueAbility must not duplicate Existing abilities list. Avoid repeating overused abilityTag from existing tags when another suitable tag exists.\nName persona hint JSON: ${JSON.stringify(namePersona)}\nExisting abilities: ${JSON.stringify(existingAbilities)}\nExisting species names: ${JSON.stringify(existingNameRows)}\nExisting ability tags: ${JSON.stringify(existingAbilityTags)}\nDrawing feature object: ${JSON.stringify(features)}\nAnimal name: ${name}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You output only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw || '{}');
    const src = parsed.status || {};
    const existingSet = normalizeAbilitySet(existingAbilityTexts);
    const parsedHabitats = normalizeHabitatList(src.habitats);
    const role = ['carnivore', 'herbivore', 'omnivore'].includes(src.role) ? src.role : 'omnivore';
    const habitats = parsedHabitats.length > 0 ? parsedHabitats : composeHabitats(name, features);
    const abilityTag = ['burst_speed', 'aquatic_heal', 'sky_drift', 'thick_hide', 'fertile_aura', 'predator_focus', 'terrain_breaker'].includes(src.abilityTag)
      ? src.abilityTag
      : pickAbilityTag(name, features, role, habitats, { existingAbilityTags });
    const uniqueRaw = typeof src.uniqueAbility === 'string' && src.uniqueAbility.trim().length > 0
      ? src.uniqueAbility.trim().slice(0, 70)
      : japaneseAbilityText(abilityTag);
    const uniqueAbility = ensureUniqueAbilityText(uniqueRaw, name, existingSet);
    const parsedProfile = src.abilityProfile && typeof src.abilityProfile === 'object' ? src.abilityProfile : {};
    const fallbackProfile = inferAbilityProfile({
      tag: abilityTag,
      uniqueAbility,
      role,
      habitats,
      features
    });
    const abilityProfile = {
      mobility: clamp(Number(parsedProfile.mobility), -0.4, 1),
      regen: clamp(Number(parsedProfile.regen), -0.4, 1),
      resilience: clamp(Number(parsedProfile.resilience), -0.4, 1),
      fertility: clamp(Number(parsedProfile.fertility), -0.4, 1),
      aggression: clamp(Number(parsedProfile.aggression), -0.4, 1),
      terraforming: clamp(Number(parsedProfile.terraforming), -0.4, 1)
    };
    if (Number.isNaN(abilityProfile.mobility)) abilityProfile.mobility = fallbackProfile.mobility;
    if (Number.isNaN(abilityProfile.regen)) abilityProfile.regen = fallbackProfile.regen;
    if (Number.isNaN(abilityProfile.resilience)) abilityProfile.resilience = fallbackProfile.resilience;
    if (Number.isNaN(abilityProfile.fertility)) abilityProfile.fertility = fallbackProfile.fertility;
    if (Number.isNaN(abilityProfile.aggression)) abilityProfile.aggression = fallbackProfile.aggression;
    if (Number.isNaN(abilityProfile.terraforming)) abilityProfile.terraforming = fallbackProfile.terraforming;
    const status = {
      role,
      speed: clamp(Number(src.speed) || 5, 1, 10),
      attack: clamp(Number(src.attack) || 5, 1, 10),
      defense: clamp(Number(src.defense) || 5, 1, 10),
      fertility: clamp(Number(src.fertility) || 5, 1, 10),
      metabolism: clamp(Number(src.metabolism) || 5, 1, 10),
      camouflage: clamp(Number(src.camouflage) || 5, 1, 10),
      sociality: clamp(Number(src.sociality) || 5, 1, 10),
      habitat: ['land', 'shore', 'sky', 'water', 'underground'].includes(src.habitat) ? src.habitat : (habitats[0] || 'land'),
      habitats,
      abilityTag,
      uniqueAbility,
      abilityProfile
    };

    return {
      status,
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative : `${name} は環境に適応した個体として解析されました。`
    };
  } catch {
    return fallbackStatus(name, features, { existingAbilityTexts, existingAbilityTags });
  }
}

function fallbackEnvironment(input) {
  const state = input?.environment || {};
  const species = Array.isArray(input?.species) ? input.species : [];
  const pop = species.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  const carn = species.filter((s) => s.role === 'carnivore').reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  const herb = species.filter((s) => s.role === 'herbivore').reduce((sum, s) => sum + (Number(s.count) || 0), 0);

  const pressure = pop <= 0 ? 0 : carn / pop;
  const graze = pop <= 0 ? 0 : herb / pop;
  const weatherShift = (Math.random() - 0.5) * 6;

  const materials = [];
  if (pop > 0) {
    if (pressure > 0.35) {
      materials.push({
        name: '捕食フェロモン',
        state: 'gas',
        source: 'predator_cluster',
        effect: '危険度を高める'
      });
    }
    if (graze > 0.45) {
      materials.push({
        name: '発酵バイオマス',
        state: 'slurry',
        source: 'herbivore_waste',
        effect: '植生の再生に影響'
      });
    }
    if ((state.water ?? 60) > 68) {
      materials.push({
        name: '鉱化スラリー',
        state: 'liquid',
        source: 'wet_soil_reaction',
        effect: '地表の硬化を促進'
      });
    }
  }

  return {
    temperature: clamp((state.temperature ?? 20) + weatherShift + (pop > 80 ? 1.2 : -0.4), -10, 45),
    vegetation: clamp((state.vegetation ?? 55) + 2 - graze * 8 + weatherShift * 0.3, 0, 100),
    water: clamp((state.water ?? 60) + 1 + weatherShift * 0.5 - pressure * 2, 0, 100),
    danger: clamp((state.danger ?? 30) - 1 + pressure * 7 + Math.max(0, 35 - (state.water ?? 50)) * 0.05, 0, 100),
    event: pressure > 0.45 ? 'predator_surge' : graze > 0.5 ? 'overgrazing' : weatherShift > 2 ? 'warm_front' : weatherShift < -2 ? 'cold_snap' : 'stable',
    eventText: 'Fallback AI updated ecosystem by local rules.',
    materials: materials.slice(0, 3)
  };
}

async function nextEnvironmentWithLLM(input) {
  const client = maybeCreateClient();
  if (!client) return fallbackEnvironment(input);

  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
  const prompt = `You are ecosystem director AI.\nInput JSON: ${JSON.stringify(input)}\nReturn STRICT JSON with keys temperature(-10..45), vegetation(0..100), water(0..100), danger(0..100), event(snake_case short), eventText(max 80 chars), materials(array up to 3).\nEach materials item keys: name(Japanese string <= 24 chars), state(solid|liquid|gas|gel|slurry), source(short snake_case), effect(Japanese <= 40 chars).\nMaterials must be plausible outputs caused by current creatures and environment.`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Output only valid JSON. Keep ecology plausible and gradual.' },
        { role: 'user', content: prompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw || '{}');
    const materialRows = Array.isArray(parsed.materials) ? parsed.materials : [];
    const materials = materialRows.slice(0, 3).map((m) => ({
      name: typeof m?.name === 'string' ? m.name.trim().slice(0, 24) : '未命名物質',
      state: ['solid', 'liquid', 'gas', 'gel', 'slurry'].includes(m?.state) ? m.state : 'solid',
      source: typeof m?.source === 'string' ? m.source.trim().slice(0, 28) : 'unknown_source',
      effect: typeof m?.effect === 'string' ? m.effect.trim().slice(0, 40) : '生態系へ影響を与える'
    }));

    return {
      temperature: clamp(Number(parsed.temperature) || 20, -10, 45),
      vegetation: clamp(Number(parsed.vegetation) || 55, 0, 100),
      water: clamp(Number(parsed.water) || 60, 0, 100),
      danger: clamp(Number(parsed.danger) || 30, 0, 100),
      event: typeof parsed.event === 'string' ? parsed.event : 'stable',
      eventText: typeof parsed.eventText === 'string' ? parsed.eventText : 'AI adjusted conditions.',
      materials
    };
  } catch {
    return fallbackEnvironment(input);
  }
}

module.exports = {
  analyzeAnimalWithLLM,
  nextEnvironmentWithLLM
};
