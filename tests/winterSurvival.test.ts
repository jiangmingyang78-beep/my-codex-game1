import assert from "node:assert/strict";
import { it } from "node:test";
import {
  winterDay,
  winterPhase,
  raidBudget,
  raidRules,
} from "@/systems/survival/rhythm";
import {
  scheduleRaid,
  raidForecast,
  advanceRaid,
  finishRaid,
  dawnAsh,
} from "@/systems/survival/nightForecast";
import {
  campProjects,
  campProjectComplete,
  campTier,
  donateCampMaterials,
  normalizeCampProjects,
  fireDrainRate,
  hearth,
  tickHearth,
  feedHearth,
} from "@/systems/survival/campProjects";
import { survivalFireNodes } from "@/game/world/CampFires";
import { LightGrid } from "@/systems/world/lightGrid";
import { campApproaches } from "@/systems/survival/campApproach";
import { raidSpawnPoints } from "@/systems/survival/raidSpawn";
import { beaconGuardsAngle } from "@/systems/survival/campProjects";
import {
  createWeatherState,
  getWeatherModifiers,
} from "@/systems/survival/weatherSystem";

it("The herb shelf was adjusted to the crude fibre and the old-tailed delivery schedule was maintained", () => {
  const partial = normalizeCampProjects({ dryingRack: { wood: 4, reed: 1 } });
  assert.deepEqual(partial.dryingRack, { wood: 4, fiber: 1 });
  assert.equal(campProjectComplete(partial, "dryingRack"), false);

  const completed = normalizeCampProjects({ dryingRack: { wood: 4, reed: 2 } });
  assert.equal(campProjectComplete(completed, "dryingRack"), true);
  assert.deepEqual(normalizeCampProjects(completed), completed);
});

it("The tide of the sky and the dawn has prolonged the night, with three segments of the border and days running on the old slot", () => {
  const first = winterDay(1, 120, 72, 0),
    late = winterDay(12, 120, 72, 0);
  const snow = createWeatherState();
  snow.weatherId = "blizzard";
  const storm = winterDay(12, 120, 72, getWeatherModifiers(snow).winterShift);
  assert.ok(
    first.nightStart > late.nightStart && late.nightStart > storm.nightStart,
  );
  assert.ok(storm.cold > late.cold && late.cold > first.cold);
  for (const c of [first, late, storm, winterDay(500, 12, 240, 0.2)]) {
    assert.ok(
      0 < c.duskStart && c.duskStart < c.nightStart && c.nightStart < c.cycle,
    );
    assert.deepEqual(
      [0, c.duskStart, c.nightStart, c.cycle - 0.01].map((t) =>
        winterPhase(c, t),
      ),
      ["day", "dusk", "night", "night"],
    );
  }
  assert.equal(first.cycle, late.cycle);
});

it("The seed schedule can be repeated, with the warning beginning 30 - 45 seconds before arrival and the reloading triggering without repetition. —", () => {
  const gaps = new Set<number>(),
    arrivals = new Set<number>();
  for (let seed = 0; seed < 32; seed++) {
    const raid = scheduleRaid(seed, 0, 1);
    const c = winterDay(raid.day, 120, 72, 0);
    const { arrival, lead } = raidForecast(seed, c, 0, raid);
    assert.ok(lead >= 30 && lead <= 45);
    arrivals.add(
      Math.round(((arrival - c.nightStart) / (c.cycle - c.nightStart)) * 100),
    );
    const at = (time: number) => raidForecast(seed, c, time, raid);
    assert.equal(at(arrival - lead - 0.01).warning, 0);
    for (const [seconds, stage] of [
      [lead - 0.01, 1],
      [raidRules.nearSec - 0.01, 2],
      [raidRules.urgentSec - 0.01, 3],
    ]) {
      const f = at(arrival - seconds);
      assert.equal(advanceRaid(raid, f, 5), "warning");
      assert.equal(raid.warning, stage);
      assert.equal(advanceRaid(structuredClone(raid), f, 5), null);
    }
    assert.equal(advanceRaid(raid, at(arrival - 0.01), 5), null);
    assert.equal(advanceRaid(raid, at(arrival), 5), "arrival");
    assert.equal(advanceRaid(raid, at(arrival), 5), null);
    const next = scheduleRaid(seed, raid.day, 1);
    gaps.add(next.day - raid.day);
    assert.deepEqual(next, scheduleRaid(seed, raid.day, 1));
    assert.ok(
      Math.abs(next.day - raid.day - raidRules.intervalDays) <=
        raidRules.jitterDays,
    );
  }
  assert.ok(gaps.size > 1 && arrivals.size === 2);
  assert.equal(scheduleRaid(5, 0, 0).day, 0);
});

it("The budget for the attack camp was influenced by the number of days and the level of the camp, and the full wave of the attack had to be repelled before the settlement at dawn", () => {
  assert.ok(raidBudget(5, 0, 3, 1) > raidBudget(1, 0, 3, 1));
  assert.ok(raidBudget(5, 3, 3, 1) > raidBudget(5, 0, 3, 1));
  assert.equal(raidBudget(50, 4, 0, 1), 0);
  const raid = scheduleRaid(1, 0, 1);
  raid.stage = "active";
  raid.remaining = raid.budget = 4;
  assert.equal(finishRaid(raid, 0), false);
  raid.remaining = 0;
  assert.equal(finishRaid(raid, 1), false);
  assert.equal(dawnAsh(raid), 0);
  assert.equal(finishRaid(raid, 0), true);
  assert.ok(dawnAsh(raid) > 0);
  assert.equal(dawnAsh(structuredClone(raid)), 0);
});

it("The post was sealed on the bright side and the attacker entered only from the outer perimeter, which was accessible and lightly permitted", () => {
  const grid = new LightGrid(16);
  grid.sync(0, []);
  const routes = campApproaches(
    { x: 0, y: 0 },
    23,
    (x, y) => x !== -7 || y > 0,
  );
  assert.ok(!routes.has("-7,0"));
  const center = { x: 8, y: 8 },
    tuning = {
      minSpawnRadius: 15,
      maxSpawnRadius: 22,
      despawnRadius: 30,
      categoryCap: { hostile: 12, elite: 4, neutral: 12 },
    };
  const ctx = {
    seed: 42,
    day: 4,
    age: 800,
    remaining: 8,
    center,
    tile: 16,
    tuning,
    guarded: true,
    routes,
    grid,
    view: { x: -184, y: -104, width: 384, height: 224 },
    enemies: [],
    pool: [{ id: "ash_wolf" }],
  };
  const spawns = raidSpawnPoints(ctx);
  assert.equal(spawns.length, 8);
  for (const p of spawns) {
    assert.ok(routes.has(Math.floor(p.x / 16) + "," + Math.floor(p.y / 16)));
    assert.equal(
      beaconGuardsAngle(Math.atan2(p.y - center.y, p.x - center.x)),
      false,
    );
  }
  grid.sync(15, []);
  assert.deepEqual(raidSpawnPoints(ctx), []);
});

it("The fourth-level facility in the camp is built on a forward construction basis, with batches of ready-to-read deliveries, and the wind-boiling ponds are protected only by additional wind consumption", () => {
  const progress = normalizeCampProjects(null),
    stock = { ...campProjects.kiln.cost };
  assert.equal(donateCampMaterials(progress, "kiln", stock), false);
  assert.deepEqual(stock, campProjects.kiln.cost);
  for (const id of [
    "windHearth",
    "kiln",
    "dryingRack",
    "watchPyre",
    "stakes",
    "stoker",
  ] as const) {
    assert.ok(donateCampMaterials(progress, id, { ...campProjects[id].cost }));
    assert.ok(
      campProjectComplete(normalizeCampProjects(structuredClone(progress)), id),
    );
    assert.equal(campTier(progress), campProjects[id].tier);
  }
  const calm = fireDrainRate(1, false, 1),
    wind = fireDrainRate(1.45, false, 1);
  assert.equal(fireDrainRate(1, true, 1), calm);
  assert.ok(
    Math.abs(
      fireDrainRate(1.45, true, 1) -
        calm -
        (wind - calm) * hearth.windPenaltyFraction,
    ) < 1e-7,
  );
  const state = {
    fuel: 0,
    stock: { wood: 1, charBlock: 1 },
    campProjects: progress,
  };
  tickHearth(state, 1, 1.45, 1, false);
  assert.equal(state.fuel, 0);
  tickHearth(state, 1, 1.45, 1, true);
  assert.equal(state.fuel, hearth.fuelValues.charBlock);
  assert.deepEqual(state.stock, { wood: 1, charBlock: 0 });
  assert.equal(feedHearth(state, "charBlock"), false);
  const grid = new LightGrid(16);
  const nodes = survivalFireNodes({ x: 8, y: 8 }, 16, true, true, true);
  grid.sync(
    0,
    nodes.map((s, i) => ({ ...s, id: String(i) })),
  );
  assert.ok(grid.getLightLevel(nodes[1].x, nodes[1].y).block > 2);
  assert.ok(nodes[0].radius > hearth.baseRadiusPx);
  assert.deepEqual(
    survivalFireNodes({ x: 8, y: 8 }, 16, false, true, true),
    [],
  );
});
