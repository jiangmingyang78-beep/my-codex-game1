import type { EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import type Phaser from "phaser";

export interface SpecialHitContext {
  state: RunState;
  sys: Systems;
  config: EnemyDef;
  events: GameEvent[];
  attackDirX: number;
  attackDirY: number;
}

export interface SpecialHitDecision {
  blocked?: boolean;
  damage?: number;
  blockReason?: string;
}

export interface SpecialUpdateContext {
  state: RunState;
  sys: Systems;
  config: EnemyDef;
  dt: number;
  distance: number;
  events: GameEvent[];
}

export interface AdventureSpecialBehavior {
  readonly id: string;
  isUnlocked?(enemy: EnemyState, state: RunState, sys: Systems): boolean;
  onBeforeHit?(
    enemy: EnemyState,
    incomingDamage: number,
    ctx: SpecialHitContext,
  ): SpecialHitDecision | undefined;
  onUpdate?(enemy: EnemyState, ctx: SpecialUpdateContext): boolean | undefined;
  onKilled?(
    enemy: EnemyState,
    state: RunState,
    sys: Systems,
    events: GameEvent[],
  ): void;
  renderOverlay?(
    graphics: Phaser.GameObjects.Graphics,
    enemy: EnemyState,
    tileSize: number,
  ): void;
}

const registry = new Map<string, AdventureSpecialBehavior>();

export function registerAdventureSpecial(b: AdventureSpecialBehavior): void {
  registry.set(b.id, b);
}

export function getAdventureSpecial(
  enemyId: string,
  specialKey?: string,
): AdventureSpecialBehavior | undefined {
  return (
    (specialKey ? registry.get(specialKey) : undefined) ?? registry.get(enemyId)
  );
}

export function listAdventureSpecialIds(): string[] {
  return [...registry.keys()];
}

registerAdventureSpecial({
  id: "front_shield",
  onBeforeHit(enemy, incomingDamage, ctx) {
    const shieldUp = enemy.phase === "idle" || enemy.phase === "chase";
    if (!shieldUp) return { damage: incomingDamage };
    const dot = enemy.dirX * ctx.attackDirX + enemy.dirY * ctx.attackDirY;
    if (dot < -0.5) {
      const msg = "正面攻击被冻木盾格挡，请绕后或等它冲刺后出手！";
      ctx.events.push(
        makeEvent(EVT.blocked, enemy.x, enemy.y, {
          enemyId: enemy.enemyId,
          targetId: enemy.id,
          dx: enemy.dirX,
          dy: enemy.dirY,
          reason: "front_shield",
          message: msg,
        }),
      );
      return { blocked: true, damage: 0, blockReason: msg };
    }
    return { damage: incomingDamage };
  },
  renderOverlay(g, enemy, tileSize) {
    const up = enemy.phase === "idle" || enemy.phase === "chase";
    const angle = Math.atan2(enemy.dirY || 0, enemy.dirX || 1);
    g.lineStyle(2, up ? 0xffe4a8 : 0x8b786c, up ? 0.95 : 0.45);
    g.beginPath();
    g.arc(enemy.x, enemy.y, tileSize * 0.65, angle - 0.7, angle + 0.7);
    g.strokePath();
  },
});

registerAdventureSpecial({
  id: "pack_howl",
  onUpdate(enemy, { state, sys, events }) {
    const flagKey = `howl:${enemy.id}`;
    const def = sys.data.enemies.get(enemy.enemyId);
    if (!def || state.changesByObjectId[flagKey]?.opened) return;
    if (enemy.hp / def.maxHp > 0.6) return;
    state.changesByObjectId[flagKey] = { opened: true };
    const ratDef = sys.data.enemies.get("frost_rat");
    if (!ratDef) return;
    for (const offset of [-18, 18]) {
      const id = `pack_rat_${state.idCounter++}`;
      state.enemiesById[id] = {
        id,
        enemyId: "frost_rat",
        spawnId: enemy.spawnId,
        homeX: enemy.x + offset,
        homeY: enemy.y,
        x: enemy.x + offset,
        y: enemy.y,
        hp: ratDef.maxHp,
        phase: "chase",
        phaseSec: 0,
        cooldownSec: 0,
        dirX: 1,
        dirY: 0,
        moveIndex: 0,
        hitDone: false,
        nightRound: 0,
      };
    }
    events.push(
      makeEvent(EVT.notice, enemy.x, enemy.y, {
        message: "焦毛狼王仰天长嚎，雪丛里窜出了霜毛雪鼠！",
      }),
    );
  },
});

registerAdventureSpecial({
  id: "immobile_turret",
  onUpdate(enemy) {
    enemy.knockbackTimer = 0;
    enemy.knockbackVx = 0;
    enemy.knockbackVy = 0;
    enemy.x = enemy.homeX;
    enemy.y = enemy.homeY;
  },
});

registerAdventureSpecial({
  id: "light_phase",
  onBeforeHit(enemy, incomingDamage, { state, sys, events }) {
    const lampRadius = 4.5 * sys.data.tileSize;
    const illuminated = sys.world.objectList.some(
      (o) =>
        o.kind === "mirror_lamp" &&
        state.changesByObjectId[o.id]?.lit &&
        Math.hypot(o.x - enemy.x, o.y - enemy.y) <= lampRadius,
    );
    if (!illuminated) {
      const msg = "暗影中的折镜鬼火无法伤及，先点亮折镜铜灯并将其引入光圈！";
      events.push(
        makeEvent(EVT.blocked, enemy.x, enemy.y, {
          enemyId: enemy.enemyId,
          targetId: enemy.id,
          dx: enemy.dirX,
          dy: enemy.dirY,
          reason: "light_phase",
          message: msg,
        }),
      );
      return { blocked: true, damage: 0, blockReason: msg };
    }
    return { damage: incomingDamage };
  },
  renderOverlay(g, enemy, tileSize) {
    g.lineStyle(1, 0x7ce8ff, 0.7).strokeCircle(
      enemy.x,
      enemy.y,
      tileSize * 0.55,
    );
  },
});

const coalDrainBehavior: AdventureSpecialBehavior = {
  id: "coal_drain",
  onUpdate(_enemy, { state, dt, distance }) {
    if (distance <= 24 && !state.hero.inFire) {
      state.hero.light = Math.max(0, state.hero.light - 6 * dt);
    }
  },
};
registerAdventureSpecial(coalDrainBehavior);
registerAdventureSpecial({ ...coalDrainBehavior, id: "coal_shade" });
