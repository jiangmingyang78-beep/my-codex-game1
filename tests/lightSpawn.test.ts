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

it("Fire sources are stacked, moved and extinguished only to the corresponding tiles, and the shadows are kept away from the light", () => {
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
it("The actual wave is located in two rings, out of sight, accessible and in line with light", () => {
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
it("Exceeding the upper limit of the classification of releases, chief, plot, task and cross-marking immunization", () => {
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
it("The risk-based permanent and fixed band protection mark is extinguished after the temporary burning has expired", () => {
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

it("The hyper-vision mouth is not generated beyond the external ring of the configuration when it does not have a legal ring", () => {
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

it("The upper limit of the classification covers independently, the illegal loops retreat and the zero ceiling prohibits actual derision", async () => {
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
