import assert from "node:assert/strict";
import { LightGrid } from "@/systems/world/lightGrid";
import {
  spawnLightAllowed,
  inRing,
  spawnRadii,
  hasCapacity,
} from "@/systems/combat/spawnRules";
import { recycleDistant, spawnPoint } from "@/systems/combat/spawnPopulation";
import {
  createTestRun,
  getTestEternalSystems,
  addTestEnemy,
  getTestSystems,
} from "./fixtures/testFactories";
import { it } from "./fixtures/it";
import { syncRunLight, ignite } from "@/systems/world/runLight";
import { spawnNightRaid } from "@/systems/combat/enemySpawn";
import { blockedAt } from "@/systems/world/collision";

it("火源叠加、移动、熄灭只影响对应瓦片，阴影怪避开微光", () => {
  const grid = new LightGrid(16);
  const p = { x: -8, y: 8 },
    fire = { ...p, id: "fire", radius: 36 },
    torch = { ...p, id: "torch", radius: 16 };
  grid.sync(4, [fire, torch]);
  assert.deepEqual(grid.getLightLevel(p.x, p.y), {
    sky: 4,
    block: 15,
    effective: 15,
  });
  assert.equal(spawnLightAllowed(grid, p, "frost_rat"), false);
  fire.x += 160;
  grid.sync(4, [fire, torch]);
  assert.equal(grid.getLightLevel(p.x, p.y).block, 15);
  grid.sync(4, [fire]);
  assert.ok(spawnLightAllowed(grid, p, "frost_rat"));
  const edge = { x: fire.x + 48, y: fire.y };
  assert.ok(spawnLightAllowed(grid, edge, "frost_rat"));
  assert.equal(spawnLightAllowed(grid, edge, "coal_shade"), false);
  grid.sync(15, []);
  assert.equal(spawnLightAllowed(grid, p, "frost_rat"), false);
});
it("实际波次的候选点位于双环、视口外、可通行且符合光照", () => {
  const sys = {
    ...getTestEternalSystems(),
    spawnView: { x: 80, y: 160, width: 320, height: 160 },
  };
  const state = createTestRun({
    systems: sys,
    elapsedSec: 180,
    phase: "night",
  });
  const ring = spawnRadii(sys.data.balance.survival, 16, sys.spawnView);
  assert.ok(ring.min > Math.hypot(320, 160) / 2);
  for (const d of [ring.min - 1, ring.min, ring.max, ring.max + 1])
    assert.equal(
      inRing({ x: d, y: 0 }, { x: 0, y: 0 }, ring),
      d >= ring.min && d <= ring.max,
    );
  for (let i = 0; i < 16; i++) {
    const p = spawnPoint(state, sys, "coal_shade");
    assert.ok(p);
    assert.ok(inRing(p, state.hero, ring, sys.spawnView));
    assert.equal(syncRunLight(state, sys).getLightLevel(p.x, p.y).block, 0);
    assert.equal(blockedAt(sys.world, {}, p.x, p.y, 6), false);
  }
});
it("超距释放分类上限，首领、剧情、任务和交互标记免疫", () => {
  const sys = getTestEternalSystems();
  const state = createTestRun({ systems: sys });
  const mob = addTestEnemy(state, sys, "frost_rat", { x: 5000 });
  const settings = {
    ...sys.data.balance.survival,
    categoryCap: { hostile: 1, elite: 1, neutral: 1 },
  };
  assert.equal(hasCapacity([mob], "hostile", settings), false);
  for (const flag of [
    "boss",
    "persistent",
    "taskLocked",
    "playerInteracted",
  ] as const)
    addTestEnemy(state, sys, "ice_ram", { x: 5000, [flag]: true });
  recycleDistant(state, sys);
  assert.equal(state.enemiesById[mob.id], undefined);
  assert.equal(Object.keys(state.enemiesById).length, 4);
  assert.ok(hasCapacity(Object.values(state.enemiesById), "hostile", settings));
});
it("冒险常驻和固定波次带保护标记，临时燃烧到期后熄灭", () => {
  const sys = getTestSystems();
  const state = createTestRun({ elapsedSec: 360, phase: "night" });
  spawnNightRaid(state, sys, []);
  assert.ok(
    Object.values(state.enemiesById).some((e) => e.nightRound !== null),
  );
  assert.ok(Object.values(state.enemiesById).every((e) => e.persistent));
  const p = { x: 2000, y: 2000 };
  ignite(state, { ...p, radius: 60, id: "resin" }, 2);
  assert.ok(syncRunLight(state, sys).getLightLevel(p.x, p.y).block > 2);
  state.elapsedSec += 2;
  assert.equal(syncRunLight(state, sys).getLightLevel(p.x, p.y).block, 0);
});

it("超宽视口没有合法环带时不会越过配置外环生成", () => {
  const sys = {
    ...getTestEternalSystems(),
    spawnView: { x: -500, y: -500, width: 1600, height: 1600 },
  };
  const state = createTestRun({ systems: sys, elapsedSec: 180 });
  const ring = spawnRadii(
    sys.data.balance.survival,
    sys.data.tileSize,
    sys.spawnView,
  );
  assert.equal(
    ring.max,
    sys.data.balance.survival.maxSpawnRadius * sys.data.tileSize,
  );
  assert.equal(spawnPoint(state, sys, "frost_rat"), null);
});

it("分类上限独立覆写，非法环距回退，零上限禁止实际刷怪", async () => {
  const { loadSurvivalTuning } = await import("@/systems/survivalTuning");
  const base = getTestEternalSystems();
  const override = await loadSurvivalTuning(async () =>
    Response.json({ categoryCap: { hostile: 0 } }),
  );
  const sys = {
    ...base,
    data: {
      ...base.data,
      balance: { ...base.data.balance, survival: override },
    },
  };
  const state = createTestRun({ systems: sys, elapsedSec: 180 });
  assert.equal(spawnPoint(state, sys, "frost_rat"), null);
  assert.ok(spawnPoint(state, sys, "ice_ram"));
  assert.equal(
    override.categoryCap.neutral,
    base.data.balance.survival.categoryCap.neutral,
  );
  assert.deepEqual(
    await loadSurvivalTuning(async () => Response.json({ maxSpawnRadius: 5 })),
    base.data.balance.survival,
  );
});
