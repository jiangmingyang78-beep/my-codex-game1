import assert from "node:assert/strict";
import { it } from "node:test";
import { createRun } from "@/core/run";
import { loadRun, saveRun } from "@/core/save";
import type { GameEvent } from "@/core/types";
import { getPlantDef } from "@/systems/survival/plantRegistry";
import {
  getWeatherModifiers,
  createWeatherState,
} from "@/systems/survival/weatherSystem";
import {
  ElementGrid,
  elementalRules,
  type ElementTerrain,
} from "@/systems/world/elementGrid";
import {
  runTerrain,
  stepRunEnvironment,
  igniteRunTile,
} from "@/systems/world/runElements";
import { syncRunLight } from "@/systems/world/runLight";
import { moveHero } from "@/systems/movement";
import { chillSpeed } from "@/systems/buffs";
import { ElementMarks } from "@/game/world/ElementMarks";
import {
  addTestEnemy,
  createTestRun,
  createMemoryStorage,
  getTestSystems,
} from "./fixtures/testFactories";

const open: ElementTerrain = {
  snowy: () => true,
  fireproof: () => false,
  flammable: () => false,
};
function climate(id: string) {
  const w = createWeatherState(42);
  w.weatherId = id;
  w.previousWeatherId = id;
  return getWeatherModifiers(w);
}
const clear = climate("clear");

it("The burning bush fires by grid, the non-flammable plants and the opposite grids cannot fire and the fixed step progress has nothing to do with frame rates", () => {
  const terrain = {
    ...open,
    flammable: (x: number, y: number) =>
      y === 0 &&
      x > 0 &&
      Boolean(getPlantDef(x === 2 ? "glow_cap" : "snow_berry_bush")?.flammable),
  };
  const simulate = (dt: number) => {
    const g = new ElementGrid(16, 1),
      events: GameEvent[] = [];
    g.ignite(0, 0, terrain, events);
    for (let i = 0; i < 3 / dt; i++) g.advance(dt, clear, terrain, events);
    return events
      .filter(
        (e) => e.payload.surface === "burning" && e.type === "element.changed",
      )
      .map((e) => [e.payload.tx, e.payload.ty]);
  };
  assert.deepEqual(simulate(0.25), [
    [0, 0],
    [1, 0],
  ]);
  assert.deepEqual(simulate(0.03125), simulate(0.25));
});

it("The snowstorms accelerate the elimination and reduce the probability of ignition, the rains completely curb the spread and the fire restores the halo after the rains. —", () => {
  const sys = getTestSystems(),
    state = createTestRun({ hero: { x: 808, y: 408 } });
  const terrain = { ...open, flammable: () => true };
  for (const id of ["blizzard", "heavy_rain"]) {
    const g = new ElementGrid(16, 42),
      events: GameEvent[] = [];
    const storm = climate(id);
    assert.ok(storm.spreadMult < clear.spreadMult);
    g.ignite(0, 0, terrain, events);
    g.advance(1, storm, terrain, events);
    assert.ok(g.at(0, 0)!.scorched > 0);
    assert.ok(!g.ignite(0, 0, terrain, events));
    if (id === "heavy_rain")
      assert.equal(
        events.filter(
          (e) =>
            e.type === "element.changed" && e.payload.surface === "burning",
        ).length,
        1,
      );
  }
  const g = new ElementGrid(16);
  g.ignite(0, 0, open, []);
  g.advance(1, clear, open, []);
  assert.ok(g.at(0, 0)!.burning > 0);
  const sample = () =>
    syncRunLight(state, sys).getLightLevel(state.hero.x + 32, state.hero.y)
      .block;
  const normal = sample();
  state.weather.weatherId = "heavy_rain";
  assert.ok(sample() < normal);
  state.weather.weatherId = "clear";
  assert.equal(sample(), normal);
});

it("Independent fire source sharing 64 hard ceilings, up to four steps per chain", () => {
  const all = { ...open, snowy: () => false, flammable: () => true };
  const g = new ElementGrid(16, 1),
    events: GameEvent[] = [];
  for (let i = 0; i < 80; i++)
    assert.equal(g.ignite(i * 20, 0, all, events), i < 64);
  g.advance(0.25, clear, all, events);
  assert.equal([...g.lights].length, 64);
  const chain = new ElementGrid(16, 42);
  chain.ignite(0, 0, all, []);
  const changes: GameEvent[] = [];
  for (let i = 0; i < 100; i++) {
    chain.advance(0.25, clear, all, changes);
    assert.ok([...chain.lights].length <= 64);
  }
  const lit = changes.filter(
    (e) => e.type === "element.changed" && e.payload.surface === "burning",
  );
  assert.ok(lit.length >= 4);
  assert.ok(
    lit.every(
      (e) =>
        Math.abs(Number(e.payload.tx)) + Math.abs(Number(e.payload.ty)) <=
        elementalRules.maxSpreadSteps,
    ),
  );
});

it("Snow melting removes the penalty for physical movement and retains the mud resistance and snow re-grows", () => {
  const base = getTestSystems(),
    meta = {
      snowDepth: 1,
      walkSpeedMultiplier: 0.7,
      material: "snow" as const,
      biomeId: 0,
    };
  const sys = {
    ...base,
    world: {
      ...base.world,
      tiles: new Uint8Array(base.world.tiles.length),
      getTileMeta: () => meta,
    },
  };
  const state = createTestRun({ systems: sys, hero: { x: 808, y: 408 } });
  function travel() {
    state.hero.x = 808;
    moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: false }, 0.1);
    return state.hero.x - 808;
  }
  const snow = travel(),
    events: GameEvent[] = [];
  state.elements.ignite(49, 25, open, events);
  state.elements.advance(0.25, clear, open, events);
  assert.ok(events.some((e) => e.type === "element.steam"));
  assert.ok(Math.abs(travel() * 0.7 - snow) < 1e-6);
  assert.ok(
    Math.abs(state.elements.speed(50, 25, 0.88 * 0.7, 1) - 0.88) < 1e-6,
  );
  state.elements.advance(20, climate("blizzard"), open, []);
  assert.equal(state.elements.size, 0);
  assert.equal(travel(), snow);
});

it("Campfire protection rings and key peripheral fire stations refused to ignite and spread directly", () => {
  const sys = getTestSystems(),
    state = createTestRun(),
    terrain = runTerrain(state, sys);
  for (const object of [
    sys.world.campfire,
    sys.world.objects.get("old_mill_relay")!,
  ]) {
    const x = Math.floor(object.x / 16),
      y = Math.floor(object.y / 16);
    assert.ok(terrain.fireproof(x, y));
    assert.ok(!igniteRunTile(state, sys, object.x, object.y, []));
    const brush = { ...terrain, flammable: () => true };
    for (let dx = -4; dx <= 4; dx++)
      state.elements.ignite(x + dx, y, brush, []);
    state.elements.advance(3, clear, brush, []);
    assert.ok(!state.elements.at(x, y)?.burning);
  }
});

it("The role and the enemy will be continuously injured by the burning, and fire and frost respectively will be in effect", () => {
  const sys = getTestSystems(),
    state = createTestRun({ enemiesById: {}, hero: { x: 808, y: 408 } });
  const wolf = addTestEnemy(state, sys, "ash_wolf");
  const ember = addTestEnemy(state, sys, "ember_wisp");
  const ice = addTestEnemy(state, sys, "ice_ram", { x: 904, y: 408 });
  const hp = [state.hero.hp, wolf.hp, ember.hp];
  const events: GameEvent[] = [];
  state.elements.ignite(50, 25, open, events);
  state.elements.freeze(56, 25, open, events);
  for (let i = 0; i < 4; i++) {
    stepRunEnvironment(state, sys, 0.25, events);
    state.elapsedSec += 0.25;
  }
  assert.ok(state.hero.hp < hp[0] && wolf.hp < hp[1]);
  assert.equal(ember.hp, hp[2]);
  assert.equal(chillSpeed(ice, state.elapsedSec), 1);
  state.hero.x = 904;
  stepRunEnvironment(state, sys, 0.25, events);
  assert.ok(chillSpeed(state.hero, state.elapsedSec) < 1);
});

it("The fire site is re-applied to the ashes, the light is cleared and the ground is returned", () => {
  const sys = getTestSystems(),
    state = createTestRun(),
    store = createMemoryStorage();
  state.elements.ignite(53, 27, open, []);
  const sample = (s: typeof state) =>
    syncRunLight(s, sys).getLightLevel(856, 440).block;
  assert.ok(sample(state) > 0);
  assert.ok(saveRun(store, state, sys).ok);
  const restored = createRun({ systems: sys }, loadRun(store, sys).snapshot);
  assert.equal(sample(restored), 0);
  assert.ok(restored.elements.at(53, 27)!.scorched);
  const events: GameEvent[] = [];
  restored.elements.replay(events);
  const marks = new ElementMarks();
  for (const e of events) marks.apply(e);
  let pixels = 0;
  marks.draw(() => pixels++);
  assert.ok(pixels > 0);
  restored.elements.advance(9, clear, open, []);
  assert.equal(restored.elements.size, 0);
});

it("Space grids skip topographic queries and state-through", () => {
  const grid = new ElementGrid(16);
  const unexpected = () => {
    throw Error("empty grid scanned");
  };
  for (let i = 0; i < 1000; i++)
    grid.advance(
      0.016,
      clear,
      { flammable: unexpected, snowy: unexpected, fireproof: unexpected },
      [],
      unexpected,
    );
  assert.equal(grid.size, 0);
});
