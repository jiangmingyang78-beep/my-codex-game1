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
