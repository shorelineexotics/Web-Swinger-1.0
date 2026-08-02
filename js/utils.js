/* ============================================================
 * Web Swinger 1.0 — utils.js
 * Math helpers, seeded RNG, geometry tests, object pool.
 * ============================================================ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Exponential smoothing factor that is framerate independent. */
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/* --- Seeded RNG (mulberry32) --------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Convenience wrapper around a seeded stream. */
class Rng {
  constructor(seed) { this.next = mulberry32(seed); }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

/* --- Geometry -------------------------------------------------- */

/** Circle vs axis-aligned rect. Rect given as x, y (top-left), w, h. */
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return dist2(cx, cy, nx, ny) < r * r;
}

/** Distance from circle center to rect surface (0 if inside). */
function circleRectDist(cx, cy, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return distance(cx, cy, nx, ny);
}

/** Distance from a point to a line segment. */
function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return distance(px, py, x1 + dx * t, y1 + dy * t);
}

/* --- Object pool ------------------------------------------------
 * Fixed-capacity pool with swap-remove iteration. Objects carry an
 * `active` flag; the pool hands out dead slots first.               */
class Pool {
  constructor(factory, capacity) {
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
    this.count = 0; // active items live in [0, count)
  }
  /** Get a slot to (re)initialize, or null if the pool is full. */
  obtain() {
    if (this.count >= this.items.length) return null;
    return this.items[this.count++];
  }
  /** Release the item at active-index i (swap-remove, O(1)). */
  release(i) {
    this.count--;
    const tmp = this.items[i];
    this.items[i] = this.items[this.count];
    this.items[this.count] = tmp;
  }
  clear() { this.count = 0; }
}

/** Format meters like "1,234m". */
function fmtMeters(m) {
  return Math.floor(m).toLocaleString('en-US') + 'm';
}
