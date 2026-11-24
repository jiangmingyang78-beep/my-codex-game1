import { EVT, makeEvent } from "@/core/events";
import { getActiveAdventureSpecial } from "@/entities/adventureSpecialEnemies";
import { enemySeeds } from "@/entities/enemySeeds.js";
import { applyEnemyHit, tickEnemyImpact } from "@/shared/monsterCatalog.js";
import { ENEMY_RADIUS, inCone } from "./combat/combatMath";
import { updateLegacyEnemy, updateProjectiles } from "./combat/enemyAi";
import { defeatEnemy } from "./combat/loot";
import { HERO_RADIUS } from "./movement";
import { damageHero } from "./survival";
import { blockedAt, moveWithCollision } from "./world/collision";
export {
  validateEnemyDrops,
  validateEnemySeeds,
} from "./combat/enemyValidation.js";
export {
  spawnResidents,
  spawnNightRaid,
  despawnNightRaid,
} from "./combat/enemySpawn";

const scratch = { x: 0, y: 0 };
function moveBy(state, sys, enemy, dx, dy) {
  moveWithCollision(
    sys.world,
    state.changesByObjectId,
    enemy.x,
    enemy.y,
    dx,
    dy,
    ENEMY_RADIUS,
    scratch,
  );
  enemy.x = scratch.x;
  enemy.y = scratch.y;
}

function clearPath(state, sys, ax, ay, bx, by) {
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

function spawnThreat(state, sys, events, enemy, aim, attack, damage) {
  if (attack.mode === "aoe") {
    const radius = (attack.radiusTiles ?? 1.2) * sys.data.tileSize;
    events.push(
      makeEvent(EVT.enemyAoeDetonated, aim.x, aim.y, {
        enemyId: enemy.enemyId,
        radius,
      }),
    );
    if (
      Math.hypot(aim.x - state.hero.x, aim.y - state.hero.y) <= radius &&
      clearPath(state, sys, enemy.x, enemy.y, aim.x, aim.y) &&
      clearPath(state, sys, aim.x, aim.y, state.hero.x, state.hero.y)
    )
      damageHero(state, sys, damage, events, enemy.enemyId);
    return;
  }
  if (state.projectiles.length >= sys.data.balance.limits.activeProjectiles)
    return;
  const dx = aim.x - enemy.x;
  const dy = aim.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = attack.projectileSpeedPxPerSec ?? 100;
  state.projectiles.push({
    id: `proj_${state.idCounter++}`,
    x: enemy.x,
    y: enemy.y,
    vx: (dx * speed) / length,
    vy: (dy * speed) / length,
    lifeSec: 2,
    damage,
  });
}

export function hitEnemy(state, sys, enemy, damage, events) {
  const config = sys.data.enemies.get(enemy.enemyId);
  if (!config || state.enemiesById[enemy.id] !== enemy) return;
  const context = { state, sys, enemy, config };
  const special = getActiveAdventureSpecial(context);
  const adjusted = special?.onBeforeHit?.(context, damage, events) ?? damage;
  if (!Number.isFinite(adjusted) || adjusted <= 0) return;
  applyEnemyHit(enemy, adjusted, state.hero, {
    config,
    emitEvent: (type, x, y, payload) =>
      events.push(makeEvent(type, x, y, payload)),
    onEnemyKilled: (target) => {
      defeatEnemy(state, sys, target, events);
      special?.onKilled?.(context, events);
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
}

export function updateEnemies(state, sys, dt, events) {
  const tileSize = sys.data.tileSize;
  const hero = state.hero;
  const move = (enemy, dx, dy) => moveBy(state, sys, enemy, dx, dy);
  for (const enemy of Object.values(state.enemiesById)) {
    const config = sys.data.enemies.get(enemy.enemyId);
    if (!config) continue;
    tickEnemyImpact(enemy, dt, move);
    const context = { state, sys, enemy, config };
    const special = getActiveAdventureSpecial(context);
    if (special?.onUpdate?.(context, dt, events, move) === true) continue;
    const homeRegion = sys.world.spawns.get(enemy.spawnId)?.regionId;
    const distance = Math.hypot(hero.x - enemy.x, hero.y - enemy.y);
    if (!config.seedType) {
      if (enemy.phase !== "idle" || distance <= 14 * tileSize)
        updateLegacyEnemy(enemy, config, dt, state, sys, events);
      continue;
    }
    const aware = state.regionId === homeRegion;
    if (enemy.phase === "idle") {
      if (aware && distance <= 8 * tileSize) enemy.phase = "chase";
      continue;
    }
    if (!aware && enemy.nightRound === null && enemy.phase === "chase") {
      enemy.phase = "idle";
      continue;
    }
    if (
      enemy.phase === "chase" &&
      distance > 16 * tileSize &&
      enemy.nightRound === null
    ) {
      enemy.phase = "idle";
      continue;
    }
    if (enemy.phase !== "chase") enemy.phaseSec -= dt;
    if (enemy.phase === "recovery" && enemy.phaseSec <= 0)
      enemy.phase = "chase";
    enemySeeds[config.seedType].update(enemy, dt, hero, {
      config,
      distance,
      tileSize,
      moveBy: move,
      emitEvent: (type, x, y, payload) =>
        events.push(makeEvent(type, x, y, payload)),
      checkPlayerHit: (
        source,
        reach = ENEMY_RADIUS + HERO_RADIUS + 3,
        damage = config.attackDamage,
        coneDeg = undefined,
      ) =>
        (coneDeg
          ? inCone(
              source.x,
              source.y,
              source.dirX,
              source.dirY,
              hero.x,
              hero.y,
              reach,
              coneDeg,
              HERO_RADIUS,
            )
          : Math.hypot(hero.x - source.x, hero.y - source.y) <= reach) &&
        clearPath(state, sys, source.x, source.y, hero.x, hero.y) &&
        damageHero(state, sys, damage, events, source.enemyId),
      spawnEnemyThreat: (source, aim, attack, damage = config.attackDamage) =>
        spawnThreat(state, sys, events, source, aim, attack, damage),
    });
  }
  updateProjectiles(state, sys, dt, events);
}
