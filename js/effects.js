/* ============================================================
 * Web Swinger 1.0 — effects.js
 * Pooled particles (world space), screen shake, speed lines,
 * full-screen flashes. Zero allocation during play.
 * ============================================================ */

class Effects {
  constructor() {
    this.particles = new Pool(() => ({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
      size: 2, color: '#fff', gravity: 0, fade: true,
    }), 400);

    this.speedLines = new Pool(() => ({ x: 0, y: 0, len: 0, life: 0 }), 40);

    this.shakeAmp = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.flash = 0; this.flashColor = '#ff3b4e';
    this.shakeEnabled = true;
    this.reducedFlash = false;
  }

  spawn(x, y, vx, vy, life, size, color, gravity = 0) {
    const p = this.particles.obtain();
    if (!p) return;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size;
    p.color = color; p.gravity = gravity;
  }

  burst(x, y, count, speed, color, life = 0.6, gravity = 900) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5),
        2 + Math.random() * 4, color, gravity);
    }
  }

  /** Sparks flying opposite the movement direction (web attach, grazes). */
  sparks(x, y, dirX, dirY, count, color) {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const cos = Math.cos(spread), sin = Math.sin(spread);
      const vx = (dirX * cos - dirY * sin) * (200 + Math.random() * 300);
      const vy = (dirX * sin + dirY * cos) * (200 + Math.random() * 300);
      this.spawn(x, y, vx, vy, 0.35, 2, color, 600);
    }
  }

  deathExplosion(x, y, skin) {
    this.burst(x, y, 26, 700, skin.suit, 0.9);
    this.burst(x, y, 14, 500, skin.accent, 0.7);
    this.burst(x, y, 10, 350, '#ffffff', 0.5);
    this.shake(CONFIG.SHAKE_DEATH);
    this.doFlash('#ff3b4e', 0.35);
  }

  shake(amp) {
    if (!this.shakeEnabled) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  doFlash(color, strength) {
    if (this.reducedFlash) strength *= 0.25;
    this.flashColor = color;
    this.flash = Math.max(this.flash, strength);
  }

  addSpeedLine(W, H) {
    const l = this.speedLines.obtain();
    if (!l) return;
    l.x = W + 50;
    l.y = Math.random() * H;
    l.len = 80 + Math.random() * 200;
    l.life = 1;
  }

  update(dt, playerSpeed, W, H) {
    // Particles.
    const pp = this.particles;
    for (let i = pp.count - 1; i >= 0; i--) {
      const p = pp.items[i];
      p.life -= dt;
      if (p.life <= 0) { pp.release(i); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Speed lines only appear when the player is really moving.
    if (playerSpeed > 1050 && Math.random() < (playerSpeed - 1050) / 900) {
      this.addSpeedLine(W, H);
    }
    const sl = this.speedLines;
    for (let i = sl.count - 1; i >= 0; i--) {
      const l = sl.items[i];
      l.x -= (playerSpeed * 1.4) * dt;
      l.life -= dt * 1.4;
      if (l.life <= 0 || l.x + l.len < 0) sl.release(i);
    }

    // Shake decay + fresh offset.
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 60);
    this.shakeX = (Math.random() - 0.5) * this.shakeAmp;
    this.shakeY = (Math.random() - 0.5) * this.shakeAmp;

    this.flash = Math.max(0, this.flash - dt * 1.8);
  }

  /** World-space particles (call inside camera transform). */
  drawWorld(ctx) {
    const pp = this.particles;
    for (let i = 0; i < pp.count; i++) {
      const p = pp.items[i];
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /** Screen-space overlays (call after camera transform is popped). */
  drawScreen(ctx, W, H) {
    const sl = this.speedLines;
    if (sl.count) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < sl.count; i++) {
        const l = sl.items[i];
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + l.len, l.y);
      }
      ctx.stroke();
    }
    if (this.flash > 0.01) {
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // Subtle vignette for focus.
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  clear() {
    this.particles.clear();
    this.speedLines.clear();
    this.shakeAmp = 0; this.flash = 0;
  }
}
