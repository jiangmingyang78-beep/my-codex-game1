import type { EnemyAttack, EnemyDef, EnemyPhaseStage } from "@/core/dataTypes";
import type { EnemyState } from "@/core/types";

export interface Point {
  x: number;
  y: number;
}
type SeedActor = Pick<
  EnemyState,
  | "id"
  | "enemyId"
  | "x"
  | "y"
  | "hp"
  | "dirX"
  | "dirY"
  | "phase"
  | "phaseSec"
  | "hitDone"
  | "aimX"
  | "aimY"
  | "wardenPhase"
  | "hurtTimer"
  | "knockbackTimer"
  | "knockbackVx"
  | "knockbackVy"
>;
type Emit = (
  type: string,
  x: number,
  y: number,
  payload: Record<string, unknown>,
) => void;
interface HitContext<T> {
  config: EnemyDef;
  emitEvent: Emit;
  onEnemyKilled(enemy: T): void;
}
interface SeedContext<T extends SeedActor = SeedActor> {
  config: EnemyDef;
  distance: number;
  tileSize: number;
  emitEvent: Emit;
  moveBy(enemy: T, dx: number, dy: number): void;
  checkPlayerHit(
    enemy: T,
    reach?: number,
    damage?: number,
    coneDeg?: number,
  ): boolean;
  spawnEnemyThreat(
    enemy: T,
    aim: Point,
    attack: EnemyAttack,
    damage?: number,
  ): void;
}
interface Seed {
  type: NonNullable<EnemyDef["seedType"]>;
  update<T extends SeedActor>(
    enemy: T,
    dt: number,
    player: Point,
    context: SeedContext<T>,
  ): void;
}
import { EVT } from "@/core/events";

/** Rules-only behavior seeds. EnemyState provides the persisted phase and aim. */
export function applyEnemyHit<T extends SeedActor>(
  enemy: T,
  damage: number,
  source: Point,
  context: HitContext<T>,
) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  enemy.hurtTimer = 0.12;
  const dx = enemy.x - source.x;
  const dy = enemy.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = context.config.knockbackSpeed ?? 120;
  enemy.knockbackVx = (dx / length) * speed;
  enemy.knockbackVy = (dy / length) * speed;
  enemy.knockbackTimer = 0.14;
  context.emitEvent("combat.hit", enemy.x, enemy.y, {
    kind:
      enemy.hp <= 0
        ? context.config.phases || context.config.id === "beacon_keeper"
          ? "boss"
          : "finisher"
        : "strike",
    enemyId: enemy.enemyId,
    targetId: enemy.id,
    damage,
    dx: dx / length,
    dy: dy / length,
  });
  if (enemy.hp <= 0) context.onEnemyKilled(enemy);
}

function startWindup(
  enemy: SeedActor,
  player: Point,
  context: SeedContext,
  kind: string,
  payload: Record<string, unknown> = {},
) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  enemy.dirX = dx / distance;
  enemy.dirY = dy / distance;
  enemy.phase = "windup";
  enemy.phaseSec = context.config.attack.windupSec!;
  enemy.hitDone = false;
  context.emitEvent("enemy.telegraph", enemy.x, enemy.y, {
    id: enemy.id,
    enemyId: enemy.enemyId,
    kind,
    duration: enemy.phaseSec,
    ...payload,
  });
  context.emitEvent("combat.windup", enemy.x, enemy.y, {
    id: enemy.id,
    enemyId: enemy.enemyId,
    attack: context.config.seedType,
    seconds: enemy.phaseSec,
  });
}

function recover(enemy: SeedActor, duration: number) {
  enemy.phase = "recovery";
  enemy.phaseSec = duration;
  enemy.aimX = undefined;
  enemy.aimY = undefined;
}

function moveToward(
  enemy: SeedActor,
  dt: number,
  player: Point,
  context: SeedContext,
  multiplier = 1,
) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const speed =
    (context.config.moveSpeedPxPerSec * dt * multiplier) /
    (Math.hypot(dx, dy) || 1);
  context.moveBy(enemy, dx * speed, dy * speed);
}

export function createLungeSeed(): Seed {
  return {
    type: "lunge",
    update(enemy, dt, player, context) {
      const { attack } = context.config;
      if (enemy.phase === "chase") {
        if (context.distance <= attack.triggerTiles! * context.tileSize) {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const length = Math.hypot(dx, dy) || 1;
          startWindup(enemy, player, context, "lunge_windup", {
            dir: { x: dx / length, y: dy / length },
            distancePx: attack.distanceTiles! * context.tileSize,
          });
        } else moveToward(enemy, dt, player, context);
      } else if (enemy.phase === "windup" && enemy.phaseSec <= 0) {
        enemy.phase = "attack";
        enemy.phaseSec = attack.dashDurationSec!;
      } else if (enemy.phase === "attack") {
        const travel =
          (attack.distanceTiles! * context.tileSize * dt) /
          attack.dashDurationSec!;
        context.moveBy(enemy, enemy.dirX * travel, enemy.dirY * travel);
        if (!enemy.hitDone && context.checkPlayerHit(enemy))
          enemy.hitDone = true;
        if (enemy.phaseSec <= 0) recover(enemy, attack.recoverSec!);
      }
    },
  };
}

export function createStalkMeleeSeed(): Seed {
  return {
    type: "stalk_melee",
    update(enemy, dt, player, context) {
      const { attack } = context.config;
      const reach = attack.reachTiles! * context.tileSize;
      if (enemy.phase === "chase") {
        if (context.distance <= reach)
          startWindup(enemy, player, context, "melee_windup", {
            radiusPx: reach,
          });
        else moveToward(enemy, dt, player, context);
      } else if (enemy.phase === "windup" && enemy.phaseSec <= 0) {
        context.checkPlayerHit(enemy, reach, undefined, 130);
        recover(enemy, attack.cooldownSec!);
      }
    },
  };
}

export function createRangedTelegraphSeed(): Seed {
  return {
    type: "ranged_telegraph",
    update(enemy, dt, player, context) {
      const { attack } = context.config;
      if (enemy.phase === "chase") {
        const preferred = attack.preferredTiles! * context.tileSize;
        if (context.distance > preferred * 1.15)
          moveToward(enemy, dt, player, context);
        else if (context.distance < preferred * 0.65)
          moveToward(enemy, dt, player, context, -0.8);
        else {
          enemy.aimX = player.x;
          enemy.aimY = player.y;
          startWindup(
            enemy,
            player,
            context,
            attack.mode === "aoe" ? "aoe_zone" : "projectile",
            {
              targetX: enemy.aimX,
              targetY: enemy.aimY,
              radiusPx: (attack.radiusTiles ?? 1.2) * context.tileSize,
            },
          );
        }
      } else if (enemy.phase === "windup" && enemy.phaseSec <= 0) {
        context.spawnEnemyThreat(
          enemy,
          { x: enemy.aimX ?? player.x, y: enemy.aimY ?? player.y },
          attack,
        );
        recover(enemy, attack.cooldownSec!);
      }
    },
  };
}

export function createWardenPhaseSeed(
  subSeedMap: Record<EnemyPhaseStage["seedType"], Seed>,
): Seed {
  return {
    type: "warden_phase",
    update(enemy, dt, player, context) {
      const stages = context.config.phases!;
      let index = 0;
      for (let i = 1; i < stages.length; i++) {
        if (enemy.hp / context.config.maxHp <= stages[i].hpThreshold) index = i;
      }
      if (enemy.wardenPhase !== index) {
        enemy.wardenPhase = index;
        enemy.phase = "chase";
        enemy.phaseSec = 0;
        enemy.hitDone = false;
        enemy.aimX = undefined;
        enemy.aimY = undefined;
        context.emitEvent(EVT.enemyPhaseChanged, enemy.x, enemy.y, {
          id: enemy.id,
          enemyId: enemy.enemyId,
          phaseIndex: index,
        });
      }
      const stage = stages[index];
      const config = {
        ...context.config,
        ...stage.overrides,
        seedType: stage.seedType,
        attack: { ...context.config.attack, ...stage.overrides?.attack },
      };
      subSeedMap[stage.seedType].update(enemy, dt, player, {
        ...context,
        config,
        checkPlayerHit: (source, reach, damage, cone) =>
          context.checkPlayerHit(
            source,
            reach,
            damage ?? config.attackDamage,
            cone,
          ),
        spawnEnemyThreat: (source, aim, attack) =>
          context.spawnEnemyThreat(source, aim, attack, config.attackDamage),
      });
    },
  };
}

const simpleSeeds = {
  lunge: createLungeSeed(),
  stalk_melee: createStalkMeleeSeed(),
  ranged_telegraph: createRangedTelegraphSeed(),
};
export const enemySeeds = {
  ...simpleSeeds,
  warden_phase: createWardenPhaseSeed(simpleSeeds),
};
