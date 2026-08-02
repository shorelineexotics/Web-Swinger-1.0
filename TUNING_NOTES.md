# Web Swinger 1.0 — Tuning Notes & Change Log

Session date: 2026-07-26. This file tracks the gameplay iterations so far —
what's currently live, what was tried and reverted, and where the knobs are
for the next round of tuning.

---

## Current live state (what you're testing now)

### Core design
- **Webs stick to rooftops** — the entire top edge of every building is a
  grab surface (glowing strip). The grab point is chosen at fire time:
  filters out anchors behind you / below you / out of range, then scores
  candidates by *ahead-ness* (weight 1.0), *rope length near 260px*
  (weight 0.8 penalty per px of deviation), and *height above you*
  (weight 0.3).
- **Buildings are scenery** — you swing through them. No building collisions.
- **Deaths**: street contact, hazards, or the pace wall catching you.
- **Standing start** — hero stands on the top-right corner of the starting
  tower; the first hold webs the next rooftop and swings you off the ledge.
  Nothing moves (including the pace wall) until that first web.

### Hazards
| Zone | Hazards |
|---|---|
| Street | Signs (166–267px), street lights (196–275px), traffic lights (210–265px), moving cars & buses |
| Mid-canyon | Power lines (roof-to-roof, sagging), hovering drones |
| Sky | Helicopters, bird flocks |

- Power lines never share a stretch with street furniture (kept rule —
  guarantees a path under every wire).
- Street furniture max heights were trimmed so late-game growth is mild.

### Key physics values ([js/config.js](js/config.js))
| Setting | Value | Feel |
|---|---|---|
| `WEB_MAX_LEN` | 390 | max rope length |
| `WEB_MIN_LEN` | 70 | rope floor (reel-in stops here) |
| `WEB_RANGE` | 470 | anchor search radius |
| `WEB_ZIP` | 260 | attach impulse toward anchor |
| `RELEASE_BOOST` | 1.09 | fling on any release |
| `PERFECT_BOOST` | 1.16 | fling on a rising-fast release |
| `SOFT_SPEED` | 860 | swing-speed soft ceiling (attached only) |
| `PLAYER_MAX_SPEED` | 1380 | hard cap (~225 km/h) |
| `BLD_HEIGHT_MIN` | 460 | shortest possible building |
| Street-dive filter | `GROUND_Y - 130` | rejects anchors whose rope would swing you into the street |

### Launch feel (current, liked)
- Release boosts raised (1.025→1.09, 1.06→1.16).
- Soft speed damping applies **only while attached** — free flight keeps
  its velocity, so launches carry.

---

## Change history

### Kept
1. **Easier masts era** (superseded): taller pylons, +grace. → replaced by
   the rooftop-anchor redesign.
2. **Rooftop redesign**: webs stick anywhere on roof edges; buildings
   pass-through; hazards moved to street/canyon/sky.
3. **Standing start** replacing the "superman glide" intro.
4. **Launch buff**: bigger release/perfect boosts, momentum kept in flight,
   hard cap 1280→1380.
5. **Anti-frustration round 1**: `BLD_HEIGHT_MIN` 330→460, power lines
   exclude street furniture on the same stretch, furniture height growth
   trimmed.

### Tried and reverted (didn't feel right)
1. **Guaranteed swing clearance** (`STREET_CLEARANCE: 310`): rope budgeted
   per roof so full swings could never reach furniture height; also
   `BLD_HEIGHT_MIN` 500, `WEB_MAX_LEN` 360. → Made short-roof sections
   staccato and tight. **Reverted.**
2. **Tall-zone furniture rule**: signs/lights only next to 3-in-a-row
   buildings ≥650px tall. → Streets felt empty, runs too long/easy.
   **Reverted.**

Lesson from both reverts: global geometric guarantees flatten the feel —
prefer local/surgical tweaks for problem spots.

---

## Automated playtest baseline (current build)

Scripted bot (blind — doesn't dodge hazards), 8 runs:
**487–1,406m, deaths from hazards + occasional street dive.**
Human reference: best run so far 1,001m (pre-launch-buff).

Rerun the harness anytime from the browser console: bots call
`game.startRun()` / `game.input.onPress()` and step `game.update(1/60)`.
`window.game` is exposed for poking.

---

## Added 2026-08-02

- **Mobile audio**: audio session set to 'playback' (sound works with the
  iPhone silent switch on, iOS 16.4+).
- **Landscape zoom**: `CAM_MIN_SCALE: 0.52` floors the camera scale so
  short landscape screens don't zoom out to a distant view.
- **Rescue grab**: when the NORMAL anchor search fails and the player is
  diving (`vy > RESCUE_VY 300`), a fallback search runs with longer reach
  (`RESCUE_RANGE 620`), slightly-behind grabs (`RESCUE_BEHIND 150`), and a
  harder yank (`RESCUE_ZIP 430`). Rescue webs draw thicker with heavier
  attach feedback. Normal play is unaffected (fallback-only); verified:
  casual bot profile unchanged, reckless-bot street deaths 0/20 runs.
- **Fullscreen**: corner ⛶ button (bottom-left, hidden when installed);
  the handler falls back to webkit-prefixed fullscreen for iOS Safari.
- **Installable app (PWA)**: `manifest.json`, apple-touch meta tags, and
  generated icons (180/192/512, drawn by a scratch Python script) —
  "Add to Home Screen" runs chrome-free in fullscreen landscape.
- **📲 Install as App menu button**: Android/Chrome fires the native
  install prompt via `beforeinstallprompt`; iOS shows Share → Add to
  Home Screen instructions (Apple allows no programmatic install).
  Button hides itself when already installed. iOS caveat: instructions
  only work in real Safari, not in-app browsers.

## Publishing

- **Live site**: https://shorelineexotics.github.io/Web-Swinger-1.0/
  (GitHub Pages, repo `shorelineexotics/Web-Swinger-1.0`, public).
  Deploys automatically ~1 min after every push to `main`.
- **Workflow**: Claude commits locally → user pushes via GitHub Desktop.
- **Claude artifact** (claude.ai/code/artifact/dfcf57bc-…): static
  snapshot, currently BEHIND the repo (predates the mobile work).
  Republish on request; it does not track local files.

## Ideas parked for next session

- Surgical fix for "short roof + long rope + tall obstacle" moments
  (rather than the global clearance rule): e.g. only shorten ropes when
  the *anchor building itself* is in the shortest band, or bias the anchor
  scorer away from max-length ropes on low roofs.
- Possible knobs if difficulty needs a nudge either way:
  - Furniture/car spawn rates — `populate()` / `carTimer` in
    [js/obstacles.js](js/obstacles.js)
  - Pace pressure — `PACE_BASE`, `PACE_MAX_BONUS` in config
  - Rope feel — `WEB_MIN_LEN` (raise to ~110–130 to soften short-rope whip)
- Not yet explored: score multiplier tied to low-altitude ("risky") swinging,
  more car variety, boss-ish setpieces (helicopter chase sections).

## Housekeeping
- Dev server: `python3 -m http.server 8123` from the project folder
  (or just open index.html).
- After code edits, hard-refresh (Cmd+Shift+R) — the browser caches JS.
- Save data lives in localStorage under `webswinger.save.v1`.
