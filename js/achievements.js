/* ============================================================
 * Web Swinger 1.0 — achievements.js
 * Definitions + checks. `check(stats)` is called during play and
 * on death; newly earned achievements toast and may unlock skins.
 * ============================================================ */

const ACHIEVEMENTS = [
  { id: 'first_swing',  name: 'Look Ma, No Hands', desc: 'Attach your first web',        test: s => s.swings >= 1 },
  { id: 'm100',         name: 'Block Party',       desc: 'Travel 100m in one run',       test: s => s.meters >= 100 },
  { id: 'm500',         name: 'Commuter',          desc: 'Travel 500m in one run',       test: s => s.meters >= 500, skin: 'crimson' },
  { id: 'm1000',        name: 'Marathon Swinger',  desc: 'Travel 1,000m in one run',     test: s => s.meters >= 1000, skin: 'gold' },
  { id: 'm2500',        name: 'City Legend',       desc: 'Travel 2,500m in one run',     test: s => s.meters >= 2500 },
  { id: 'combo5',       name: 'In the Groove',     desc: 'Hit a x5 perfect combo',       test: s => s.combo >= 5 },
  { id: 'combo10',      name: 'Untouchable',       desc: 'Hit a x10 perfect combo',      test: s => s.combo >= 10, skin: 'neon' },
  { id: 'nearmiss5',    name: 'Thread the Needle', desc: '5 near misses in one run',     test: s => s.nearMisses >= 5 },
  { id: 'speed150',     name: 'Speed Demon',       desc: 'Exceed 150 km/h',              test: s => s.topKmh >= 150 },
  { id: 'die25',        name: 'Get Up Again',      desc: 'Fall 25 times',                test: s => Storage.data.deaths >= 25, skin: 'noir' },
  { id: 'daily1',       name: 'Creature of Habit', desc: 'Play a Daily Challenge',       test: s => s.playedDaily, skin: 'ghost' },
];

class AchievementTracker {
  constructor(ui, audio) { this.ui = ui; this.audio = audio; }

  /** Evaluate all achievements against current run stats. */
  check(stats) {
    for (const a of ACHIEVEMENTS) {
      if (Storage.data.achievements[a.id]) continue;
      if (!a.test(stats)) continue;
      Storage.unlockAchievement(a.id);
      this.audio.achievement();
      this.ui.toast(`🏆 ${a.name}`, a.desc);
      if (a.skin && Storage.unlockSkin(a.skin)) {
        const sk = getSkin(a.skin);
        this.ui.toast(`🎨 Skin unlocked: ${sk.name}`, sk.unlock);
      }
    }
  }
}
