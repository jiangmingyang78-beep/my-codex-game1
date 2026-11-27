import assert from "node:assert/strict";
import {
  campProjectComplete,
  donateCampMaterials,
  normalizeCampProjects,
} from "@/systems/survival/campProjects";
import {
  landmarkBearing,
  landmarkEdge,
  normalizeLandmarks,
} from "@/systems/survival/landmarks";
import { survivalNightForecast } from "@/systems/survival/nightForecast";
import { it } from "./fixtures/it";

it("夜袭预警覆盖黄昏、分波夜袭和跳过的夜晚", () => {
  const forecast = (age: number, frequency: number) =>
    survivalNightForecast(age, 192, 120, frequency);
  assert.deepEqual(forecast(119, 2), { night: false, waves: 2, seconds: 1 });
  assert.deepEqual(forecast(120, 2), { night: true, waves: 2, seconds: 36 });
  assert.equal(forecast(155.5, 2).seconds, 0.5);
  assert.equal(forecast(156, 2).seconds, null);
  assert.equal(forecast(120, 1).seconds, null);
  assert.equal(forecast(119, 0.5).seconds, null);
  assert.equal(forecast(120, 0.5).seconds, null);
  assert.equal(forecast(192 + 119, 0.5).seconds, 1);
});

it("营地修缮允许分批捐助，完成后保留背包中的多余材料", () => {
  const progress = normalizeCampProjects(undefined);
  const stock = { wood: 3, stone: 1 };
  assert.equal(donateCampMaterials(progress, "wellhead", stock), true);
  assert.deepEqual(progress.wellhead, { wood: 3, stone: 1 });
  assert.equal(campProjectComplete(progress, "wellhead"), false);
  assert.deepEqual(stock, { wood: 0, stone: 0 });
  Object.assign(stock, { wood: 8, stone: 4 });
  const restored = normalizeCampProjects(JSON.parse(JSON.stringify(progress)));
  assert.equal(donateCampMaterials(restored, "wellhead", stock), true);
  assert.equal(campProjectComplete(restored, "wellhead"), true);
  assert.deepEqual(stock, { wood: 5, stone: 0 });
  assert.equal(donateCampMaterials(restored, "wellhead", stock), false);
  assert.deepEqual(normalizeCampProjects({ wellhead: { wood: 999, stone: -1 } }).wellhead, { wood: 6, stone: 0 });
});

it("世界地标兼容旧档，保留负坐标并覆盖同格标记", () => {
  const latest = { x: -40, y: 9, kind: "crossing" };
  assert.deepEqual(normalizeLandmarks(undefined), []);
  assert.deepEqual(normalizeLandmarks([
    { ...latest, kind: "mine" }, latest, null,
    { ...latest, x: 2048 }, { ...latest, kind: "unknown" },
  ]), [latest]);
  assert.deepEqual(landmarkBearing({ x: 3, y: 4 }, { x: 0, y: 0 }), { direction: "西北", distance: 5 });
});

it("小地图边缘箭头沿玩家到目标的方向投影，地图内地标保留原位", () => {
  const player = { x: 75, y: 48 };
  assert.equal(landmarkEdge(player, { x: 0, y: 95 }, 150, 96, 7), null);
  assert.deepEqual(landmarkEdge(player, { x: 180, y: 48 }, 150, 96, 7), { x: 143, y: 48, angle: 0 });
  assert.deepEqual(landmarkEdge(player, { x: 75, y: -80 }, 150, 96, 7), { x: 75, y: 7, angle: -Math.PI / 2 });
  const diagonal = landmarkEdge(player, { x: -100, y: 223 }, 150, 96, 7);
  assert.deepEqual(diagonal, { x: 34, y: 89, angle: Math.PI * 0.75 });
});
