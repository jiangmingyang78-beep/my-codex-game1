import assert from "node:assert/strict";
import { nightWaves, scaledStock, waveSlot } from "@/systems/survivalTuning";
import { buildSurvivalSnapshot } from "../tools/map-viewer/adapters/survivalAdapter";
import { it } from "./fixtures/it";

it.each([
  { factor: 1, wood: 4 },
  { factor: 2, wood: 8 },
])(
  ({ factor }) => `初始补给倍率 ${factor}`,
  ({ factor, wood }) => {
    assert.deepEqual(scaledStock({ wood: 4 }, factor), { wood });
  },
);

it.each([
  { factor: 0.5, waves: [0, 1] },
  { factor: 1, waves: [1, 1] },
  { factor: 2, waves: [2, 2] },
])(
  ({ factor }) => `前两夜波数 · 倍率 ${factor}`,
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
  ({ count }) => `夜袭波位 · ${count} 波`,
  ({ count, expected }) => {
    assert.equal(waveSlot(150, 120, 48, count), expected);
  },
);

it("提高资源密度会增加生存模式地图中的资源格", () => {
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
it("根路径无缓存热读，每次从默认值合并，零倍率有效", async () => {
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
  it("配置失败回退完整默认值 · " + label, async () => {
    assert.deepEqual(await loadSurvivalTuning(request), balance.survival);
  });

import { survivalRates } from "@/systems/survivalOverrides";
it("独立时长、饥饿、寒意、再生与波量使用生效数值", () => {
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
