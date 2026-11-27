import assert from "node:assert/strict";
import { RENDER_DEPTH, entityDepthAt } from "@/game/renderDepth";
import { it } from "./fixtures/it";
import {
  getTestEternalSystems,
  getTestSystems,
} from "./fixtures/testFactories";

const d = RENDER_DEPTH;

it("地面、实体、战斗、环境与 HUD 的渲染区间依次递增", () => {
  const levels = [
    d.ground,
    d.snowAccents,
    d.footprints,
    d.legacyTelegraph,
    d.telegraph,
    d.groundLoot,
    d.interact,
    d.entityMin + d.entityOffset.shadow,
    d.entityMin,
    d.entityMax,
    d.entityMax + d.entityOffset.shield,
    d.projectile,
    d.slash,
    d.combatParticles,
    d.combatGlow,
    d.campHalo,
    d.torchHalo,
    d.campFlame,
    d.night,
    d.torchEmbers,
    d.ambientParticles,
    d.ambientGlow,
    d.enemyHealth,
    d.floatingText,
    d.vignette,
    d.bossPointer,
    d.toast,
  ];
  assert.ok(
    levels.every((depth, index) => index === 0 || depth > levels[index - 1]),
  );
});

it.each([
  {
    label: "冒险地图",
    height:
      getTestSystems().world.heightTiles * getTestSystems().world.tileSize,
  },
  {
    label: "永恒地图",
    height:
      getTestEternalSystems().world.heightTiles *
      getTestEternalSystems().world.tileSize,
  },
  { label: "超高地图", height: 100_000 },
])(
  ({ label }) => `${label} · Y 排序与边界`,
  ({ height }) => {
    const top = entityDepthAt(0, height);
    const middle = entityDepthAt(height / 2, height);
    const bottom = entityDepthAt(height, height);
    assert.equal(top, d.entityMin);
    assert.ok(top < middle && middle < bottom && bottom <= d.entityMax);
    assert.equal(entityDepthAt(-1, height), top);
    assert.equal(entityDepthAt(height + 1, height), bottom);
  },
);

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  (height) => `无效地图高度 ${height}`,
  (height) => assert.equal(entityDepthAt(10, height), d.entityMin),
);
