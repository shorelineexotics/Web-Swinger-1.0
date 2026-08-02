/* ============================================================
 * Web Swinger 1.0 — ui.js
 * DOM layer: menus, HUD, settings, skins, achievements, toasts.
 * Game logic calls into UI; UI calls back through handlers the
 * Game registers.
 * ============================================================ */

class UI {
  constructor(audio) {
    this.audio = audio;
    this.$ = id => document.getElementById(id);

    this.screens = {
      menu: this.$('screen-menu'),
      settings: this.$('screen-settings'),
      credits: this.$('screen-credits'),
      skins: this.$('screen-skins'),
      achievements: this.$('screen-achievements'),
      pause: this.$('screen-pause'),
      gameover: this.$('screen-gameover'),
    };
    this.hud = this.$('hud');
    this.hudDist = this.$('hud-distance');
    this.hudSpeed = this.$('hud-speed');
    this.hudBest = this.$('hud-best');
    this.hudCombo = this.$('hud-combo');
    this.hint = this.$('hud-hint');
    this.toasts = this.$('toasts');

    this.handlers = {};   // set via ui.on(name, fn)
    this._hudTimer = 0;
    this._wire();
    this._wireInstall();
  }

  /**
   * "Install as App" button. Android/Chrome can trigger a real install
   * prompt (beforeinstallprompt); iOS has no such API, so the button
   * walks the player through Share → Add to Home Screen instead.
   * Hidden entirely when already running as an installed app.
   */
  _wireInstall() {
    const btn = this.$('btn-install');
    const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
      || navigator.standalone === true;
    if (standalone) return;                    // already installed

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
    window.addEventListener('appinstalled', () => { btn.style.display = 'none'; });

    btn.style.display = '';
    btn.addEventListener('click', async () => {
      this.audio.init(); this.audio.resume(); this.audio.uiClick();
      if (deferredPrompt) {
        deferredPrompt.prompt();               // native install dialog
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice.outcome === 'accepted') btn.style.display = 'none';
      } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        this.toast('📲 Install on iPhone', 'Tap the Share button, then "Add to Home Screen"');
      } else {
        this.toast('📲 Install', 'Use your browser menu: "Install app" / "Add to Home Screen"');
      }
    });
  }

  on(name, fn) { this.handlers[name] = fn; }
  _fire(name, arg) { if (this.handlers[name]) this.handlers[name](arg); }

  _wire() {
    const click = (id, ev) => this.$(id).addEventListener('click', () => {
      this.audio.init(); this.audio.resume(); this.audio.uiClick();
      this._fire(ev);
    });

    click('btn-play', 'play');
    click('btn-daily', 'daily');
    click('btn-skins', 'showSkins');
    click('btn-settings', 'showSettings');
    click('btn-credits', 'showCredits');
    click('btn-achievements', 'showAchievements');
    click('btn-settings-back', 'backToMenu');
    click('btn-credits-back', 'backToMenu');
    click('btn-skins-back', 'backToMenu');
    click('btn-ach-back', 'backToMenu');
    click('btn-resume', 'resume');
    click('btn-restart', 'restart');
    click('btn-quit', 'quit');
    click('btn-go-restart', 'restart');
    click('btn-go-menu', 'quit');
    click('btn-fullscreen', 'fullscreen');
    click('btn-fs-corner', 'fullscreen');

    // Settings controls.
    const s = Storage.data.settings;
    const music = this.$('set-music'), sfx = this.$('set-sfx');
    music.value = s.musicVol; sfx.value = s.sfxVol;
    music.addEventListener('input', () => {
      s.musicVol = parseFloat(music.value);
      this.audio.setMusicVolume(s.musicVol); Storage.save();
    });
    sfx.addEventListener('input', () => {
      s.sfxVol = parseFloat(sfx.value);
      this.audio.setSfxVolume(s.sfxVol); Storage.save();
      this.audio.uiClick();
    });
    const bindToggle = (id, key, cb) => {
      const el = this.$(id);
      el.checked = s[key];
      el.addEventListener('change', () => {
        s[key] = el.checked; Storage.save();
        if (cb) cb(el.checked);
      });
    };
    bindToggle('set-shake', 'screenShake', v => this._fire('shakeChanged', v));
    bindToggle('set-colorblind', 'colorblind', v => this._fire('colorblindChanged', v));
    bindToggle('set-flash', 'reducedFlash', v => this._fire('flashChanged', v));
  }

  showScreen(name) {
    for (const key in this.screens) {
      this.screens[key].classList.toggle('visible', key === name);
    }
    this.hud.classList.toggle('visible', name === null);
  }
  hideAll() { this.showScreen(null); }

  /* --- Menu data ------------------------------------------------ */

  refreshMenu() {
    this.$('menu-best').textContent = fmtMeters(Storage.data.best);
    const dailyBest = Storage.bestFor(true);
    this.$('btn-daily').textContent =
      dailyBest > 0 ? `Daily Challenge — best ${fmtMeters(dailyBest)}` : 'Daily Challenge';
  }

  buildSkins() {
    const grid = this.$('skins-grid');
    grid.innerHTML = '';
    for (const sk of SKINS) {
      const unlocked = Storage.data.unlockedSkins.includes(sk.id);
      const el = document.createElement('button');
      el.className = 'skin-card' + (unlocked ? '' : ' locked') +
        (Storage.data.skin === sk.id ? ' selected' : '');
      el.innerHTML = `
        <span class="skin-swatch" style="background:${sk.suit};box-shadow:0 6px 0 ${sk.accent}"></span>
        <span class="skin-name">${sk.name}</span>
        <span class="skin-unlock">${unlocked ? (Storage.data.skin === sk.id ? 'EQUIPPED' : 'Tap to equip') : '🔒 ' + sk.unlock}</span>`;
      el.addEventListener('click', () => {
        if (!unlocked) { this.audio.uiHover(); return; }
        Storage.data.skin = sk.id; Storage.save();
        this.audio.uiClick();
        this.buildSkins();
        this._fire('skinChanged', sk.id);
      });
      grid.appendChild(el);
    }
  }

  buildAchievements() {
    const list = this.$('ach-list');
    list.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const got = !!Storage.data.achievements[a.id];
      const el = document.createElement('div');
      el.className = 'ach-row' + (got ? ' earned' : '');
      el.innerHTML = `<span class="ach-icon">${got ? '🏆' : '·'}</span>
        <span><strong>${a.name}</strong><br><small>${a.desc}</small></span>`;
      list.appendChild(el);
    }
  }

  /* --- HUD -------------------------------------------------------- */

  updateHUD(dt, meters, kmh, best, combo, comboTime) {
    this._hudTimer -= dt;
    if (this._hudTimer > 0) return;
    this._hudTimer = 0.08; // ~12Hz text updates, cheap on layout
    this.hudDist.textContent = fmtMeters(meters);
    this.hudSpeed.textContent = Math.round(kmh) + ' km/h';
    this.hudBest.textContent = 'BEST ' + fmtMeters(best);
    if (combo >= 2) {
      this.hudCombo.textContent = 'PERFECT x' + combo;
      this.hudCombo.classList.add('visible');
      this.hudCombo.style.opacity = clamp(comboTime, 0.4, 1);
    } else {
      this.hudCombo.classList.remove('visible');
      this.hudCombo.style.opacity = ''; // clear inline override so the CSS hide wins
    }
  }

  setHint(text) {
    this.hint.textContent = text || '';
    this.hint.classList.toggle('visible', !!text);
  }

  showGameOver(meters, best, newBest, daily) {
    this.$('go-distance').textContent = fmtMeters(meters);
    this.$('go-best').textContent = (daily ? "Today's best: " : 'Best: ') + fmtMeters(best);
    this.$('go-newbest').style.display = newBest ? 'block' : 'none';
    this.showScreen('gameover');
  }

  toast(title, body) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<strong>${title}</strong><small>${body}</small>`;
    this.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }
}
