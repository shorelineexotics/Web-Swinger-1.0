/* ============================================================
 * Web Swinger 1.0 — player.js
 * The swinger: pendulum rope physics, web fire/attach/release,
 * verlet scarf, motion trail, flips, and the pixel-hero sprite
 * drawn procedurally so skins are pure palette swaps.
 * ============================================================ */

const WEB_STATE = { NONE: 0, FIRING: 1, ATTACHED: 2 };

class Player {
  constructor() {
    this.trail = new Array(14).fill(null).map(() => ({ x: 0, y: 0 }));
    this.scarf = new Array(7).fill(null).map(() => ({ x: 0, y: 0, px: 0, py: 0 }));
    this.reset();
  }

  reset() {
    this.x = CONFIG.PLAYER_START_X;
    this.y = CONFIG.PLAYER_START_Y;
    this.vx = 0;               // standing still until the first web
    this.vy = 0;
    this.alive = true;
    this.started = false;        // gravity off until the first web
    this.rot = 0;                // visual rotation
    this.spin = 0;               // flip speed after release
    this.web = { state: WEB_STATE.NONE, ax: 0, ay: 0, len: 0, t: 0 };
    this.timeSinceRelease = 99;
    this.timeAttached = 0;
    for (const t of this.trail) { t.x = this.x; t.y = this.y; }
    for (const s of this.scarf) { s.x = s.px = this.x; s.y = s.py = this.y; }
    this._trailTimer = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }
  get attached() { return this.web.state === WEB_STATE.ATTACHED; }

  /** Try to fire a web. Returns 'fired' | 'nothing'. */
  fireWeb(buildings) {
    if (this.web.state !== WEB_STATE.NONE || !this.alive) return 'nothing';
    const a = buildings.findAnchor(this.x, this.y);
    if (!a) return 'nothing';
    this.started = true;
    this.web.state = WEB_STATE.FIRING;
    this.web.ax = a.x; this.web.ay = a.y;
    this.web.t = 0;
    return 'fired';
  }

  releaseWeb() {
    if (this.web.state === WEB_STATE.NONE) return null;
    const wasAttached = this.web.state === WEB_STATE.ATTACHED;
    this.web.state = WEB_STATE.NONE;
    if (!wasAttached) return null;

    this.timeSinceRelease = 0;
    // Judge the release: rising fast = perfect.
    const perfect = this.vy < CONFIG.PERFECT_UP_VEL && this.speed > CONFIG.PERFECT_MIN_SPEED;
    const boost = perfect ? CONFIG.PERFECT_BOOST : CONFIG.RELEASE_BOOST;
    this.vx *= boost; this.vy *= boost;
    // Kick off a flip proportional to speed.
    this.spin = (this.speed > 800 ? 9 : 5) * (this.vy < 0 ? 1 : 0.4);
    return perfect ? 'perfect' : 'ok';
  }

  /** Physics step. Runs in substeps for rope stability. */
  update(dt, game) {
    if (!this.alive) return;

    // Pre-start: standing on the starting tower's corner. Nothing
    // moves until the first web fires and swings us off the ledge.
    if (!this.started) {
      this._cosmetics(dt);
      return;
    }

    const SUB = 2;
    const h = dt / SUB;
    for (let s = 0; s < SUB; s++) {
      if (this.web.state === WEB_STATE.FIRING) {
        this.web.t += h / CONFIG.WEB_FIRE_TIME;
        if (this.web.t >= 1) {
          this.web.state = WEB_STATE.ATTACHED;
          const d = distance(this.x, this.y, this.web.ax, this.web.ay);
          this.web.len = clamp(d, CONFIG.WEB_MIN_LEN, CONFIG.WEB_MAX_LEN);
          // Zip: a kick toward the anchor lifts the arc and starts the
          // reel-in, so swings ride high instead of skimming rooftops.
          if (d > 1) {
            this.vx += ((this.web.ax - this.x) / d) * CONFIG.WEB_ZIP;
            this.vy += ((this.web.ay - this.y) / d) * CONFIG.WEB_ZIP;
          }
          this.timeAttached = 0;
          game.onWebAttached();
        }
      }

      this.vy += CONFIG.GRAVITY * h;

      if (this.attached) {
        this.timeAttached += h;
        // Gentle forward help so swings keep pace with the scroll.
        this.vx += CONFIG.SWING_ASSIST * h;
      } else {
        // Light air drag for control without killing momentum.
        const drag = 1 - CONFIG.AIR_DRAG * h;
        this.vx *= drag; this.vy *= drag;
      }

      this.x += this.vx * h;
      this.y += this.vy * h;

      // Rope constraint. The web reels in: length tracks the closest
      // approach and never re-lengthens, so the rope is always taut —
      // no slack free-falls, and every grab turns into an arc.
      if (this.attached) {
        const dx = this.x - this.web.ax, dy = this.y - this.web.ay;
        const d = Math.hypot(dx, dy);
        if (d < this.web.len) this.web.len = Math.max(d, CONFIG.WEB_MIN_LEN);
        if (d > this.web.len && d > 0.0001) {
          const nx = dx / d, ny = dy / d;
          this.x = this.web.ax + nx * this.web.len;
          this.y = this.web.ay + ny * this.web.len;
          const vr = this.vx * nx + this.vy * ny;
          if (vr > 0) { this.vx -= vr * nx; this.vy -= vr * ny; }
        }
      }

      // Soft speed ceiling while attached: swing speeds stay controlled.
      // In free flight only the hard cap applies, so a release launch
      // keeps its velocity — flying off a swing should feel like a fling.
      const sp = this.speed;
      if (this.attached && sp > CONFIG.SOFT_SPEED) {
        const excess = sp - CONFIG.SOFT_SPEED;
        const target = CONFIG.SOFT_SPEED + excess * Math.exp(-CONFIG.SOFT_SPEED_DRAG * h);
        const k = Math.min(target, CONFIG.PLAYER_MAX_SPEED) / sp;
        this.vx *= k; this.vy *= k;
      } else if (sp > CONFIG.PLAYER_MAX_SPEED) {
        const k = CONFIG.PLAYER_MAX_SPEED / sp;
        this.vx *= k; this.vy *= k;
      }
    }

    this.timeSinceRelease += dt;
    this._cosmetics(dt);
  }

  _cosmetics(dt) {
    // Rotation: align to rope while swinging, flip after release,
    // otherwise lean into velocity.
    if (this.attached) {
      const dx = this.x - this.web.ax, dy = this.y - this.web.ay;
      this.rot = Math.atan2(dy, dx) - Math.PI / 2 + (this.vx >= 0 ? 0.4 : -0.4);
      this.spin = 0;
    } else if (this.spin > 0.1) {
      this.rot += this.spin * dt * (this.vx >= 0 ? 1 : -1);
      this.spin *= Math.pow(0.25, dt);   // flips wind down
    } else {
      const target = Math.atan2(this.vy, Math.abs(this.vx)) * 0.35;
      this.rot += (target - this.rot) * damp(6, dt);
    }

    // Motion trail ring buffer (~60Hz sampling).
    this._trailTimer += dt;
    if (this._trailTimer > 0.016) {
      this._trailTimer = 0;
      const last = this.trail.pop();
      last.x = this.x; last.y = this.y;
      this.trail.unshift(last);
    }

    // Verlet scarf trailing from the shoulders.
    const anchorX = this.x - Math.cos(this.rot) * 6;
    const anchorY = this.y - Math.sin(this.rot) * 6 - 6;
    const seg = 9;
    const s0 = this.scarf[0];
    s0.x = anchorX; s0.y = anchorY;
    for (let i = 1; i < this.scarf.length; i++) {
      const s = this.scarf[i];
      // Verlet integrate with gravity + a bit of flutter.
      const nx = s.x + (s.x - s.px) * 0.9;
      const ny = s.y + (s.y - s.py) * 0.9 + 24 * dt;
      s.px = s.x; s.py = s.y;
      s.x = nx + Math.sin(performance.now() * 0.02 + i) * 0.4;
      s.y = ny;
      // Constrain to previous point.
      const prev = this.scarf[i - 1];
      const dx = s.x - prev.x, dy = s.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > seg) {
        s.x = prev.x + (dx / d) * seg;
        s.y = prev.y + (dy / d) * seg;
      }
    }
  }

  draw(ctx, skin, time) {
    // Web line (drawn first, under the hero).
    if (this.web.state !== WEB_STATE.NONE) {
      const t = this.web.state === WEB_STATE.FIRING ? clamp(this.web.t, 0, 1) : 1;
      const ex = lerp(this.x, this.web.ax, t);
      const ey = lerp(this.y, this.web.ay, t);
      ctx.strokeStyle = 'rgba(240,244,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Slight sag while attached & slack-ish, straight while firing.
      ctx.moveTo(this.x, this.y - 4);
      if (this.attached) {
        const mx = (this.x + ex) / 2, my = (this.y + ey) / 2 + 4;
        ctx.quadraticCurveTo(mx, my, ex, ey);
      } else {
        ctx.lineTo(ex, ey);
      }
      ctx.stroke();
    }

    // Motion blur ghosts.
    const sp = this.speed;
    if (sp > 700) {
      const ghosts = Math.min(6, Math.floor((sp - 700) / 200) + 2);
      for (let i = ghosts; i >= 1; i--) {
        const g = this.trail[i * 2];
        if (!g) continue;
        ctx.globalAlpha = 0.10 * (1 - i / (ghosts + 1));
        ctx.fillStyle = skin.suit;
        ctx.fillRect(g.x - 8, g.y - 10, 16, 20);
      }
      ctx.globalAlpha = 1;
    }

    // Scarf.
    ctx.strokeStyle = skin.scarf;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.scarf[0].x, this.scarf[0].y);
    for (let i = 1; i < this.scarf.length; i++) ctx.lineTo(this.scarf[i].x, this.scarf[i].y);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Hero body — pixel blocks in local space.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const px = 4; // "pixel" size
    // Legs: straight when standing, tucked while swinging, dangling in air.
    ctx.fillStyle = skin.accent;
    if (!this.started) {
      ctx.fillRect(-1.4 * px, 2 * px, px, 2.6 * px);
      ctx.fillRect(0.4 * px, 2 * px, px, 2.6 * px);
    } else if (this.attached) {
      ctx.fillRect(-2 * px, 1 * px, px, 2 * px);
      ctx.fillRect(1 * px, 1.4 * px, px, 1.6 * px);
    } else {
      ctx.fillRect(-1.6 * px, 2 * px, px, 2.4 * px);
      ctx.fillRect(0.6 * px, 2 * px, px, 2.4 * px);
    }
    // Torso.
    ctx.fillStyle = skin.suit;
    ctx.fillRect(-1.5 * px, -1 * px, 3 * px, 3.2 * px);
    // Chest accent stripe.
    ctx.fillStyle = skin.accent;
    ctx.fillRect(-1.5 * px, 0.2 * px, 3 * px, 0.8 * px);
    // Arm reaching along the rope when attached; at sides when standing.
    ctx.fillStyle = skin.suit;
    if (this.attached || this.web.state === WEB_STATE.FIRING) {
      ctx.fillRect(-0.5 * px, -3.6 * px, px, 2.8 * px);
    } else if (!this.started) {
      ctx.fillRect(-2.2 * px, -0.4 * px, px, 2.2 * px);
      ctx.fillRect(1.2 * px, -0.4 * px, px, 2.2 * px);
    } else {
      ctx.fillRect(-2.4 * px, -0.6 * px, px, 2 * px);
      ctx.fillRect(1.4 * px, -0.6 * px, px, 2 * px);
    }
    // Head + mask eyes.
    ctx.fillStyle = skin.suit;
    ctx.fillRect(-1.2 * px, -3 * px, 2.4 * px, 2 * px);
    ctx.fillStyle = '#f4f7ff';
    ctx.fillRect(-1.0 * px, -2.6 * px, 0.8 * px, 0.7 * px);
    ctx.fillRect(0.2 * px, -2.6 * px, 0.8 * px, 0.7 * px);
    ctx.restore();
  }
}
