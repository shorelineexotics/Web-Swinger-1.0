/* ============================================================
 * Web Swinger 1.0 — game.js
 * State machine + orchestration: runs the simulation, owns the
 * difficulty/pace curve, death rules, combo/near-miss feel, and
 * routes input + UI events.
 * ============================================================ */

const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, DEAD: 3 };

class Game {
  constructor(canvas, ctx, input, audio, ui) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.audio = audio;
    this.ui = ui;

    this.camera = new Camera();
    this.effects = new Effects();
    this.player = new Player();
    this.buildings = new BuildingField(1);
    this.obstacles = new ObstacleManager(1);
    this.background = new Background(hashSeed('skyline'));
    this.achievements = new AchievementTracker(ui, audio);

    this.state = STATE.MENU;
    this.daily = false;
    this.time = 0;
    this.timeScale = 1;
    this.targetTimeScale = 1;
    this.slowmoTimer = 0;
    this.deadTimer = 0;
    this.goShown = false;

    const s = Storage.data.settings;
    this.effects.shakeEnabled = s.screenShake;
    this.effects.reducedFlash = s.reducedFlash;
    this.colorblind = s.colorblind;
    this.skin = getSkin(Storage.data.skin);

    this._wireInput();
    this._wireUI();
    this.ui.refreshMenu();
    this.ui.showScreen('menu');
  }

  /* --- Wiring ----------------------------------------------------- */

  _wireInput() {
    this.input.onPress = () => {
      this.audio.init(); this.audio.resume();
      if (this.state === STATE.PLAYING) {
        const res = this.player.fireWeb(this.buildings);
        if (res === 'fired') {
          this.audio.fire();
          this.ui.setHint('');
        }
      } else if (this.state === STATE.DEAD && this.goShown && this.deadTimer > 0.35) {
        this.startRun(this.daily);   // instant one-tap restart
      }
    };
    this.input.onRelease = () => {
      if (this.state !== STATE.PLAYING) return;
      const res = this.player.releaseWeb();
      if (res === null) return;
      this.audio.release();
      if (res === 'perfect') {
        this.combo++;
        this.stats.combo = Math.max(this.stats.combo, this.combo);
        this.comboTime = 2.2;
        this.audio.perfect();
        this.effects.sparks(this.player.x, this.player.y, 0, -1, 6, '#ffe36b');
      } else {
        this.combo = 0;
      }
    };
    this.input.onPause = () => {
      if (this.state === STATE.PLAYING) this.pause();
      else if (this.state === STATE.PAUSED) this.resume();
    };
  }

  _wireUI() {
    const ui = this.ui;
    ui.on('play', () => this.startRun(false));
    ui.on('daily', () => this.startRun(true));
    ui.on('restart', () => this.startRun(this.daily));
    ui.on('resume', () => this.resume());
    ui.on('quit', () => this.toMenu());
    ui.on('showSettings', () => ui.showScreen('settings'));
    ui.on('showCredits', () => ui.showScreen('credits'));
    ui.on('showSkins', () => { ui.buildSkins(); ui.showScreen('skins'); });
    ui.on('showAchievements', () => { ui.buildAchievements(); ui.showScreen('achievements'); });
    ui.on('backToMenu', () => { ui.refreshMenu(); ui.showScreen('menu'); });
    ui.on('skinChanged', id => { this.skin = getSkin(id); });
    ui.on('shakeChanged', v => { this.effects.shakeEnabled = v; });
    ui.on('flashChanged', v => { this.effects.reducedFlash = v; });
    ui.on('colorblindChanged', v => { this.colorblind = v; });
    ui.on('fullscreen', () => {
      // iOS Safari (16.4+) only exposes the webkit-prefixed API.
      const doc = document, el = document.documentElement;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        // Very old iOS: no fullscreen API at all.
        ui.toast('📱 Tip', 'Share → Add to Home Screen for fullscreen play');
      }
    });
  }

  /* --- Run lifecycle ------------------------------------------------ */

  startRun(daily) {
    this.daily = daily;
    // Seeded generation: the daily seed is shared by everyone that day;
    // normal runs get a fresh random seed each time.
    this.seed = daily ? hashSeed('daily-' + todayKey())
                      : (Math.random() * 0xffffffff) >>> 0;

    this.player.reset();
    this.buildings.reset(this.seed);
    this.obstacles.reset(this.seed);
    this.effects.clear();
    this.camera.snapTo(this.player.x + 200, this.player.y + 120);
    this.camera.zoom = CONFIG.CAM_ZOOM_MAX;

    this.meters = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.deathWallX = this.player.x - 620;
    this.nearMissCooldown = 0;
    this.prevVy = 0;
    this.timeScale = 1; this.targetTimeScale = 1; this.slowmoTimer = 0;
    this.deadTimer = 0; this.goShown = false;

    this.stats = { swings: 0, meters: 0, combo: 0, nearMisses: 0, topKmh: 0, rescues: 0, playedDaily: daily };

    this.state = STATE.PLAYING;
    this.ui.hideAll();
    this.ui.setHint(daily ? `DAILY ${todayKey()} — HOLD to web the next rooftop` : 'HOLD to web the next rooftop · release to fly');
    this.audio.init(); this.audio.resume();
    this.audio.startMusic();
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.ui.hideAll();
  }

  toMenu() {
    this.state = STATE.MENU;
    this.audio.stopMusic();
    this.ui.refreshMenu();
    this.ui.showScreen('menu');
  }

  onWebAttached() {
    this.audio.attach();
    this.stats.swings++;
    if (this.player.web.rescue) {
      // Clutch save: heavier feedback than a routine attach.
      this.stats.rescues++;
      this.audio.nearMiss();
      this.effects.shake(CONFIG.SHAKE_ATTACH * 2.5);
      this.effects.sparks(this.player.web.ax, this.player.web.ay, 0, 1, 10, '#ffe36b');
    } else {
      this.effects.shake(CONFIG.SHAKE_ATTACH);
      this.effects.sparks(this.player.web.ax, this.player.web.ay, 0, 1, 5, '#f4f7ff');
    }
  }

  die(reason) {
    if (!this.player.alive) return;
    this.deathReason = reason;
    this.player.alive = false;
    this.state = STATE.DEAD;
    this.deadTimer = 0;
    this.goShown = false;

    this.audio.death();
    this.effects.deathExplosion(this.player.x, this.player.y, this.skin);
    this.targetTimeScale = CONFIG.DEATH_SLOWMO;
    this.slowmoTimer = 0.5;

    const { newBest } = Storage.recordRun(this.meters, this.stats.combo, this.daily);
    this.newBest = newBest;
    this.achievements.check(this.stats);
  }

  /* --- Update -------------------------------------------------------- */

  update(rawDt) {
    // Clamp huge frame gaps (tab switches) and advance clocks.
    const dt = Math.min(rawDt, 1 / 30);
    this.time += dt;
    this.audio.update(dt);

    // Ease the timescale toward its target; slow-mo timers run on real time.
    if (this.slowmoTimer > 0) {
      this.slowmoTimer -= dt;
      if (this.slowmoTimer <= 0) this.targetTimeScale = 1;
    }
    this.timeScale += (this.targetTimeScale - this.timeScale) * damp(8, dt);

    if (this.state === STATE.MENU || this.state === STATE.PAUSED) {
      // Keep the skyline alive behind menus.
      this.effects.update(dt, 0, this.camera.viewW, this.camera.viewH);
      return;
    }

    const wdt = dt * this.timeScale;   // world time

    if (this.state === STATE.DEAD) {
      this.deadTimer += dt;
      this.effects.update(dt, 0, this.camera.viewW, this.camera.viewH);
      this.obstacles.update(wdt, this.time, this.camera.worldRight, this.camera.y, this.meters, 0);
      if (!this.goShown && this.deadTimer > 0.9) {
        this.goShown = true;
        this.ui.showGameOver(this.meters, Storage.bestFor(this.daily), this.newBest, this.daily);
      }
      return;
    }

    /* ---- PLAYING ---- */
    const p = this.player;
    const diff = difficultyAt(this.meters);

    // Held input keeps trying to fire until an anchor is in range —
    // "hold to web" should never require re-pressing.
    this.retryTimer = (this.retryTimer || 0) - dt;
    if (this.input.held && p.alive && p.web.state === WEB_STATE.NONE && this.retryTimer <= 0) {
      this.retryTimer = 0.08;
      if (p.fireWeb(this.buildings) === 'fired') {
        this.audio.fire();
        this.ui.setHint('');
      }
    }

    p.update(wdt, this);
    this.meters = Math.max(this.meters, p.x / CONFIG.PX_PER_METER);
    this.stats.meters = this.meters;

    const kmh = p.speed / CONFIG.PX_PER_METER * 3.6;
    this.stats.topKmh = Math.max(this.stats.topKmh, kmh);

    // Whoosh when sweeping through the bottom of a swing.
    if (p.attached && this.prevVy > 40 && p.vy <= 0) {
      this.audio.swingWhoosh(clamp(p.speed / 1400, 0.3, 1));
    }
    this.prevVy = p.vy;

    // The pace wall: relentless forward pressure once the run starts.
    if (p.started) {
      const paceSpeed = CONFIG.PACE_BASE
        + CONFIG.PACE_MAX_BONUS * diff
        + Math.max(0, this.meters - CONFIG.DIFF_RAMP_METERS) * CONFIG.PACE_LATE_GROWTH;
      this.deathWallX += paceSpeed * wdt;
      // The wall never lags too far behind a fast player.
      this.deathWallX = Math.max(this.deathWallX, p.x - 1400);
      this.paceSpeed = paceSpeed;
    } else {
      this.deathWallX = p.x - 620;
      this.paceSpeed = CONFIG.PACE_BASE;
    }

    // Camera + world streaming.
    this.camera.update(wdt, p.x, p.y, p.vx, p.vy);
    this.buildings.update(this.camera.worldLeft, this.camera.worldRight, this.meters);
    this.obstacles.populate(this.buildings, this.meters);
    this.obstacles.update(wdt, this.time, this.camera.worldRight, this.camera.y, this.meters, this.paceSpeed);
    this.obstacles.cull(Math.min(this.camera.worldLeft, this.deathWallX));

    // Combo display timer.
    if (this.comboTime > 0) this.comboTime -= dt;

    /* ---- Death & near-miss checks ---- */
    const r = CONFIG.PLAYER_RADIUS;
    // Buildings are a background plane now — you swing through them.
    // Death comes from the street, the pace wall, and hazards.
    if (p.y > CONFIG.GROUND_Y - r) return this.die('street');
    if (p.x < this.deathWallX) return this.die('leftBehind');

    const q = this.obstacles.check(p.x, p.y, r);
    if (q.hit) return this.die('hazard');

    this.nearMissCooldown -= dt;
    if (q.nearDist < CONFIG.NEAR_MISS_DIST && this.nearMissCooldown <= 0 && p.speed > 500) {
      this.nearMissCooldown = 1.1;
      this.stats.nearMisses++;
      this.targetTimeScale = CONFIG.NEAR_MISS_SLOWMO;
      this.slowmoTimer = CONFIG.NEAR_MISS_TIME;
      this.audio.nearMiss();
      this.effects.doFlash('#ffffff', 0.10);
      this.effects.sparks(p.x, p.y, -p.vx / (p.speed || 1), -p.vy / (p.speed || 1), 4, '#8fd8ff');
    }

    // Dust when skimming just above a rooftop.
    if (p.vy > 0 && !p.attached) {
      for (const b of this.buildings.buildings) {
        if (p.x > b.x && p.x < b.right && p.y > b.top - 40 && p.y < b.top - r) {
          if (Math.random() < 0.3) {
            this.effects.spawn(p.x, b.top, -p.vx * 0.1, -30, 0.4, 3, 'rgba(200,190,210,0.8)', 0);
          }
          break;
        }
      }
    }

    this.effects.update(dt, p.speed, this.camera.viewW, this.camera.viewH);
    this.achievements.check(this.stats);
    this.ui.updateHUD(dt, this.meters, kmh, Storage.bestFor(this.daily), this.combo, this.comboTime);

    if (this.meters > 20 && p.started) this.ui.setHint('');
  }

  /* --- Draw ------------------------------------------------------------ */

  draw() {
    const ctx = this.ctx;
    const cam = this.camera;
    const W = cam.viewW, H = cam.viewH;
    const beat = this.audio.beatPulse;

    this.background.draw(ctx, cam.x, cam.y, W, H, this.meters || 0, this.time, beat);
    const night = this.background.night || 0;

    cam.apply(ctx, this.effects.shakeX, this.effects.shakeY);
    this.buildings.draw(ctx, cam.worldLeft - 50, cam.worldRight + 50, night, beat, this.colorblind);
    this.obstacles.draw(ctx, cam.worldLeft - 50, cam.worldRight + 50, this.time, this.colorblind, night);
    this.effects.drawWorld(ctx);
    if (this.state !== STATE.MENU && this.player.alive || this.state === STATE.PLAYING) {
      this.player.draw(ctx, this.skin, this.time);
    }
    cam.pop(ctx);

    // Pace-wall warning: red pressure creeping in from the left edge.
    if (this.state === STATE.PLAYING && this.player.started) {
      const wallScreenX = (this.deathWallX - cam.worldLeft) * cam.scale;
      if (wallScreenX > -80) {
        const w = Math.max(60, wallScreenX + 80);
        const g = ctx.createLinearGradient(0, 0, w, 0);
        const danger = this.colorblind ? '255,140,26' : '255,59,78';
        g.addColorStop(0, `rgba(${danger},${0.55 + beat * 0.15})`);
        g.addColorStop(1, `rgba(${danger},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, H);
      }
    }

    this.effects.drawScreen(ctx, W, H);

    // Slow-mo tint.
    if (this.timeScale < 0.85) {
      ctx.fillStyle = `rgba(120,180,255,${(0.85 - this.timeScale) * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
