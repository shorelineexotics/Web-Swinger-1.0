/* ============================================================
 * Web Swinger 1.0 — background.js
 * Sky gradient with a sunset -> night -> dawn cycle driven by
 * distance, sun/moon, stars, animated clouds, and two parallax
 * skyline layers. Everything is seeded and allocation-free per
 * frame.
 * ============================================================ */

// Sky palettes: [topColor, bottomColor] as rgb arrays. Cycle order:
// sunset -> dusk -> night -> dawn -> back to sunset.
const SKY_STOPS = [
  { top: [38, 22, 66],  bot: [244, 110, 66] },  // sunset
  { top: [22, 14, 48],  bot: [120, 52, 92] },   // dusk
  { top: [8, 8, 26],    bot: [30, 22, 58] },    // night
  { top: [20, 24, 60],  bot: [235, 150, 100] }, // dawn
];

function lerpColor(a, b, t) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

class Background {
  constructor(seed) {
    this.rng = new Rng(seed ^ 0x9e3779b9);
    // Pre-generate far and mid skyline silhouettes as repeating strips.
    this.farStrip = this._makeStrip(3000, 60, 180, 90, 320);
    this.midStrip = this._makeStrip(3600, 90, 260, 160, 480);
    // Clouds: fixed set that wraps around the view.
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      this.clouds.push({
        x: this.rng.float(0, 4000),
        y: this.rng.float(60, 420),
        w: this.rng.float(140, 380),
        h: this.rng.float(22, 48),
        speed: this.rng.float(4, 14),
      });
    }
    // Stars.
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: this.rng.float(0, 2000),
        y: this.rng.float(0, 500),
        r: this.rng.float(0.7, 2),
        tw: this.rng.float(0, Math.PI * 2),
      });
    }
  }

  _makeStrip(period, minW, maxW, minH, maxH) {
    const seg = [];
    let x = 0;
    while (x < period) {
      const w = this.rng.float(minW, maxW);
      seg.push({ x, w, h: this.rng.float(minH, maxH) });
      x += w + this.rng.float(10, 60);
    }
    return { period, seg };
  }

  /** cycle t in [0,1) -> sky colors + night factor (0 day-ish, 1 full night). */
  skyAt(t) {
    const n = SKY_STOPS.length;
    const f = t * n;
    const i = Math.floor(f) % n;
    const j = (i + 1) % n;
    const k = f - Math.floor(f);
    return {
      top: lerpColor(SKY_STOPS[i].top, SKY_STOPS[j].top, k),
      bot: lerpColor(SKY_STOPS[i].bot, SKY_STOPS[j].bot, k),
      night: [0.35, 0.8, 1.0, 0.3][i] * (1 - k) + [0.35, 0.8, 1.0, 0.3][j] * k,
    };
  }

  /**
   * Draw in SCREEN space (called before the camera transform).
   * camX/camY are camera world coords; W/H is canvas CSS size.
   */
  draw(ctx, camX, camY, W, H, meters, time, beatPulse) {
    const t = (meters % CONFIG.CYCLE_METERS) / CONFIG.CYCLE_METERS;
    const sky = this.skyAt(t);
    this.night = sky.night;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars fade in at night, twinkle gently.
    if (sky.night > 0.4) {
      const a = (sky.night - 0.4) / 0.6;
      for (const s of this.stars) {
        const sx = (s.x - camX * 0.02) % W; const px = sx < 0 ? sx + W : sx;
        ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + s.tw)));
        ctx.fillStyle = '#fff';
        ctx.fillRect(px, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }

    // Sun / moon arc across the cycle.
    const orbT = t * Math.PI * 2;
    const ox = W * 0.5 + Math.cos(orbT) * W * 0.42;
    const oy = H * 0.55 - Math.sin(orbT) * H * 0.42;
    const isSun = t < 0.25 || t > 0.75;
    ctx.beginPath();
    ctx.arc(ox, oy, isSun ? 46 : 30, 0, Math.PI * 2);
    ctx.fillStyle = isSun ? '#ffcf5e' : '#e8ecff';
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 0.18 + beatPulse * 0.08;
    ctx.beginPath();
    ctx.arc(ox, oy, isSun ? 78 : 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Clouds (slow drift + parallax).
    ctx.fillStyle = sky.night > 0.6 ? 'rgba(60,60,95,0.55)' : 'rgba(255,220,200,0.30)';
    for (const c of this.clouds) {
      let cx = (c.x + time * c.speed - camX * 0.06) % (W + 500) - 250;
      if (cx < -260) cx += W + 500;
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + c.w * 0.25, c.y - c.h * 0.3, c.w / 3, c.h / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Parallax skylines (screen-space horizon anchored near the bottom).
    const horizon = H * 0.86;
    this._drawStrip(ctx, this.farStrip, camX * 0.12, horizon, W,
      sky.night > 0.5 ? '#141126' : 'rgba(40,26,60,0.85)', 0.55);
    this._drawStrip(ctx, this.midStrip, camX * 0.28, horizon + 12, W,
      sky.night > 0.5 ? '#1b1633' : 'rgba(52,32,74,0.95)', 0.8, sky.night, beatPulse);
  }

  _drawStrip(ctx, strip, scrollX, baseY, W, color, hScale, night = 0, beatPulse = 0) {
    ctx.fillStyle = color;
    const p = strip.period;
    let off = -(scrollX % p);
    if (off > 0) off -= p;
    for (let rep = 0; off + rep * p < W; rep++) {
      for (const s of strip.seg) {
        const x = off + rep * p + s.x;
        if (x + s.w < 0 || x > W) continue;
        const h = s.h * hScale;
        ctx.fillRect(x, baseY - h, s.w, h);
        // Sparse lit windows on the mid layer at night.
        if (night > 0.45 && s.w > 100) {
          ctx.fillStyle = `rgba(255,214,107,${0.25 + beatPulse * 0.2})`;
          ctx.fillRect(x + s.w * 0.2, baseY - h + 18, 6, 6);
          ctx.fillRect(x + s.w * 0.6, baseY - h + 44, 6, 6);
          ctx.fillStyle = color;
        }
      }
    }
  }
}
