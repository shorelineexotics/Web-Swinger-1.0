/* ============================================================
 * Web Swinger 1.0 — storage.js
 * localStorage-backed save data: high scores, settings, skins,
 * achievements, daily-challenge bests.
 * ============================================================ */

const SAVE_KEY = 'webswinger.save.v1';

const DEFAULT_SAVE = {
  best: 0,                 // best distance (m), normal mode
  bestDaily: { date: '', score: 0 },
  totalMeters: 0,
  runs: 0,
  deaths: 0,
  bestCombo: 0,
  settings: {
    musicVol: 0.7,
    sfxVol: 0.9,
    screenShake: true,
    colorblind: false,
    reducedFlash: false,
  },
  skin: 'classic',
  unlockedSkins: ['classic'],
  achievements: {},        // id -> true
};

const Storage = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      // Deep-merge onto defaults so new fields survive old saves.
      this.data = {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) },
        bestDaily: { ...DEFAULT_SAVE.bestDaily, ...(parsed.bestDaily || {}) },
      };
    } catch (e) {
      this.data = structuredClone(DEFAULT_SAVE);
    }
    return this.data;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch (e) { /* private browsing / quota — play on without saving */ }
  },

  /** Record a finished run. Returns { newBest } */
  recordRun(meters, combo, daily) {
    const d = this.data;
    d.runs++; d.deaths++;
    d.totalMeters += meters;
    d.bestCombo = Math.max(d.bestCombo, combo);
    let newBest = false;
    if (daily) {
      const today = todayKey();
      if (d.bestDaily.date !== today) d.bestDaily = { date: today, score: 0 };
      if (meters > d.bestDaily.score) { d.bestDaily.score = meters; newBest = true; }
    } else if (meters > d.best) {
      d.best = meters; newBest = true;
    }
    this.save();
    return { newBest };
  },

  bestFor(daily) {
    if (!daily) return this.data.best;
    return this.data.bestDaily.date === todayKey() ? this.data.bestDaily.score : 0;
  },

  unlockSkin(id) {
    if (!this.data.unlockedSkins.includes(id)) {
      this.data.unlockedSkins.push(id);
      this.save();
      return true;
    }
    return false;
  },

  unlockAchievement(id) {
    if (!this.data.achievements[id]) {
      this.data.achievements[id] = true;
      this.save();
      return true;
    }
    return false;
  },
};

/** Local-date key like "2026-07-26" — also seeds the daily challenge. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* --- Skins ------------------------------------------------------ */
const SKINS = [
  { id: 'classic', name: 'Classic',  suit: '#d42a2a', accent: '#2a3fd4', scarf: '#3a56ff', unlock: 'Default' },
  { id: 'crimson', name: 'Crimson',  suit: '#8f0f1f', accent: '#1a1a22', scarf: '#c01030', unlock: 'Reach 500m' },
  { id: 'gold',    name: 'Gilded',   suit: '#e0a51b', accent: '#7a4a08', scarf: '#ffd964', unlock: 'Reach 1,000m' },
  { id: 'neon',    name: 'Neon',     suit: '#18e07a', accent: '#0a3d2a', scarf: '#6bffb8', unlock: 'Hit a x10 combo' },
  { id: 'noir',    name: 'Noir',     suit: '#20242c', accent: '#4a5262', scarf: '#8a94a8', unlock: 'Fall 25 times' },
  { id: 'ghost',   name: 'Ghost',    suit: '#cfd8ea', accent: '#8fa0c0', scarf: '#ffffff', unlock: 'Play a Daily Challenge' },
];

function getSkin(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
