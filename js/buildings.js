/* ============================================================
 * Web Swinger 1.0 — buildings.js
 * Endless, seeded, procedurally generated city. Buildings are
 * created just ahead of the camera and recycled once they fall
 * behind it. Roof corners carry glowing anchor nodes the web can
 * attach to. Touching a building kills the player.
 * ============================================================ */

const BLD_PALETTES = [
  { wall: '#2b2436', edge: '#4a3f5e', win: '#ffd66b', winOff: '#171223' },
  { wall: '#232a3d', edge: '#3d4a68', win: '#7be8ff', winOff: '#141a29' },
  { wall: '#33222c', edge: '#57394a', win: '#ff9e6b', winOff: '#1d1219' },
  { wall: '#1f2b2b', edge: '#3a5250', win: '#8fff9e', winOff: '#121a1a' },
  { wall: '#2e2338', edge: '#503d63', win: '#ff6bd5', winOff: '#190f21' },
];

class Building {
  constructor() { this.reset(0, 0, 0); }
  reset(x, w, top, rng, easy, diff = 0) {
    this.x = x; this.w = w; this.top = top;
    this.hazardsDone = false;
    this.palette = rng ? rng.pick(BLD_PALETTES) : BLD_PALETTES[0];
    this.winSeed = rng ? rng.int(0, 1e9) : 1;
    this.winCols = Math.max(2, Math.floor(w / 46));
    this.winRows = Math.max(2, Math.floor((CONFIG.GROUND_Y - top) / 52));
    this.roofStyle = rng ? rng.int(0, 2) : 0; // 0 flat, 1 ledge, 2 water tower
    // The whole roof edge is a web surface — the exact grab point is
    // picked at fire time anywhere along the top of the building.
  }
  get right() { return this.x + this.w; }
}

class BuildingField {
  constructor(seed) {
    this.rng = new Rng(seed);
    this.buildings = [];
    this.pool = [];
    this._cursor = 0; // world x where the next building starts
  }

  reset(seed) {
    this.rng = new Rng(seed);
    this.pool.push(...this.buildings);
    this.buildings.length = 0;
    this._cursor = 0;
    // Starting tower: the player stands on its top-right corner. It is
    // shorter than the warmup band ahead, so the next roofs are always
    // above the standing player and the first web has a target.
    this._spawn(60, 460, CONFIG.GROUND_Y - 520, true);
  }

  _spawn(x, w, top, easy, diff = 0) {
    const b = this.pool.pop() || new Building();
    b.reset(x, w, top, this.rng, easy, diff);
    this.buildings.push(b);
    this._cursor = x + w;
    return b;
  }

  /** Keep the strip populated ahead of the camera; recycle behind it. */
  update(camLeft, camRight, meters) {
    const diff = difficultyAt(meters);

    while (this._cursor < camRight + 900) {
      const prev = this.buildings[this.buildings.length - 1];
      const easy = meters < CONFIG.EASY_START_METERS;

      const gapMax = easy ? CONFIG.BLD_GAP_MAX_EASY
        : lerp(CONFIG.BLD_GAP_MAX_EASY, CONFIG.BLD_GAP_MAX_HARD, diff);
      const gap = this.rng.float(CONFIG.BLD_GAP_MIN, gapMax);

      const w = this.rng.float(CONFIG.BLD_WIDTH_MIN, CONFIG.BLD_WIDTH_MAX);

      // Roof height wanders relative to the previous roof so jumps stay fair.
      const hVar = easy ? 90 : lerp(CONFIG.BLD_HVAR_EASY, CONFIG.BLD_HVAR_HARD, diff);
      const prevTop = prev ? prev.top : CONFIG.GROUND_Y - 520;
      let top = prevTop + this.rng.float(-hVar, hVar);
      top = clamp(top, CONFIG.GROUND_Y - CONFIG.BLD_HEIGHT_MAX, CONFIG.GROUND_Y - CONFIG.BLD_HEIGHT_MIN);
      // Warmup stretch: tall buildings whose roofs sit comfortably
      // above the opening glide, so the first grabs are effortless.
      if (easy) top = clamp(top, CONFIG.GROUND_Y - 700, CONFIG.GROUND_Y - 620);

      this._spawn(this._cursor + gap, w, top, easy, diff);
    }

    // Recycle buildings that scrolled off the left edge.
    while (this.buildings.length && this.buildings[0].right < camLeft - 400) {
      this.pool.push(this.buildings.shift());
    }
  }

  /**
   * Best web grab point for a player at (px, py), or null.
   * The web can stick anywhere along a roof's top edge, so each roof
   * above the player is sampled at a few forward offsets and the
   * best-scoring point wins.
   * `rescue` widens the search (longer reach, slightly-behind grabs
   * allowed) — used as a fallback when the player is diving.
   */
  findAnchor(px, py, rescue = false) {
    const range = rescue ? CONFIG.RESCUE_RANGE : CONFIG.WEB_RANGE;
    const behind = rescue ? CONFIG.RESCUE_BEHIND : 40;
    const lenCap = rescue ? CONFIG.RESCUE_RANGE : CONFIG.WEB_MAX_LEN;
    let best = null, bestScore = -Infinity;
    for (const b of this.buildings) {
      if (b.x > px + range) break;
      if (b.right < px - behind - 20) continue;
      if (b.top > py - 30) continue;           // roof must be above us
      const dy = b.top - py;
      for (const off of [-120, 40, 160, 280, 400]) {
        const ax = clamp(px + off, b.x + 8, b.right - 8);
        const dx = ax - px;
        if (dx < -behind) continue;            // how far behind is legal
        const d = Math.hypot(dx, dy);
        if (d > range || d < 60) continue;
        // A rope this long would swing the player into the street.
        if (b.top + Math.min(d, lenCap) > CONFIG.GROUND_Y - 130) continue;
        // Prefer points ahead at a comfortable rope length.
        const score = dx - Math.abs(d - 260) * 0.8 + (-dy) * 0.3;
        if (score > bestScore) { bestScore = score; best = { x: ax, y: b.top - 4 }; }
      }
    }
    return best;
  }

  draw(ctx, camLeft, camRight, night, beatPulse, colorblind) {
    for (const b of this.buildings) {
      if (b.right < camLeft || b.x > camRight) continue;
      const p = b.palette;
      const h = CONFIG.GROUND_Y - b.top;

      // Body + lit edge.
      ctx.fillStyle = p.wall;
      ctx.fillRect(b.x, b.top, b.w, h);
      ctx.fillStyle = p.edge;
      ctx.fillRect(b.x, b.top, b.w, 6);
      ctx.fillRect(b.x, b.top, 5, h);

      // Windows (seeded pattern, brighter at night, pulse on the beat).
      const winRng = mulberry32(b.winSeed);
      const cw = b.w / b.winCols, ch = h / b.winRows;
      const glow = night * 0.85 + 0.15 + beatPulse * 0.12;
      for (let cxi = 0; cxi < b.winCols; cxi++) {
        for (let ryi = 0; ryi < b.winRows; ryi++) {
          const lit = winRng() < (0.28 + night * 0.3);
          const wx = b.x + cxi * cw + cw * 0.26;
          const wy = b.top + 14 + ryi * ch + ch * 0.2;
          if (wy > CONFIG.GROUND_Y - 24) continue;
          ctx.fillStyle = lit ? p.win : p.winOff;
          ctx.globalAlpha = lit ? glow : 1;
          ctx.fillRect(wx, wy, cw * 0.42, ch * 0.44);
          ctx.globalAlpha = 1;
        }
      }

      // Roof furniture (visual only, not deadly).
      if (b.roofStyle === 1) {
        ctx.fillStyle = p.edge;
        ctx.fillRect(b.x - 6, b.top - 8, b.w + 12, 8);
      } else if (b.roofStyle === 2) {
        ctx.fillStyle = '#3a3140';
        ctx.fillRect(b.x + b.w * 0.55, b.top - 34, 42, 34);
        ctx.fillStyle = '#2a2230';
        ctx.fillRect(b.x + b.w * 0.55 - 4, b.top - 40, 50, 8);
      }

      // Glowing roof edge — the whole strip is a web surface.
      ctx.fillStyle = colorblind ? '#4fc3ff' : '#ffe36b';
      ctx.globalAlpha = 0.55 + beatPulse * 0.35;
      ctx.fillRect(b.x, b.top - 3, b.w, 3);
      ctx.globalAlpha = 1;
    }

    // Street.
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(camLeft, CONFIG.GROUND_Y, camRight - camLeft, 400);
    ctx.fillStyle = '#241d31';
    ctx.fillRect(camLeft, CONFIG.GROUND_Y, camRight - camLeft, 8);
  }
}
