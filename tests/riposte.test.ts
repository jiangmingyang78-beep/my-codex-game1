import assert from "node:assert/strict";
import test from "node:test";
import { EVT } from "@/core/events";
import type { GameEvent, Systems } from "@/core/types";
import { stepCombat } from "@/systems/combat/combat";
import { currentWeapon, heroAttack } from "@/systems/combat/heroAttack";
import {
  RIPOSTE_CONFIG,
  getRiposteState,
  tickRiposte,
} from "@/systems/combat/riposte";
import { getDashCooldownState, moveHero } from "@/systems/movement";
import { damageHero, resetBucklerCooldown } from "@/systems/survival";
import { solidAt } from "@/systems/world/collision";
import {
  addTestEnemy,
  createTestRun,
  getTestSystems,
  makeStepInput,
} from "./fixtures/testFactories";

function findWallAdjacentSpot(
  sys: Systems,
  changes: Record<string, { opened?: boolean }>,
): { x: number; y: number; dirX: number; dirY: number; wallTileX: number; wallTileY: number } {
  const { widthTiles, heightTiles } = sys.world;
  const tile = sys.data.tileSize;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let ty = 1; ty < heightTiles - 1; ty++) {
    for (let tx = 1; tx < widthTiles - 1; tx++) {
      if (solidAt(sys.world, changes, tx, ty)) continue;
      for (const [dx, dy] of dirs) {
        const wtx = tx + dx;
        const wty = ty + dy;
        if (solidAt(sys.world, changes, wtx, wty)) {
          return {
            x: (tx + 0.5) * tile,
            y: (ty + 0.5) * tile,
            dirX: dx,
            dirY: dy,
            wallTileX: wtx,
            wallTileY: wty,
          };
        }
      }
    }
  }
  throw new Error("未在世界地图中找到紧邻实心墙的可通行格");
}

test("Ember Riposte · 敌人进入 windup 末段时冲刺脱险触发就绪且攻击冷却立即归零", () => {
  const sys = getTestSystems();

  // 非末段（剩余前摇 > telegraphCommitSec）冲刺不触发
  const earlyState = createTestRun({
    systems: sys,
    hero: { attackCooldownSec: 0.35, hunger: 80 },
  });
  const earlyEvents: GameEvent[] = [];
  addTestEnemy(earlyState, sys, "snow_weasel", {
    x: earlyState.hero.x + 24,
    y: earlyState.hero.y,
    phase: "windup",
    phaseSec: RIPOSTE_CONFIG.telegraphCommitSec + 0.15,
    dirX: -1,
    dirY: 0,
  });
  moveHero(earlyState, sys, { moveX: -1, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(earlyState, sys, makeStepInput(), 0.016, earlyEvents);
  assert.equal(getRiposteState(earlyState).armed, false);

  // 末段（剩余前摇 <= telegraphCommitSec）在危险区内冲刺脱险触发就绪
  const state = createTestRun({
    systems: sys,
    hero: { attackCooldownSec: 0.35, hunger: 80 },
  });
  const events: GameEvent[] = [];
  addTestEnemy(state, sys, "snow_weasel", {
    x: state.hero.x + 24,
    y: state.hero.y,
    phase: "windup",
    phaseSec: Math.max(0.05, RIPOSTE_CONFIG.telegraphCommitSec - 0.05),
    dirX: -1,
    dirY: 0,
  });
  moveHero(state, sys, { moveX: -1, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(state, sys, makeStepInput(), 0.016, events);

  const snap = getRiposteState(state);
  assert.equal(snap.armed, true);
  assert.equal(snap.triggerKind, "telegraph_dash");
  assert.equal(state.hero.attackCooldownSec, 0);
  const armedEv = events.find((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED);
  assert.ok(armedEv);
  assert.equal(armedEv.payload.trigger, "telegraph_dash");
  assert.equal(armedEv.payload.durationSec, RIPOSTE_CONFIG.windowSec);
});

test("Ember Riposte · 圆盾格挡与冲刺无敌帧挡下攻击均触发就绪，且 0.9s ICD 内不重复触发", () => {
  const sys = getTestSystems();

  // 1) 圆盾格挡 + ICD 期内二次拦截
  const shieldState = createTestRun({
    systems: sys,
    inventory: { iron_buckler: 1 },
    hero: { hp: 8, hunger: 80, attackCooldownSec: 0.4 },
  });
  resetBucklerCooldown(shieldState);
  const shieldEvents: GameEvent[] = [];

  const blocked = damageHero(shieldState, sys, 2, shieldEvents, "ash_wolf", {
    x: shieldState.hero.x + 16,
    y: shieldState.hero.y,
  });
  assert.equal(blocked, false);
  assert.ok(shieldEvents.some((e) => e.type === EVT.blocked));
  assert.equal(getRiposteState(shieldState).armed, true);
  assert.equal(getRiposteState(shieldState).triggerKind, "buckler_block");
  assert.equal(shieldState.hero.attackCooldownSec, 0);

  // ICD 期内使用冲刺无敌帧再次拦截伤害，不重复触发 COMBAT_RIPOSTE_ARMED
  moveHero(shieldState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(shieldState, sys, 2, shieldEvents, "ash_wolf", {
    x: shieldState.hero.x + 16,
    y: shieldState.hero.y,
  });
  assert.equal(
    shieldEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    1,
  );

  // 2) 冲刺无敌帧独立触发 + 0.9s ICD 过期后可再次触发
  const dashState = createTestRun({
    systems: sys,
    hero: { hp: 8, hunger: 80, attackCooldownSec: 0.4 },
  });
  const dashEvents: GameEvent[] = [];
  moveHero(dashState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  const dodged = damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(dodged, false);
  assert.equal(dashState.hero.hp, 8);
  assert.equal(getRiposteState(dashState).triggerKind, "dash_iframe");

  tickRiposte(dashState, 0.5, sys);
  damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(
    dashEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    1,
  );

  tickRiposte(dashState, RIPOSTE_CONFIG.icdSec, sys);
  moveHero(dashState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 1.6);
  damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(
    dashEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    2,
  );
});

test("Ember Riposte · 就绪态攻击前突不穿墙、射程与伤害提升、获短暂无敌帧并回光", () => {
  const sys = getTestSystems();
  const state = createTestRun({
    systems: sys,
    hero: { hp: 8, light: 40, hunger: 80, facingX: 1, facingY: 0 },
  });
  const events: GameEvent[] = [];
  const startX = state.hero.x;
  const weapon = currentWeapon(state, sys);
  // 放置在普通挥砍打不到、但突进 + 扩展射程可命中的位置
  const enemy = addTestEnemy(state, sys, "ash_wolf", {
    x:
      startX +
      (weapon.rangeTiles + RIPOSTE_CONFIG.lungeTiles + 0.35) * sys.data.tileSize,
    y: state.hero.y,
    hp: 20,
  });

  moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(state, sys, 1, events, "ash_wolf", { x: enemy.x, y: enemy.y });
  const cdBefore = getDashCooldownState(state, sys).remainingSec;
  const expectedDamage = Math.ceil(weapon.damage * RIPOSTE_CONFIG.damageMult);

  assert.equal(heroAttack(state, sys, events), true);
  assert.equal(getRiposteState(state).armed, false);
  assert.ok(state.hero.x > startX);
  assert.ok(state.hero.invulnerableSec >= RIPOSTE_CONFIG.thrustInvulnSec);
  assert.equal(enemy.hp, 20 - expectedDamage);
  assert.equal(state.hero.light, 40 + RIPOSTE_CONFIG.lightOnHit);
  assert.ok(getDashCooldownState(state, sys).remainingSec < cdBefore);

  const strikeEv = events.find((e) => e.type === EVT.COMBAT_RIPOSTE_STRIKE);
  assert.ok(strikeEv);
  assert.equal(strikeEv.payload.hitCount, 1);
  assert.equal(strikeEv.payload.damage, expectedDamage);
  assert.equal(strikeEv.payload.lightRestored, RIPOSTE_CONFIG.lightOnHit);

  // 贴墙突进防穿墙校验
  const wallSpot = findWallAdjacentSpot(sys, state.changesByObjectId);
  const wallState = createTestRun({
    systems: sys,
    hero: {
      x: wallSpot.x,
      y: wallSpot.y,
      facingX: wallSpot.dirX,
      facingY: wallSpot.dirY,
      hunger: 80,
    },
  });
  const wallEvents: GameEvent[] = [];
  addTestEnemy(wallState, sys, "snow_weasel", {
    x: wallSpot.x,
    y: wallSpot.y,
    phase: "windup",
    phaseSec: 0.1,
    dirX: 1,
    dirY: 0,
  });
  moveHero(wallState, sys, { moveX: 0, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(wallState, sys, makeStepInput(), 0.016, wallEvents);
  // 恢复朝向正对墙格，验证突进不会穿入实心墙体
  wallState.hero.facingX = wallSpot.dirX;
  wallState.hero.facingY = wallSpot.dirY;
  assert.equal(getRiposteState(wallState).armed, true);
  heroAttack(wallState, sys, wallEvents);
  const tx = Math.floor(wallState.hero.x / sys.data.tileSize);
  const ty = Math.floor(wallState.hero.y / sys.data.tileSize);
  assert.equal(solidAt(sys.world, wallState.changesByObjectId, tx, ty), false);
});

test("Ember Riposte · 超过 1.4s 未出手自动过期，下一次攻击恢复普通挥砍", () => {
  const sys = getTestSystems();
  const state = createTestRun({
    systems: sys,
    hero: { hp: 8, light: 40, hunger: 80, facingX: 1, facingY: 0 },
  });
  const events: GameEvent[] = [];

  moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(state, sys, 1, events, "snow_weasel", {
    x: state.hero.x + 20,
    y: state.hero.y,
  });
  assert.equal(getRiposteState(state).armed, true);

  // 推进超过 windowSec (1.4s)
  tickRiposte(state, RIPOSTE_CONFIG.windowSec + 0.05, sys);
  assert.equal(getRiposteState(state).armed, false);
  assert.equal(getRiposteState(state).triggerKind, null);

  const preAttackX = state.hero.x;
  const weapon = currentWeapon(state, sys);
  const enemy = addTestEnemy(state, sys, "ash_wolf", {
    x: preAttackX + sys.data.tileSize * 0.8,
    y: state.hero.y,
    hp: 20,
  });

  assert.equal(heroAttack(state, sys, events), true);
  assert.equal(state.hero.x, preAttackX);
  assert.equal(enemy.hp, 20 - weapon.damage);
  assert.equal(state.hero.light, 40);
  assert.equal(
    events.some((e) => e.type === EVT.COMBAT_RIPOSTE_STRIKE),
    false,
  );
  assert.ok(events.some((e) => e.type === EVT.swing));
});
