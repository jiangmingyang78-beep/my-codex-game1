(async () => {
  const { rules } = await import("/src/systems/runtimeRules.ts");
  const { blockedAt } = await import("/src/systems/world/collision.ts");
  const { TILE } = await import("/src/systems/world/worldTypes.ts");
  const { isHeroDashActive, resetDashCooldown } = await import("/src/systems/movement.ts");
  const { state, sys } = window.regressionSession;
  const { world, data } = sys,
    size = world.tileSize;
  const tile = (n) => (n + 0.5) * size;
  const place = (x, y) => Object.assign(state.hero, { x: tile(x), y: tile(y) });
  let sample = null,
    peakActive = 0,
    trackRaid = false;
  const xy = () => ({ x: state.hero.x, y: state.hero.y });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const tileAt = () =>
    world.tiles[Math.floor(state.hero.y / size) * world.widthTiles + Math.floor(state.hero.x / size)];
  const frame = () => {
    Object.assign(state.hero, { hp: 6, hunger: 100, light: 100, invulnerableSec: 1 });
    if (sample) {
      const active = isHeroDashActive(state),
        p = xy();
      if (active) sample.started = true;
      if (sample.started) {
        if (blockedAt(world, state.changesByObjectId, p.x, p.y, 5)) sample.blockedFrames++;
        if (tileAt() === TILE.ice) sample.iceFrames++;
        if (!active && !sample.end) {
          sample.end = p;
          sample.endSec = state.elapsedSec;
        }
        if (sample.end && state.elapsedSec - sample.endSec >= 0.35) sample.finish ??= p;
      }
    }
    if (trackRaid) peakActive = Math.max(peakActive, counts().active);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const counts = () => {
    const raiders = [];
    let active = 0;
    for (const e of Object.values(state.enemiesById)) {
      if (e.nightRound !== null) {
        raiders.push(e.id);
        active++;
      } else if (world.spawns.get(e.spawnId)?.regionId === state.regionId) active++;
    }
    return { region: state.regionId, active, raiders };
  };
  window.regression = {
    counts,
    raidPeak() {
      return peakActive;
    },
    stageRaid() {
      trackRaid = true;
      Object.assign(rules, { weights: { camp_edge: 4, old_mill: 4 }, waves: { count: 6, intervalSec: 2 } });
      state.elapsedSec = data.balance.clock.daySec - 0.15;
      state.changesByObjectId.old_mill_gate = { opened: true };
      place(46, 24);
    },
    stageCrossing() {
      const near = Object.values(state.enemiesById).find((e) => e.nightRound === 1);
      Object.assign(near, { x: tile(43), y: tile(24), cooldownSec: 60, phase: "chase" });
      return near.id;
    },
    beyond(region) {
      return state.regionId === region && (region === "old_mill" ? state.hero.x >= tile(49) : state.hero.x <= tile(46));
    },
    stageDash(fixture, long) {
      trackRaid = false;
      delete rules.dash;
      if (long) rules.dash = { distanceTiles: 8, cooldownSec: 1 };
      for (const id of Object.keys(state.enemiesById)) delete state.enemiesById[id];
      state.elapsedSec = data.balance.clock.daySec + data.balance.clock.nightSec + 10;
      resetDashCooldown(state);
      if (fixture === "ice") {
        place(56, 56);
        state.regionId = "frozen_brook";
      } else {
        place(58, 24);
        state.regionId = "old_mill";
        world.tiles[25 * world.widthTiles + 60] = TILE.wall;
        world.tiles[24 * world.widthTiles + 60] = fixture === "closed" ? TILE.wall : TILE.floor;
      }
      sample = { start: xy(), started: false, end: null, finish: null, blockedFrames: 0, iceFrames: 0 };
    },
    dashActive() {
      return sample?.started ?? false;
    },
    dashResult() {
      if (!sample?.finish) return null;
      const { start, end, finish, blockedFrames, iceFrames } = sample;
      return { x: end.x, y: end.y, dash: distance(start, end), coast: distance(end, finish), blockedFrames, iceFrames };
    },
  };
})();
