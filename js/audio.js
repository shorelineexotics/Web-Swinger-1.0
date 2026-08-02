/* ============================================================
 * Web Swinger 1.0 — audio.js
 * WebAudio: synthesized SFX (no asset files needed) plus a
 * procedural synthwave loop scheduled on a beat grid. If
 * assets/audio/music.mp3 exists it is used instead, and the beat
 * grid stays locked to CONFIG.MUSIC_BPM for visual pulses.
 *
 * To replace the music: drop an .mp3 at assets/audio/music.mp3
 * and set CONFIG.MUSIC_BPM to its tempo. Done.
 * ============================================================ */

class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = false;

    this.beatPulse = 0;        // 0..1, decays after each beat (drives visuals)
    this.barPulse = 0;         // stronger pulse on bar starts
    this._nextBeatTime = 0;
    this._beatIndex = 0;
    this._schedulerId = null;
    this._customTrack = null;  // decoded AudioBuffer if music.mp3 was found
    this._musicPlaying = false;
  }

  /** Must be called from a user gesture (autoplay policy). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.enabled = true;

    this.setMusicVolume(Storage.data.settings.musicVol);
    this.setSfxVolume(Storage.data.settings.sfxVol);

    // Shared noise buffer for percussive sounds.
    const len = this.ctx.sampleRate * 1;
    this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = this._noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

    this._tryLoadCustomMusic();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v * 0.5; }
  setSfxVolume(v) { if (this.sfxGain) this.sfxGain.gain.value = v; }

  async _tryLoadCustomMusic() {
    try {
      const res = await fetch('assets/audio/music.mp3');
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      this._customTrack = await this.ctx.decodeAudioData(buf);
    } catch (e) { /* no custom track — procedural loop will play */ }
  }

  /* --- Music ---------------------------------------------------- */

  startMusic() {
    if (!this.ctx || this._musicPlaying) return;
    this._musicPlaying = true;
    this._beatIndex = 0;
    this._nextBeatTime = this.ctx.currentTime + 0.1;

    if (this._customTrack) {
      this._trackSrc = this.ctx.createBufferSource();
      this._trackSrc.buffer = this._customTrack;
      this._trackSrc.loop = true;
      this._trackSrc.connect(this.musicGain);
      this._trackSrc.start(this._nextBeatTime);
    }
    // Beat scheduler runs either way: it drives visuals, and drives
    // the procedural instruments when there is no custom track.
    this._schedulerId = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    this._musicPlaying = false;
    if (this._schedulerId) { clearInterval(this._schedulerId); this._schedulerId = null; }
    if (this._trackSrc) { try { this._trackSrc.stop(); } catch (e) {} this._trackSrc = null; }
  }

  _schedule() {
    if (!this.ctx) return;
    const spb = 60 / CONFIG.MUSIC_BPM;
    // Schedule everything within the next 120ms lookahead window.
    while (this._nextBeatTime < this.ctx.currentTime + 0.12) {
      const t = this._nextBeatTime;
      const beat = this._beatIndex % 4;      // position in bar
      const bar = Math.floor(this._beatIndex / 4);

      if (!this._customTrack) this._playBar(t, beat, bar, spb);

      // Fire the visual pulse right on the beat.
      const delay = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(() => {
        this.beatPulse = 1;
        if (beat === 0) this.barPulse = 1;
      }, delay);

      this._nextBeatTime += spb;
      this._beatIndex++;
    }
  }

  /** Procedural synthwave: kick, hats, bassline, sparse pad. */
  _playBar(t, beat, bar, spb) {
    // Kick on every beat.
    this._kick(t);
    // Off-beat hats.
    this._hat(t + spb / 2, 0.25);
    if (beat === 1 || beat === 3) this._hat(t, 0.15);
    // Snare-ish noise on 2 and 4.
    if (beat === 1 || beat === 3) this._snare(t);

    // Minor-key bass arpeggio, 8th notes. A minor-ish: A C E G
    const roots = [55.0, 55.0, 43.65, 49.0];       // A1 A1 F1 G1 per bar
    const root = roots[bar % 4];
    this._bass(t, root, spb * 0.48);
    this._bass(t + spb / 2, root * (beat % 2 === 0 ? 2 : 1.5), spb * 0.4);

    // Airy pad chord at each bar start.
    if (beat === 0) {
      const ch = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]][bar % 4];
      for (const f of ch) this._pad(t, f, spb * 4);
    }
  }

  _kick(t) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.25);
  }

  _hat(t, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t); s.stop(t + 0.06);
  }

  _snare(t) {
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t); s.stop(t + 0.14);
  }

  _bass(t, freq, dur) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 4;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _pad(t, freq, dur) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* --- SFX -------------------------------------------------------- */

  _tone(type, f0, f1, dur, vol, curve = 'exp') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    else o.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noiseBurst(dur, vol, filterFreq, type = 'bandpass', sweepTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }

  fire()    { this._noiseBurst(0.09, 0.35, 1200, 'bandpass', 5200); this._tone('square', 300, 900, 0.07, 0.12); }
  attach()  { this._tone('triangle', 660, 440, 0.09, 0.3); this._noiseBurst(0.05, 0.2, 3000); }
  release() { this._noiseBurst(0.18, 0.28, 2600, 'bandpass', 700); }
  swingWhoosh(intensity) { this._noiseBurst(0.25, 0.10 * intensity, 900, 'bandpass', 400); }
  perfect() { this._tone('sine', 880, 880, 0.09, 0.3); setTimeout(() => this._tone('sine', 1318.5, 1318.5, 0.14, 0.3), 70); }
  nearMiss(){ this._tone('sawtooth', 200, 1400, 0.28, 0.12, 'exp'); }
  death() {
    this._noiseBurst(0.5, 0.6, 900, 'lowpass');
    this._tone('sawtooth', 320, 40, 0.5, 0.4);
  }
  uiClick() { this._tone('square', 700, 700, 0.05, 0.15); }
  uiHover() { this._tone('square', 500, 500, 0.03, 0.06); }
  achievement() {
    this._tone('sine', 660, 660, 0.1, 0.25);
    setTimeout(() => this._tone('sine', 880, 880, 0.1, 0.25), 90);
    setTimeout(() => this._tone('sine', 1320, 1320, 0.2, 0.25), 180);
  }

  update(dt) {
    // Decay the visual beat pulses.
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
    this.barPulse = Math.max(0, this.barPulse - dt * 2.2);
  }
}
