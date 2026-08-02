/* ============================================================
 * Web Swinger 1.0 — config.js
 * Central tuning table. Every gameplay number lives here so the
 * feel of the game can be adjusted without touching logic.
 * World units are pixels at reference zoom. +y is DOWN.
 * ============================================================ */

const CONFIG = {
  // --- World -------------------------------------------------
  GROUND_Y: 1000,          // street level (touching it = death)
  SKY_LIMIT: -900,         // soft ceiling, nothing spawns above
  GRAVITY: 2350,           // px/s^2
  PX_PER_METER: 22,        // world px -> displayed meters
  REF_VIEW_HEIGHT: 1080,   // reference vertical world size on screen

  // --- Player ------------------------------------------------
  PLAYER_RADIUS: 13,
  // Standing on the top-right corner of the starting tower
  // (coupled to the platform spawned in BuildingField.reset:
  // x 60, width 460, roof at GROUND_Y - 520).
  PLAYER_START_X: 480,
  PLAYER_START_Y: 466,
  PLAYER_MAX_SPEED: 1380,  // hard cap (~225 km/h on the HUD)
  SOFT_SPEED: 860,         // swing speeds above this decay smoothly
  SOFT_SPEED_DRAG: 2.1,    // fraction of the excess shed per second (attached only)
  SWING_ASSIST: 240,       // gentle forward accel while attached (keeps pace)
  AIR_DRAG: 0.06,          // per-second velocity damping in free fall
  RELEASE_BOOST: 1.09,     // fling reward for letting go
  PERFECT_BOOST: 1.16,     // extra fling for a perfect release
  PERFECT_UP_VEL: -90,     // must be rising at least this fast (y is down)
  PERFECT_MIN_SPEED: 620,

  // --- Web / rope --------------------------------------------
  WEB_RANGE: 470,          // max anchor search distance
  WEB_MIN_LEN: 70,
  WEB_MAX_LEN: 390,
  WEB_FIRE_TIME: 0.055,    // seconds for the web to visually reach anchor
  WEB_ZIP: 260,            // attach impulse toward the anchor (thwip-zip)

  // --- Rescue grab -------------------------------------------
  // When the normal search finds nothing and the player is diving,
  // a second, more generous search runs so a fall can be saved.
  RESCUE_VY: 300,          // must be falling at least this fast
  RESCUE_RANGE: 620,       // extended search radius
  RESCUE_BEHIND: 150,      // may grab up to this far behind the player
  RESCUE_ZIP: 430,         // harder yank toward the anchor on attach

  // --- Pace (the "never stop moving" pressure) ----------------
  PACE_BASE: 300,          // px/s scroll floor at distance 0
  PACE_MAX_BONUS: 520,     // added by the time difficulty maxes out
  PACE_LATE_GROWTH: 0.028, // px/s per meter past the difficulty ramp

  // --- Difficulty ---------------------------------------------
  DIFF_RAMP_METERS: 1400,  // meters over which difficulty ramps 0 -> 1
  EASY_START_METERS: 130,  // hazard-free warmup stretch

  // --- Buildings ----------------------------------------------
  BLD_WIDTH_MIN: 220,
  BLD_WIDTH_MAX: 520,
  BLD_HEIGHT_MIN: 460,     // measured up from the ground — keeps every
                           // rooftop anchor high enough to swing under
  BLD_HEIGHT_MAX: 780,
  BLD_GAP_MIN: 110,
  BLD_GAP_MAX_EASY: 240,
  BLD_GAP_MAX_HARD: 460,
  BLD_HVAR_EASY: 140,      // max roof height change between neighbours
  BLD_HVAR_HARD: 420,

  // --- Camera --------------------------------------------------
  CAM_LOOKAHEAD: 0.34,     // seconds of velocity to look ahead
  CAM_SMOOTH: 5.2,         // follow stiffness (higher = tighter)
  CAM_ZOOM_MIN: 0.62,      // zoom at max speed (zoomed out)
  CAM_ZOOM_MAX: 0.86,      // zoom when slow
  CAM_ZOOM_SPEED_REF: 1500,
  CAM_MIN_SCALE: 0.52,     // floor on world scale — stops short screens
                           // (phones in landscape) from zooming out to
                           // a tiny, distant view

  // --- Feel ----------------------------------------------------
  NEAR_MISS_DIST: 26,      // extra radius that counts as a near miss
  NEAR_MISS_SLOWMO: 0.38,  // timescale during a near miss
  NEAR_MISS_TIME: 0.38,    // seconds of slow motion
  DEATH_SLOWMO: 0.25,
  SHAKE_DEATH: 22,
  SHAKE_ATTACH: 2.5,

  // --- Audio ----------------------------------------------------
  MUSIC_BPM: 112,

  // --- Day/night cycle -------------------------------------------
  CYCLE_METERS: 900,       // one full sunset->night->dawn per this distance
};

/** Difficulty 0..1 (plus slow creep after the ramp) for a given distance. */
function difficultyAt(meters) {
  return Math.min(1, meters / CONFIG.DIFF_RAMP_METERS);
}
