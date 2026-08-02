/* ============================================================
 * Web Swinger 1.0 — main.js
 * Boot: canvas + DPR handling, module construction, main loop.
 * ============================================================ */

(function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  Storage.load();
  const audio = new AudioSys();
  const ui = new UI(audio);
  const input = new Input(canvas);
  const game = new Game(canvas, ctx, input, audio, ui);
  window.game = game; // console access for tuning/debugging

  /* Responsive canvas with device-pixel-ratio crispness. */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Hidden/background contexts can report 0x0; fall back so the
    // simulation never sees a zero-size viewport.
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    ctx.imageSmoothingEnabled = false;
    game.camera.resize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* Auto-pause when the tab is hidden mid-run; re-measure on return. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
    else resize();
  });

  /* Main loop. */
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
