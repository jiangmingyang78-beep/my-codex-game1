import type { EnemyAttack, EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { getAdventureSpecial } from "@/entities/adventureSpecialEnemies";
import type { Point, SeedContext } from "@/entities/enemySeeds";
import { enemySeeds } from "@/entities/enemySeeds";
import { applyEnemyHit, tickEnemyImpact } from "@/shared/monsterCatalog.js";
import { chillSpeed } from "./buffs";
import { ENEMY_RADIUS, inCone } from "./combat/combatMath";
import {
  PLAYER,
  actor,
  factionOf,
  provoke,
  selectTarget,
} from "./combat/ecology";
import { updateLegacyEnemy, updateProjectiles } from "./combat/enemyAi";
import { defeatEnemy } from "./combat/loot";
import { projectilePool } from "./combat/projectilePool";
import { skirtLight } from "./combat/skirtLight";
import { HERO_RADIUS, chaseDisplacement } from "./movement";
import { runContext } from "./world/runContext";
import { syncRunLight } from "./world/runLight";

import { damageHero } from "./survival";
import { blockedAt, moveWithCollision } from "./world/collision";
export {
  validateEnemyDrops,
  validateEnemySeeds,
} from "./combat/enemyValidation";
export {
  spawnResidents,
  spawnNightRaid,
  despawnNightRaid,
} from "./combat/enemySpawn";

const scratch = { x: 0, y: 0 };
function moveBy(
  state: RunState,
  sys: Systems,
  enemy: EnemyState,
  dx: number,
  dy: number,
) {
  moveWithCollision(
    sys.world,
    state.changesByObjectId,
    enemy.x,
    enemy.y,
    dx * chillSpeed(enemy, state.elapsedSec),
    dy * chillSpeed(enemy, state.elapsedSec),
    ENEMY_RADIUS,
    scratch,
  );
  enemy.x = scratch.x;
  enemy.y = scratch.y;
}

function clearPath(
  state: RunState,
  sys: Systems,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const length = Math.hypot(bx - ax, by - ay);
  const samples = Math.ceil(length / (sys.data.tileSize / 2));
  for (let i = 1; i <= samples; i++) {
    const fraction = i / samples;
    if (
      blockedAt(
        sys.world,
        state.changesByObjectId,
        ax + (bx - ax) * fraction,
        ay + (by - ay) * fraction,
        0.1,
      )
    )
      return false;
  }
  return true;
}

function spawnThreat(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
  enemy: EnemyState,
  aim: Point,
  attack: EnemyAttack,
  damage: number,
) {
  const target = actor(state, enemy.targetId ?? PLAYER);
  if (!target) return;
  if (attack.mode === "aoe") {
    const radius = (attack.radiusTiles ?? 1.2) * sys.data.tileSize;
    events.push(
      makeEvent(EVT.enemyAoeDetonated, aim.x, aim.y, {
        enemyId: enemy.enemyId,
        radius,
      }),
    );
    if (
      Math.hypot(aim.x - target.x, aim.y - target.y) <= radius &&
      clearPath(state, sys, enemy.x, enemy.y, aim.x, aim.y) &&
      clearPath(state, sys, aim.x, aim.y, target.x, target.y)
    )
      strike(
        state,
        sys,
        target,
        damage,
        events,
        enemy.id,
        enemy,
        enemy.enemyId,
      );
    return;
  }
  if (state.projectiles.length >= sys.data.balance.limits.activeProjectiles)
    return;
  const dx = aim.x - enemy.x;
  const dy = aim.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = attack.projectileSpeedPxPerSec ?? 100;
  const shot = projectilePool.acquire();
  shot.id = `proj_${state.idCounter++}`;
  shot.x = enemy.x;
  shot.y = enemy.y;
  shot.targetId = enemy.targetId;
  shot.sourceId = enemy.id;
  shot.vx = (dx * speed) / length;
  shot.vy = (dy * speed) / length;
  shot.lifeSec = 2;
  shot.damage = damage;
  state.projectiles.push(shot);
}

function strike(
  state: RunState,
  sys: Systems,
  target: Point,
  damage: number,
  events: GameEvent[],
  attackerId: string,
  origin: Point,
  cause: string,
) {
  if (target === state.hero)
    return damageHero(state, sys, damage, events, cause, origin);
  return hitEnemy(
    state,
    sys,
    target as EnemyState,
    damage,
    events,
    attackerId,
    origin,
  );
}

export function hitEnemy(
  state: RunState,
  sys: Systems,
  enemy: EnemyState,
  damage: number,
  events: GameEvent[],
  attackerId = PLAYER,
  origin: Point = state.hero,
) {
  const config = sys.data.enemies.get(enemy.enemyId);
  if (!config || state.enemiesById[enemy.id] !== enemy) return false;
  const special = getAdventureSpecial(enemy.enemyId, config.specialKey);
  if (special?.isUnlocked && !special.isUnlocked(enemy, state, sys))
    return false;
  let finalDamage = damage;
  if (special?.onBeforeHit) {
    const dx = enemy.x - origin.x;
    const dy = enemy.y - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    const decision = special.onBeforeHit(enemy, damage, {
      state,
      sys,
      config,
      events,
      attackDirX: dx / len,
      attackDirY: dy / len,
    });
    if (decision?.blocked) return false;
    if (typeof decision?.damage === "number") finalDamage = decision.damage;
  }
  if (attackerId === PLAYER) enemy.playerInteracted = true;
  provoke(state, sys, enemy, attackerId);
  applyEnemyHit(enemy, finalDamage, origin, {
    config,
    emitEvent: (type, x, y, payload) =>
      events.push(makeEvent(type, x, y, payload)),
    onEnemyKilled: (target) => {
      defeatEnemy(state, sys, target, events, special?.onKilled);
      if (
        config.drops.some(
          ({ pickupId }) => pickupId && state.groundLoot[pickupId],
        )
      )
        events.push(
          makeEvent(EVT.saveDue, null, null, { reason: "fixed_drop" }),
        );
    },
  });
  return true;
}

export function updateEnemies(
  state: RunState,
  sys: Systems,
  dt: number,
  events: GameEvent[],
) {
  const tileSize = sys.data.tileSize;

  const move = (enemy: EnemyState, dx: number, dy: number) =>
    moveBy(state, sys, enemy, dx, dy);
  const context = runContext(state, sys);
  const light = syncRunLight(state, sys);
  context.clearCrowd();
  for (const id in state.enemiesById) context.addActor(state.enemiesById[id]);
  const pursue = (enemy: EnemyState, dx: number, dy: number) => {
    const step = chaseDisplacement(state, sys, enemy, dx, dy);
    move(enemy, step.x, step.y);
  };
  let currentTarget: Point = state.hero;
  let currentEnemy: EnemyState;
  const hit = (damage: number) =>
    strike(
      state,
      sys,
      currentTarget,
      damage,
      events,
      currentEnemy.id,
      currentEnemy,
      currentEnemy.enemyId,
    );
  let hooks: SeedContext<EnemyState>;
  const makeHooks = (config: EnemyDef): SeedContext<EnemyState> => ({
    config,
    distance: 0,
    tileSize,
    moveBy: move,
    emitEvent: (type, x, y, payload) =>
      events.push(makeEvent(type, x, y, payload)),
    checkPlayerHit: (
      source,
      reach = ENEMY_RADIUS + HERO_RADIUS + 3,
      damage = hooks.config.attackDamage,
      coneDeg?: number,
    ) =>
      (coneDeg
        ? inCone(
            source.x,
            source.y,
            source.dirX,
            source.dirY,
            currentTarget.x,
            currentTarget.y,
            reach,
            coneDeg,
            HERO_RADIUS,
          )
        : Math.hypot(currentTarget.x - source.x, currentTarget.y - source.y) <=
          reach) &&
      clearPath(
        state,
        sys,
        source.x,
        source.y,
        currentTarget.x,
        currentTarget.y,
      ) &&
      hit(damage),
    spawnEnemyThreat: (
      source,
      aim,
      attack,
      damage = hooks.config.attackDamage,
    ) => spawnThreat(state, sys, events, source, aim, attack, damage),
  });
  for (const id in state.enemiesById) {
    const enemy = state.enemiesById[id];
    const config = sys.data.enemies.get(enemy.enemyId);
    if (!config || enemy.hp <= 0) continue;
    const special = getAdventureSpecial(enemy.enemyId, config.specialKey);
    if (special?.isUnlocked && !special.isUnlocked(enemy, state, sys)) continue;
    tickEnemyImpact(enemy, dt, move);
    const target = selectTarget(state, sys, enemy, config);
    if (!target) {
      enemy.phase = "idle";
      enemy.retreating = false;
      // An approaching raid marches toward its objective until something comes into view.
      const marching =
        enemy.nightRound !== null &&
        factionOf(config) !== "neutral" &&
        (!config.activeWindow ||
          config.activeWindow === "any" ||
          config.activeWindow === state.phase);
      const dx = (marching ? state.hero.x : enemy.homeX) - enemy.x;
      const dy = (marching ? state.hero.y : enemy.homeY) - enemy.y;
      const scale = Math.min(
        1,
        (config.moveSpeedPxPerSec * dt) / (Math.hypot(dx, dy) || 1),
      );
      if (dx || dy) (marching ? pursue : move)(enemy, dx * scale, dy * scale);
      continue;
    }
    if (config.fearLightThreshold !== undefined) {
      if (skirtLight(enemy, config, target, light, dt, tileSize, move))
        continue;
    }
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    if (
      special?.onUpdate?.(enemy, {
        state,
        sys,
        config,
        dt,
        distance: Math.hypot(state.hero.x - enemy.x, state.hero.y - enemy.y),
        events,
      }) === true
    ) {
      continue;
    }
    if (enemy.phase === "idle") {
      enemy.phase = "chase";
      continue;
    }
    if (
      enemy.phase === "chase" &&
      target === state.hero &&
      distance < 6 * tileSize &&
      !clearPath(state, sys, enemy.x, enemy.y, target.x, target.y)
    ) {
      const scale = (config.moveSpeedPxPerSec * dt) / (distance || 1);
      pursue(enemy, (target.x - enemy.x) * scale, (target.y - enemy.y) * scale);
      continue;
    }
    currentEnemy = enemy;
    currentTarget = target;
    if (!config.seedType) {
      updateLegacyEnemy(enemy, config, dt, state, sys, events, target, hit);
      continue;
    }
    if (enemy.phase !== "chase") enemy.phaseSec -= dt;
    if (enemy.phase === "recovery" && enemy.phaseSec <= 0) {
      enemy.phase = "chase";
      if (enemy.retreating) continue;
    }
    hooks ??= makeHooks(config);
    hooks.config = config;
    hooks.distance = distance;
    hooks.moveBy =
      enemy.phase === "chase" && target === state.hero && !enemy.retreating
        ? pursue
        : move;
    enemySeeds[config.seedType].update(enemy, dt, target, hooks);
  }
  updateProjectiles(state, sys, dt, (p, target) =>
    strike(
      state,
      sys,
      target,
      p.damage,
      events,
      p.sourceId ?? "projectile",
      { x: p.x - p.vx, y: p.y - p.vy },
      "projectile",
    ),
  );
}
