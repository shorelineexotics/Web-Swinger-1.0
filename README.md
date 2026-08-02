# Web Swinger 1.0

A fast, one-button rhythm/precision platformer: swing through an endless
procedurally generated pixel city on webs, dodge the hazards, outrun the pace,
and chase your best distance. Pure HTML5 Canvas + vanilla ES6 — no frameworks,
no build step, no backend.

## Run it

**Easiest:** double-click `index.html`. Everything (including the soundtrack,
which is synthesized in WebAudio) works from `file://`.

**Recommended:** serve it, so a custom `music.mp3` can load too:

```bash
cd "Web Swinger 1.0"
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, nginx, GitHub Pages…).

## How to play

One button. That's it.

| Action | Desktop | Mobile |
|---|---|---|
| Fire / hold web | Hold **Space** or **Left Click** | Touch & hold |
| Release web | Let go | Let go |
| Pause | **Esc** or **P** | — |

- Holding fires a web that sticks anywhere along the glowing rooftop edges
  ahead of you, and you swing like a pendulum through the city canyon.
- Release while **rising fast** for a **PERFECT** and build a combo.
- Buildings are scenery — you swing through them. The street and every
  hazard are instant death.
- The red wall on the left never stops. Neither do you.
- Death → tap once → you're already swinging again.

## Features

- Momentum-preserving pendulum physics with fixed-length rope constraint
- Endless seeded city: varying heights/gaps, grabbable rooftop edges, parallax
  skyline, sunset → night → dawn cycle, neon windows, animated clouds
- Hazards: street signs, street lights, traffic lights, moving cars and buses,
  sagging power lines, helicopters, canyon drones, bird flocks
- Smooth difficulty ramp: pace, gaps, height variance, hazard density
- Game feel: near-miss slow motion, screen shake, motion-blur ghosts, speed
  lines, sparks, dust, death explosion, camera lookahead + speed zoom
- Procedural synthwave soundtrack on a beat grid; windows and anchors pulse on
  the beat; all SFX synthesized (zero audio assets required)
- PERFECT-release combo system, achievements, 6 unlockable skins
- Daily Challenge (seeded from the date — same city for everyone, own best)
- Local high scores, volume sliders, screen-shake toggle, colorblind-friendly
  hazard palette, reduced-flashing mode, fullscreen
- 60 FPS target: object pooling, swap-remove iteration, culling, no per-frame
  allocation in hot paths

## Project layout

```
index.html          shell + menu/HUD DOM
style.css           overlay styling
assets/audio/       (optional) music.mp3 — see README.txt inside
js/
  config.js         every tuning number in one table
  utils.js          math, seeded RNG (mulberry32), geometry, object pool
  storage.js        saves, settings, skin defs (localStorage)
  audio.js          WebAudio SFX + procedural music + beat pulses
  input.js          unified one-button input (pointer + keyboard)
  effects.js        particles, shake, speed lines, flashes
  background.js     sky cycle, sun/moon, stars, clouds, parallax skylines
  buildings.js      endless seeded city + anchor nodes + collision
  obstacles.js      all hazards, pooling, near-miss distances
  player.js         swing physics, web, scarf, trail, pixel hero
  camera.js         smooth follow, lookahead, speed zoom
  achievements.js   definitions + unlock checks
  ui.js             menus, HUD, toasts
  game.js           state machine + orchestration
  main.js           boot + main loop
```

## Customizing

- **Feel/difficulty:** everything is in `js/config.js` — gravity, web range,
  pace curve, gap sizes, slow-mo strength, zoom, BPM…
- **Music:** drop `assets/audio/music.mp3` and set `MUSIC_BPM` to its tempo.
- **Skins:** add an entry to `SKINS` in `js/storage.js` (pure palette swaps).
- **Achievements:** add a row to `ACHIEVEMENTS` in `js/achievements.js`; give
  it a `skin:` field to make it unlock one.
- **Hazards:** add a type in `js/obstacles.js` — implement `update`, `dist`
  (distance to surface; the near-miss system uses it for free), and `draw`.
- **Levels:** generation is fully seed-driven; feed any seed into
  `Game.startRun` for reproducible cities.

## Debugging tips

- The whole game state lives on the `game`-scoped objects created in
  `js/main.js`; add `window.game = game` there for console poking.
- Set `CONFIG.EASY_START_METERS` high to practice hazard-free.
