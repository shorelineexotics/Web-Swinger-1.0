/* ============================================================
 * Web Swinger 1.0 — obstacles.js
 * All hazards. Buildings are a background plane you swing through;
 * the danger lives on the street (signs, street lights, traffic
 * lights, moving cars), between rooftops (power lines) and in the
 * air (helicopters, drones, birds). Any contact is instant death.
 * Every hazard also reports its distance to the player for the
 * near-miss slow-motion system.
 * ============================================================ */

const HAZ = {
  SIGN: 0, STREETLIGHT: 1, TRAFFICLIGHT: 2, CAR: 3,
  POWERLINE: 4, HELICOPTER: 5, DRONE: 6, BIRDS: 7,
};

const SIGN_TEXTS = ['WEB ST', 'EXIT 9', 'MAIN ST', 'SLOW', '1-WAY', 'NO FLY'];
const CAR_COLORS = ['#b3402e', '#2e6db3', '#c0c0cc', '#3f9e5a', '#a06ac0', '#d0a02e'];

class Obstacle {
  constructor() { this.active = false; }

  /** Generic init; per-type fields set by the manager. */
  init(type, x, y) {
    this.type = type; this.x = x; this.y = y;
    this.t = 0; this.active = true;
    this.vx = 0; this.vy = 0;
    this.rects = null; this.segs = null;
    this.w = 0; this.h = 0;
    this.text = ''; this.count = 0; this.amp = 0; this.freq = 1;
    this.phase = 0; this.right = x;
    this.baseY = y; this.color = '#fff'; this.bus = false;
  }

  update(dt, time) {
    this.t += dt;
    switch (this.type) {
      case HAZ.CAR:
        this.x += this.vx * dt;
        this.right = this.x + this.w;
        break;
      case HAZ.HELICOPTER:
        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.t * 1.6 + this.phase) * 26;
        this.right = this.x + 90;
        break;
      case HAZ.DRONE:
        this.y = this.baseY + Math.sin(this.t * this.freq + this.phase) * this.amp;
        break;
      case HAZ.BIRDS:
        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.t * 3 + this.phase) * 14;
        this.right = this.x + this.count * 26;
        break;
    }
  }

  /** Distance from a point to this hazard's surface (<=0 means hit). */
  dist(px, py) {
    switch (this.type) {
      case HAZ.SIGN:
      case HAZ.STREETLIGHT:
      case HAZ.TRAFFICLIGHT: {
        let best = Infinity;
        for (const r of this.rects) {
          best = Math.min(best, circleRectDist(px, py, r[0], r[1], r[2], r[3]));
        }
        return best;
      }
      case HAZ.CAR:
        return circleRectDist(px, py, this.x, this.y, this.w, this.h);
      case HAZ.POWERLINE: {
        let best = Infinity;
        for (const s of this.segs) {
          best = Math.min(best, pointSegDist(px, py, s[0], s[1], s[2], s[3]) - 3);
        }
        return best;
      }
      case HAZ.HELICOPTER: {
        const bodyD = circleRectDist(px, py, this.x, this.y - 16, 84, 34);
        const rotorD = circleRectDist(px, py, this.x - 12, this.y - 26, 108, 6);
        return Math.min(bodyD, rotorD);
      }
      case HAZ.DRONE:
        return distance(px, py, this.x, this.y) - 18;
      case HAZ.BIRDS: {
        let best = Infinity;
        for (let i = 0; i < this.count; i++) {
          const bx = this.x + i * 26;
          const by = this.y + Math.sin(this.t * 3 + i * 0.8) * 10;
          best = Math.min(best, distance(px, py, bx, by) - 9);
        }
        return best;
      }
    }
    return Infinity;
  }

  draw(ctx, time, colorblind, night) {
    const danger = colorblind ? '#ff8c1a' : '#ff3b4e';
    switch (this.type) {
      case HAZ.SIGN: {
        const [board, pole] = this.rects;
        ctx.fillStyle = '#3c4450';
        ctx.fillRect(pole[0], pole[1], pole[2], pole[3]);
        ctx.fillStyle = '#1a5c38';
        ctx.fillRect(board[0], board[1], board[2], board[3]);
        ctx.strokeStyle = '#e8f4ec';
        ctx.lineWidth = 2;
        ctx.strokeRect(board[0] + 2, board[1] + 2, board[2] - 4, board[3] - 4);
        ctx.fillStyle = '#e8f4ec';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, board[0] + board[2] / 2, board[1] + board[3] / 2 + 5);
        break;
      }
      case HAZ.STREETLIGHT: {
        const [pole, arm, head] = this.rects;
        ctx.fillStyle = '#3c4450';
        ctx.fillRect(pole[0], pole[1], pole[2], pole[3]);
        ctx.fillRect(arm[0], arm[1], arm[2], arm[3]);
        ctx.fillStyle = '#2a3038';
        ctx.fillRect(head[0], head[1], head[2], head[3]);
        // Lamp glow, stronger at night.
        const cx = head[0] + head[2] / 2, cy = head[1] + head[3];
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(head[0] + 3, head[1] + head[3] - 4, head[2] - 6, 4);
        ctx.globalAlpha = 0.10 + night * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case HAZ.TRAFFICLIGHT: {
        const [pole, arm, box] = this.rects;
        ctx.fillStyle = '#3c4450';
        ctx.fillRect(pole[0], pole[1], pole[2], pole[3]);
        ctx.fillRect(arm[0], arm[1], arm[2], arm[3]);
        ctx.fillStyle = '#20242c';
        ctx.fillRect(box[0], box[1], box[2], box[3]);
        // Cycling lights.
        const phase = Math.floor(this.t * 0.55 + this.phase) % 3;
        const cols = ['#ff4444', '#ffcc44', '#44dd66'];
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === phase ? cols[i] : '#3a3f48';
          ctx.beginPath();
          ctx.arc(box[0] + box[2] / 2, box[1] + 9 + i * 13, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case HAZ.CAR: {
        const fwd = this.vx >= 0 ? 1 : -1;
        // Body + cabin.
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y + this.h * 0.35, this.w, this.h * 0.65);
        ctx.fillRect(this.x + this.w * (this.bus ? 0.06 : 0.22), this.y,
                     this.w * (this.bus ? 0.88 : 0.5), this.h * 0.5);
        // Windows.
        ctx.fillStyle = night > 0.5 ? '#ffe9a8' : '#1c2230';
        if (this.bus) {
          for (let wx = this.x + this.w * 0.1; wx < this.x + this.w * 0.9; wx += 26) {
            ctx.fillRect(wx, this.y + 5, 14, this.h * 0.3);
          }
        } else {
          ctx.fillRect(this.x + this.w * 0.28, this.y + 4, this.w * 0.16, this.h * 0.32);
          ctx.fillRect(this.x + this.w * 0.52, this.y + 4, this.w * 0.16, this.h * 0.32);
        }
        // Wheels.
        ctx.fillStyle = '#14161c';
        const wy = this.y + this.h;
        ctx.beginPath();
        ctx.arc(this.x + this.w * 0.22, wy, 8, 0, Math.PI * 2);
        ctx.arc(this.x + this.w * 0.78, wy, 8, 0, Math.PI * 2);
        ctx.fill();
        // Head/tail lights (+ beam at night).
        const hx = fwd > 0 ? this.x + this.w - 3 : this.x + 3;
        ctx.fillStyle = '#fff2b8';
        ctx.fillRect(hx - 2, this.y + this.h * 0.5, 4, 5);
        ctx.fillStyle = danger;
        ctx.fillRect(fwd > 0 ? this.x : this.x + this.w - 3, this.y + this.h * 0.5, 3, 5);
        if (night > 0.45) {
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = '#fff2b8';
          ctx.beginPath();
          ctx.moveTo(hx, this.y + this.h * 0.45);
          ctx.lineTo(hx + fwd * 90, this.y + this.h * 0.2);
          ctx.lineTo(hx + fwd * 90, this.y + this.h * 1.1);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case HAZ.POWERLINE: {
        ctx.strokeStyle = colorblind ? '#ffe08a' : '#c8b8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const s of this.segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
        ctx.stroke();
        // Sparks crawling along the line.
        const s = this.segs[Math.floor((time * 2) % this.segs.length)];
        const k = (time * 3) % 1;
        ctx.fillStyle = '#fff2a8';
        ctx.fillRect(lerp(s[0], s[2], k) - 2, lerp(s[1], s[3], k) - 2, 4, 4);
        break;
      }
      case HAZ.HELICOPTER: {
        ctx.fillStyle = '#252c3a';
        ctx.fillRect(this.x, this.y - 16, 60, 34);           // cabin
        ctx.fillRect(this.x + 52, this.y - 8, 34, 10);       // tail
        ctx.fillStyle = '#181d28';
        ctx.fillRect(this.x + 8, this.y + 18, 44, 4);        // skids
        const rw = 54 + Math.abs(Math.sin(time * 22)) * 54;  // rotor spin
        ctx.fillStyle = 'rgba(220,225,240,0.8)';
        ctx.fillRect(this.x + 42 - rw / 2, this.y - 26, rw, 4);
        ctx.fillStyle = danger;
        ctx.fillRect(this.x + 82, this.y - 8, 4, 4);
        break;
      }
      case HAZ.DRONE: {
        ctx.fillStyle = '#2c3240';
        ctx.fillRect(this.x - 12, this.y - 6, 24, 12);
        const rw = 8 + Math.abs(Math.sin(time * 26 + this.phase)) * 10;
        ctx.fillStyle = 'rgba(200,210,230,0.85)';
        ctx.fillRect(this.x - 16 - rw / 2, this.y - 10, rw, 3);
        ctx.fillRect(this.x + 16 - rw / 2, this.y - 10, rw, 3);
        const on = Math.sin(time * 8) > 0;
        ctx.fillStyle = on ? danger : '#404050';
        ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
        break;
      }
      case HAZ.BIRDS: {
        ctx.strokeStyle = night > 0.5 ? '#0c0c16' : '#1c1626';
        ctx.lineWidth = 3;
        for (let i = 0; i < this.count; i++) {
          const bx = this.x + i * 26;
          const by = this.y + Math.sin(this.t * 3 + i * 0.8) * 10;
          const flap = Math.sin(time * 12 + i) * 5;
          ctx.beginPath();
          ctx.moveTo(bx - 9, by - flap);
          ctx.lineTo(bx, by + 3);
          ctx.lineTo(bx + 9, by - flap);
          ctx.stroke();
        }
        break;
      }
    }
  }
}

class ObstacleManager {
  constructor(seed) {
    this.rng = new Rng(seed ^ 0x1234abcd);
    this.list = [];
    this.pool = [];
    this.flyTimer = 4;
    this.carTimer = 3;
  }

  reset(seed) {
    this.rng = new Rng(seed ^ 0x1234abcd);
    this.pool.push(...this.list);
    for (const o of this.pool) o.active = false;
    this.list.length = 0;
    this.flyTimer = 5;
    this.carTimer = 3;
  }

  _obtain() {
    const o = this.pool.pop() || new Obstacle();
    this.list.push(o);
    return o;
  }

  /**
   * Called as the building field generates: each new building gets a
   * chance of street furniture near it, a power line to its neighbour,
   * and a canyon drone.
   */
  populate(buildings, meters) {
    const diff = difficultyAt(meters);
    const G = CONFIG.GROUND_Y;
    for (let i = 0; i < buildings.buildings.length; i++) {
      const b = buildings.buildings[i];
      if (b.hazardsDone) continue;
      b.hazardsDone = true;
      if (b.x / CONFIG.PX_PER_METER < CONFIG.EASY_START_METERS) continue;

      // Power line first: if one is strung across the gap here, the
      // street below stays clear so there is always a path under it.
      let hasLine = false;
      if (i > 0 && diff > 0.25 && this.rng.chance(0.16)) {
        this._powerline(buildings.buildings[i - 1], b);
        hasLine = true;
      }

      // Street furniture: 0-2 pieces per building span.
      const budget = hasLine ? 0
        : this.rng.chance(0.35 + diff * 0.5) ? (this.rng.chance(diff * 0.45) ? 2 : 1) : 0;
      for (let k = 0; k < budget; k++) {
        const sx = this.rng.float(b.x - 70, b.right + 70);
        const roll = this.rng.next();
        if (roll < 0.38) {                                   // street sign
          const o = this._obtain();
          const ph = this.rng.float(120, 170 + diff * 35);
          const bw = this.rng.float(78, 120), bh = this.rng.float(46, 62);
          o.init(HAZ.SIGN, sx, G - ph - bh);
          o.rects = [
            [sx - bw / 2, G - ph - bh, bw, bh],              // board
            [sx - 4, G - ph, 8, ph],                          // pole
          ];
          o.text = this.rng.pick(SIGN_TEXTS);
          o.right = sx + bw / 2;
        } else if (roll < 0.72) {                             // street light
          const o = this._obtain();
          const ph = this.rng.float(190, 235 + diff * 40);
          o.init(HAZ.STREETLIGHT, sx, G - ph);
          o.rects = [
            [sx - 3, G - ph, 6, ph],                          // pole
            [sx, G - ph, 48, 6],                              // arm
            [sx + 34, G - ph + 4, 20, 10],                    // lamp head
          ];
          o.right = sx + 54;
        } else {                                              // traffic light
          const o = this._obtain();
          const ph = this.rng.float(210, 265);
          o.init(HAZ.TRAFFICLIGHT, sx, G - ph);
          o.rects = [
            [sx - 4, G - ph, 8, ph],                          // pole
            [sx, G - ph, 84, 7],                              // arm over the road
            [sx + 62, G - ph + 7, 20, 48],                    // hanging light box
          ];
          o.phase = this.rng.float(0, 3);
          o.right = sx + 84;
        }
      }

      // Canyon drone hovering below the roofline.
      if (diff > 0.35 && this.rng.chance(0.14)) {
        const o = this._obtain();
        const dx = this.rng.float(b.x - 40, b.right + 40);
        const dy = b.top + this.rng.float(70, 240);
        o.init(HAZ.DRONE, dx, Math.min(dy, G - 260));
        o.baseY = o.y;
        o.amp = this.rng.float(30, 80);
        o.freq = this.rng.float(1.2, 2.4);
        o.phase = this.rng.float(0, 6);
        o.right = dx + 30;
      }
    }
  }

  _powerline(a, b) {
    const o = this._obtain();
    const x1 = a.right - 12, y1 = a.top - 14;
    const x2 = b.x + 12, y2 = b.top - 14;
    const midX = (x1 + x2) / 2;
    const sag = 42 + (x2 - x1) * 0.12;
    const midY = Math.max(y1, y2) + sag;
    o.init(HAZ.POWERLINE, x1, y1);
    o.segs = [
      [x1, y1, midX, midY],
      [midX, midY, x2, y2],
    ];
    o.right = x2;
  }

  /** Timed spawns: traffic on the street, fliers in the air. */
  update(dt, time, camRight, camY, meters, paceSpeed) {
    const diff = difficultyAt(meters);
    const G = CONFIG.GROUND_Y;

    if (meters > CONFIG.EASY_START_METERS) {
      // Oncoming traffic.
      this.carTimer -= dt;
      if (this.carTimer <= 0) {
        this.carTimer = lerp(4.6, 1.7, diff) * this.rng.float(0.7, 1.3);
        const o = this._obtain();
        const bus = this.rng.chance(0.22);
        const w = bus ? this.rng.float(190, 240) : this.rng.float(95, 130);
        const h = bus ? this.rng.float(64, 80) : this.rng.float(36, 46);
        o.init(HAZ.CAR, camRight + 220, G - h - 4);
        o.bus = bus; o.w = w; o.h = h;
        o.right = o.x + w;
        o.vx = -this.rng.float(110, 200) - diff * 70;
        o.color = this.rng.pick(CAR_COLORS);
      }

      // Fliers.
      this.flyTimer -= dt;
      if (this.flyTimer <= 0) {
        this.flyTimer = lerp(7.5, 2.8, diff) * this.rng.float(0.7, 1.3);
        const spawnX = camRight + 200;
        const bandY = camY + this.rng.float(-260, 100);
        if (this.rng.next() < 0.4 && diff > 0.25) {           // helicopter
          const o = this._obtain();
          o.init(HAZ.HELICOPTER, spawnX, bandY);
          o.baseY = bandY;
          o.vx = -this.rng.float(60, 120) - paceSpeed * 0.12;
          o.phase = this.rng.float(0, 6);
        } else {                                               // bird flock
          const o = this._obtain();
          o.init(HAZ.BIRDS, spawnX, bandY);
          o.baseY = bandY;
          o.count = this.rng.int(3, 5);
          o.vx = -this.rng.float(100, 190);
          o.phase = this.rng.float(0, 6);
        }
      }
    }

    for (const o of this.list) o.update(dt, time);
  }

  /** Remove hazards behind the camera. */
  cull(camLeft) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.right < camLeft - 300) {
        o.active = false;
        this.pool.push(o);
        this.list.splice(i, 1);
      }
    }
  }

  /**
   * Collision + near-miss query.
   * Returns { hit, nearDist } where nearDist is the closest surface
   * distance among non-hit hazards (Infinity if none nearby).
   */
  check(px, py, r) {
    let hit = false, nearDist = Infinity;
    for (const o of this.list) {
      if (o.right < px - 250 || o.x > px + 320) continue;
      const d = o.dist(px, py) - r;
      if (d <= 0) { hit = true; break; }
      if (d < nearDist) nearDist = d;
    }
    return { hit, nearDist };
  }

  draw(ctx, camLeft, camRight, time, colorblind, night) {
    for (const o of this.list) {
      if (o.right < camLeft || o.x > camRight + 100) continue;
      o.draw(ctx, time, colorblind, night);
    }
  }
}
