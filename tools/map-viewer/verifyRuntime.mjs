import assert from "node:assert/strict";
import { createServer } from "../../src/frontend/node_modules/vite/dist/node/index.js";
const server = await createServer({ configFile: "tools/map-viewer/vite.config.mjs", server: { middlewareMode: true } });
try {
  const load = (name) => server.ssrLoadModule(name);
  const { rules } = await load("@/systems/runtimeRules");
  const { getSystems } = await load("@/core/systems");
  const { createRun, step } = await load("@/core/run");
  const { moveHero, getDashCooldownState } = await load("@/systems/movement");
  const { updateEnemies } = await load("@/systems/EnemyManager.js");
  const { renewAtDawn, renewTimed, recordHarvest } = await load("@/systems/world/dawn");
  const sys = getSystems();
  function reset(config = {}) {
    for (const k of Object.keys(rules)) delete rules[k];
    Object.assign(rules, config);
    return createRun({ systems: sys, seed: 1 });
  }
  function dash(config) {
    const state = reset(config),
      x = state.hero.x;
    for (let i = 0; i < 4; i++) moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: i === 0 }, 0.04);
    return [Number(((state.hero.x - x) / 16).toFixed(2)), getDashCooldownState(state, sys).maxSec];
  }
  assert.deepEqual(dash({}), [1.88, 1.6]);
  assert.deepEqual(dash({ dash: { distanceTiles: 3, cooldownSec: 2 } }), [3, 2]);
  function perceive(config, distance, phase, enemyId) {
    const state = reset(config),
      e = Object.values(state.enemiesById).find((e) => e.enemyId === enemyId);
    state.enemiesById = { [e.id]: e };
    state.regionId = sys.world.spawns.get(e.spawnId).regionId;
    state.hero.x = e.x + distance * 16;
    state.hero.y = e.y;
    e.phase = phase;
    updateEnemies(state, sys, 0.01, []);
    return e.phase;
  }
  for (const id of ["snow_weasel", "mill_spider"]) {
    assert.equal(perceive({}, 10, "idle", id), "idle");
    assert.equal(perceive({ perception: { aggroTiles: 11 } }, 10, "idle", id), "chase");
    assert.equal(perceive({}, 13, "chase", id), "chase");
    assert.equal(perceive({ perception: { leashTiles: 12 } }, 13, "chase", id), "idle");
  }
  function raids(config) {
    const state = reset(config);
    state.elapsedSec = sys.data.balance.clock.daySec - 0.025;
    const sequence = [];
    for (let i = 0; i < 8; i++) {
      step(state, { sec: 0.05 }, sys);
      sequence.push(Object.values(state.enemiesById).filter((e) => e.nightRound !== null).length);
    }
    return sequence;
  }
  assert.equal(raids({}).at(-1), 2);
  assert.equal(raids({ weights: { camp_edge: 0.5 } }).at(-1), 1);
  const fast = raids({ waves: { count: 2, intervalSec: 0.1 } }),
    slow = raids({ waves: { count: 2, intervalSec: 0.25 } });
  assert.equal(fast.at(-1), 4);
  assert(fast.indexOf(4) < slow.indexOf(4));
  const node = sys.world.objectList.find((o) => o.renewable);
  function harvest(state, n) {
    state.changesByObjectId[n.id] = { ...state.changesByObjectId[n.id], gathered: true };
    recordHarvest(state, n);
  }
  let state = reset();
  harvest(state, node);
  assert.equal(renewAtDawn(state, sys), 1);
  harvest(state, node);
  assert.equal(renewAtDawn(state, sys), 1);
  state = reset({ resources: { renewalLimit: 2, cooldownSec: 10 } });
  const tuned = { ...node, renewalLimit: 1, respawnCooldownSec: 2 };
  const timedSys = { ...sys, world: { ...sys.world, objectList: [tuned] } };
  harvest(state, tuned);
  state.elapsedSec = 1;
  renewTimed(state, timedSys);
  assert(state.changesByObjectId[node.id].gathered);
  state = createRun({ systems: sys }, state);
  state.elapsedSec = 2;
  renewTimed(state, timedSys);
  assert.equal(state.changesByObjectId[node.id].renewals, 1);
  harvest(state, tuned);
  state.elapsedSec = 4;
  renewTimed(state, timedSys);
  assert(state.changesByObjectId[node.id].gathered);
  state = reset({ resources: { renewalLimit: 2, cooldownSec: 10 } });
  harvest(state, node);
  state.elapsedSec = 9;
  renewAtDawn(state, sys);
  assert(state.changesByObjectId[node.id].gathered);
  state.elapsedSec = 10;
  renewTimed(state, { ...sys, world: { ...sys.world } });
  assert.equal(state.changesByObjectId[node.id].renewals, 1);
  const { scaledStock, nightWaves, waveSlot } = await load("@/systems/survivalTuning");
  assert.deepEqual(scaledStock({ wood: 4 }, 1), { wood: 4 });
  assert.deepEqual(scaledStock({ wood: 4 }, 2), { wood: 8 });
  assert.deepEqual(
    [0.5, 1, 2].map((f) => [1, 2].map((day) => nightWaves(day, f))),
    [
      [0, 1],
      [1, 1],
      [2, 2],
    ],
  );
  assert.equal(waveSlot(150, 120, 48, 1), 0);
  assert.equal(waveSlot(150, 120, 48, 2), 1);
  const { buildSurvivalSnapshot } = await load("/adapters/survivalAdapter.ts");
  const counts = [0, 1, 2].map((n) => buildSurvivalSnapshot("42", n).tiles.filter((t) => [0, 6, 8].includes(t)).length);
  assert(counts[0] < counts[1] && counts[1] < counts[2]);
  console.log("通过：急步、两套敌人 AI、夜袭间隔/波数/区域权重、资源次数/冷却及读档、生存倍率。种子 42 资源格", counts);
} finally {
  await server.close();
}
