/* ============================================================
 * Web Swinger 1.0 — camera.js
 * Smooth-follow camera with velocity lookahead and speed-based
 * zoom-out. Exposes world-edge helpers for culling.
 * ============================================================ */

class Camera {
  constructor() {
    this.x = 0; this.y = 0;       // world point at screen center
    this.zoom = CONFIG.CAM_ZOOM_MAX;
    this.viewW = 1920; this.viewH = 1080; // CSS pixels
  }

  resize(w, h) { this.viewW = w; this.viewH = h; }

  /** Scale from world units to CSS pixels (floored for short screens). */
  get scale() {
    return Math.max(this.zoom * (this.viewH / CONFIG.REF_VIEW_HEIGHT),
      CONFIG.CAM_MIN_SCALE);
  }
  get worldLeft() { return this.x - (this.viewW / 2) / this.scale; }
  get worldRight() { return this.x + (this.viewW / 2) / this.scale; }
  get worldTop() { return this.y - (this.viewH / 2) / this.scale; }
  get worldBottom() { return this.y + (this.viewH / 2) / this.scale; }

  snapTo(x, y) { this.x = x; this.y = y; }

  update(dt, px, py, vx, vy) {
    const speed = Math.hypot(vx, vy);

    // Look ahead of the velocity so the player sees what's coming.
    const targetX = px + vx * CONFIG.CAM_LOOKAHEAD + 140;
    const targetY = clamp(
      py + vy * CONFIG.CAM_LOOKAHEAD * 0.4 - 60,
      -400,
      CONFIG.GROUND_Y - (this.viewH / 2) / this.scale + 120
    );

    const k = damp(CONFIG.CAM_SMOOTH, dt);
    this.x += (targetX - this.x) * k;
    this.y += (targetY - this.y) * k;

    // Zoom out as speed rises; ease slowly so it never pops.
    const speedT = clamp(speed / CONFIG.CAM_ZOOM_SPEED_REF, 0, 1);
    const targetZoom = lerp(CONFIG.CAM_ZOOM_MAX, CONFIG.CAM_ZOOM_MIN, speedT);
    this.zoom += (targetZoom - this.zoom) * damp(1.8, dt);
  }

  /** Push the world transform (with shake) onto the context. */
  apply(ctx, shakeX, shakeY) {
    ctx.save();
    const s = this.scale;
    ctx.translate(this.viewW / 2 + shakeX, this.viewH / 2 + shakeY);
    ctx.scale(s, s);
    ctx.translate(-this.x, -this.y);
  }

  pop(ctx) { ctx.restore(); }
}
