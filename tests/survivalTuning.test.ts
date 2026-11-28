import assert from "node:assert/strict";
import { nightWaves, scaledStock, waveSlot } from "@/systems/survivalTuning";
import { buildSurvivalSnapshot } from "../tools/map-viewer/adapters/survivalAdapter";
import { it } from "./fixtures/it";

it.each([
  { factor: 1, wood: 4 },
  { factor: 2, wood: 8 },
])(
  ({ factor }) => `Initial replenishment multiplier ${factor}`,
  ({ factor, wood }) => {
    assert.deepEqual(scaledStock({ wood: 4 }, factor), { wood });
  },
);

it.each([
  { factor: 0.5, waves: [0, 1] },
  { factor: 1, waves: [1, 1] },
  { factor: 2, waves: [2, 2] },
])(
  ({ factor }) => `Two nights before the wave... double ${factor}`,
  ({ factor, waves }) => {
    assert.deepEqual(
      [1, 2].map((day) => nightWaves(day, factor)),
      waves,
    );
  },
);

it.each([
  { count: 1, expected: 0 },
  { count: 2, expected: 1 },
])(
  ({ count }) => `Night raid position  ·  ${count} Bo`,
  ({ count, expected }) => {
    assert.equal(waveSlot(150, 120, 48, count), expected);
  },
);

it("Increasing resource density increases the resource base in the survival pattern map", () => {
  const counts = [0, 1, 2].map(
    (density) =>
      buildSurvivalSnapshot("42", density).tiles.filter((tile) =>
        [0, 6, 8].includes(tile),
      ).length,
  );
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], counts.join(", "));
});

import balance from "@/data/balance.json";
import { loadSurvivalTuning } from "@/systems/survivalTuning";
it("Root path has no cacher heat reading, with a zero-fold rate valid at each time you merge from the default", async () => {
  const first = await loadSurvivalTuning(async (url, init) => {
    assert.equal(url, "/survival-balance.json");
    assert.equal(init?.cache, "no-store");
    return Response.json({
      spawnFrequency: 0,
      dayDurationMultiplier: 2,
      coldHungerPerSecond: 0.5,
    });
  });
  assert.deepEqual(first, {
    ...balance.survival,
    spawnFrequency: 0,
    dayDurationMultiplier: 2,
    coldHungerPerSecond: 0.5,
  });
  assert.deepEqual(
    await loadSurvivalTuning(async () => Response.json({})),
    balance.survival,
  );
});
for (const [label, request] of Object.entries({
  offline: async () => {
    throw Error("offline");
  },
  http: async () => new Response("", { status: 503 }),
  missing: async () => new Response("", { status: 404 }),
  syntax: async () => new Response("{"),
  invalid: async () =>
    Response.json({ spawnFrequency: 2, nightDurationMultiplier: 0 }),
  typo: async () => Response.json({ spwanDensity: 3 }),
  null: async () => Response.json(null),
}))
  it("Cannot initialise Evolution's mail component.CurrentCurrently.Currently  ·  " + label, async () => {
    assert.deepEqual(await loadSurvivalTuning(request), balance.survival);
  });

import { survivalRates } from "@/systems/survivalOverrides";
it("The effective values for years of independence, hunger, chill, regeneration and wave use", () => {
  assert.deepEqual(
    survivalRates({
      ...balance.survival,
      dayDurationMultiplier: 2,
      nightDurationMultiplier: 0.5,
      resourceRefreshMultiplier: 2,
      hungerRateMultiplier: 2,
      coldHungerPerSecond: 1.5,
      spawnDensity: 0,
    }),
    {
      daySec: 240,
      nightSec: 36,
      wildRegrowthSec: 138,
      idleHungerPerSec: 0.6,
      movingHungerPerSec: 0.84,
      coldHungerPerSec: 1.5,
      clearNightWaveSize: 0,
    },
  );
});
