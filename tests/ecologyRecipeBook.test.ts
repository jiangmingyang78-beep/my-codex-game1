import { selectTarget } from "@/systems/combat/ecology";
import { interact } from "@/systems/world/interact";
import assert from "node:assert/strict";
import { it } from "node:test";
import { createRun } from "@/core/run";
import { saveRun, loadRun } from "@/core/save";
import { hitEnemy, updateEnemies } from "@/systems/EnemyManager";
import { craft } from "@/systems/crafting";
import { pickUp } from "@/systems/inventory";
import { collectGroundLoot } from "@/systems/combat/loot";
import { ignite, syncRunLight } from "@/systems/world/runLight";
import { tryArmRiposteOnDash } from "@/systems/combat/riposte";
import { buildCraftView } from "@/game/session/craftView";
import {
  addTestEnemy,
  createTestRun,
  createMemoryStorage,
  getTestSystems,
} from "./fixtures/testFactories";
import type { GameEvent } from "@/core/types";

function arena() {
  const base = getTestSystems();
  const sys = {
    ...base,
    world: { ...base.world, tiles: new Uint8Array(base.world.tiles.length) },
  };
  const state = createTestRun({
    systems: sys,
    phase: "night",
    enemiesById: {},
    hero: { x: 800, y: 400, light: 0 },
  });
  const events: GameEvent[] = [];
  function tick(frames = 1) {
    for (let i = 0; i < frames; i++) {
      updateEnemies(state, sys, 0.02, events);
      state.elapsedSec += 0.02;
    }
  }
  return { sys, state, events, tick };
}

it("阵营锁定附近敌对生物，攻击实际伤害目标，随后优先反击玩家", () => {
  const { sys, state, events, tick } = arena();
  const wolf = addTestEnemy(state, sys, "ash_wolf", { x: 843, y: 408 });
  const shade = addTestEnemy(state, sys, "cinder_husk", { x: 860, y: 408 });
  tick();
  assert.equal(wolf.targetId, shade.id);
  assert.equal(shade.targetId, wolf.id);
  tick(50);
  assert.ok(
    wolf.hp < sys.data.enemies.get(wolf.enemyId)!.maxHp ||
      shade.hp < sys.data.enemies.get(shade.enemyId)!.maxHp,
  );
  assert.equal(
    events.some((e) => e.payload.kind === "hurt"),
    false,
  );
  wolf.phase = "chase";
  hitEnemy(state, sys, wolf, 0.1, events);
  tick();
  assert.equal(wolf.targetId, "player");
});

it("中立生物遭袭才呼援，远处同族不响应", () => {
  const { sys, state, tick, events } = arena();
  const herd = [820, 840, 1200].map((x) =>
    addTestEnemy(state, sys, "ice_ram", { x, y: 400 }),
  );
  tick();
  assert.ok(herd.every((e) => !e.targetId));
  hitEnemy(state, sys, herd[0], 1, events);
  tick();
  assert.deepEqual(
    herd.map((e) => e.targetId),
    ["player", "player", undefined],
  );
});

it("黑雾山猫在火圈边缘移动且不穿入深处，近身可诱导可弹反的突刺", () => {
  const { sys, state, tick } = arena();
  const tile = sys.data.tileSize;
  ignite(state, { id: "test-fire", x: 800, y: 400, radius: 8 * tile }, 10);
  const lynx = addTestEnemy(state, sys, "shadow_lynx", {
    x: 800 + 7 * tile,
    y: 400,
  });
  const start = { x: lynx.x, y: lynx.y };
  let skirt = false;
  for (let i = 0; i < 130; i++) {
    tick();
    skirt ||= lynx.phase === "SKIRT_LIGHT";
    assert.ok(syncRunLight(state, sys).getLightLevel(lynx.x, lynx.y).block < 7);
  }
  assert.ok(skirt);
  assert.ok(Math.hypot(lynx.x - start.x, lynx.y - start.y) > tile / 2);
  const dx = 800 - lynx.x,
    dy = 400 - lynx.y,
    len = Math.hypot(dx, dy);
  Object.assign(state.hero, {
    x: lynx.x + (dx / len) * tile * 2,
    y: lynx.y + (dy / len) * tile * 2,
  });
  let armed = false,
    retreated = false;
  for (let i = 0; i < 180; i++) {
    tick();
    if (
      lynx.phase === "windup" &&
      lynx.retreating &&
      tryArmRiposteOnDash(state, sys, [])
    )
      armed = true;
    if (armed && lynx.phase === "SKIRT_LIGHT" && lynx.retreating)
      retreated = true;
  }
  assert.ok(armed);
  assert.ok(retreated);
});

it("首次拾取合并解锁提示，消耗材料后存档仍保留配方和角标", () => {
  const { state, sys, events } = arena();
  const before = buildCraftView(state, sys).rows.find(
    (r) => r.id === "make_spear",
  )!;
  assert.equal(before.unlocked, false);
  state.groundLoot.test = {
    id: "test",
    x: state.hero.x,
    y: state.hero.y,
    pickupId: null,
    refusedNotified: false,
    itemId: "ingot",
    count: 1,
  };
  collectGroundLoot(state, sys, events);
  assert.equal(events.filter((e) => e.payload.recipeNames).length, 1);
  assert.match(
    String(events.find((e) => e.payload.recipeNames)?.payload.message),
    /等 \d+ 项/,
  );
  assert.ok(state.unreadRecipeIds.has("make_spear"));
  assert.ok(
    !pickUp(state, sys, "ingot", 1).events.some((e) => e.payload.recipeNames),
  );
  delete state.inventory.ingot;
  state.unreadRecipeIds.delete("make_spear");
  const storage = createMemoryStorage();
  assert.ok(saveRun(storage, state, sys).ok);
  const saved = loadRun(storage, sys);
  assert.equal(saved.status, "ok");
  const restored = createRun({ systems: sys }, saved.snapshot);
  assert.ok(restored.unlockedRecipeIds.has("make_spear"));
  assert.ok(!restored.unreadRecipeIds.has("make_spear"));
});

it("完成营火工程解锁后续配方，旧档从材料和已建营地回溯", () => {
  const sys = getTestSystems(),
    state = createTestRun({ inventory: { wood: 6, stone: 4 } });
  Object.assign(state.hero, sys.world.campfire);
  assert.equal(craft(state, sys, "make_relay").reason, "recipe_locked");
  const result = craft(state, sys, "raise_camp_2");
  assert.ok(result.ok);
  assert.ok(state.unreadRecipeIds.has("make_relay"));
  const old = JSON.parse(JSON.stringify(state));
  delete old.unlockedRecipeIds;
  delete old.unreadRecipeIds;
  old.inventory.raw_meat = 1;
  const loaded = createRun({ systems: sys }, old);
  for (const id of ["cook_roast_meat", "make_relay", "cook_ration"])
    assert.ok(loaded.unlockedRecipeIds.has(id));
  assert.equal(loaded.unreadRecipeIds.size, 0);
});

it("每 200 毫秒重评最近敌对目标，忽略感知范围外的生物", () => {
  const { state, sys } = arena();
  const wolf = addTestEnemy(state, sys, "ash_wolf", { x: 500, y: 400 });
  const def = sys.data.enemies.get("ash_wolf")!;
  const far = addTestEnemy(state, sys, "cinder_husk", { x: 750, y: 400 });
  assert.equal(selectTarget(state, sys, wolf, def), undefined);
  far.x = 560;
  state.elapsedSec = 0.1;
  assert.equal(selectTarget(state, sys, wolf, def), undefined);
  const closer = addTestEnemy(state, sys, "ember_wisp", { x: 530, y: 400 });
  state.elapsedSec = 0.21;
  assert.equal(selectTarget(state, sys, wolf, def), closer);
  far.x = 510;
  state.elapsedSec = 0.3;
  assert.equal(selectTarget(state, sys, wolf, def), closer);
  state.elapsedSec = 0.42;
  assert.equal(selectTarget(state, sys, wolf, def), far);
});

it("架设废磨坊接力火盆即可发现余烬提灯，旧存档从已点亮火站回溯", () => {
  const sys = getTestSystems();
  const state = createTestRun({ inventory: { relay_kit: 1 } });
  const socket = sys.world.objects.get("old_mill_relay")!;
  Object.assign(state.hero, { x: socket.x, y: socket.y });
  assert.ok(!state.unlockedRecipeIds.has("craft_ember_lantern"));
  assert.ok(interact(state, sys, socket.id).ok);
  assert.ok(state.unreadRecipeIds.has("craft_ember_lantern"));
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.unlockedRecipeIds;
  delete legacy.unreadRecipeIds;
  assert.ok(
    createRun({ systems: sys }, legacy).unlockedRecipeIds.has(
      "craft_ember_lantern",
    ),
  );
});
