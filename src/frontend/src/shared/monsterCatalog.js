import { loadDataFiles } from "@/core/gameData";
import { applyEnemyHit, enemySeeds } from "../entities/enemySeeds";
import { ENEMY_TEXTURE_DEFS } from "../vfx/enemyTextures.js";

export const ALL_SEED_ENEMIES = loadDataFiles().enemies.enemies.filter(
  (def) => def.seedType,
);
export { ENEMY_TEXTURE_DEFS, applyEnemyHit };

const enemyById = new Map(ALL_SEED_ENEMIES.map((def) => [def.id, def]));
const textureByKey = new Map(ENEMY_TEXTURE_DEFS.map((def) => [def.key, def]));

export function getEnemyDef(enemyId) {
  return enemyById.get(enemyId);
}

export function getEnemyTextureDef(enemyId) {
  return textureByKey.get(`enemy:${enemyId}`);
}

const sharedEnemies = ALL_SEED_ENEMIES.filter(
  (def) => def.scope === "shared" && def.seedType !== "warden_phase",
);
const earlyEnemies = sharedEnemies.filter((def) => def.maxHp <= 4);
const midgameEnemies = sharedEnemies.filter((def) => def.maxHp <= 6);

export function getSharedSurvivalEnemies(day = 1) {
  if (day <= 2) return earlyEnemies;
  if (day <= 5) return midgameEnemies;
  return sharedEnemies;
}

export function createSurvivalSeedEnemy(enemyId, x, y, index, enemy = {}) {
  const def = getEnemyDef(enemyId);
  if (def?.scope !== "shared" || def.seedType === "warden_phase")
    throw new Error(`The survival pattern is not available: ${enemyId}`);

  enemy.id = `night:${enemyId}:${index}`;
  enemy.enemyId = enemyId;
  enemy.seedType = def.seedType;
  enemy._def = def;
  enemy.x = x;
  enemy.y = y;
  enemy.index = index;
  enemy.home = { x, y };
  enemy.hp = enemy.max = def.maxHp;
  enemy.phase = "chase";
  enemy.phaseSec = 0;
  enemy.dirX = 0;
  enemy.dirY = 1;
  enemy.hitDone = false;
  enemy.stun =
    enemy.hurtTimer =
    enemy.knockbackTimer =
    enemy.knockbackVx =
    enemy.knockbackVy =
      0;
  return enemy;
}

export function tickEnemyImpact(enemy, dt, moveBy) {
  enemy.hurtTimer = Math.max(0, (enemy.hurtTimer ?? 0) - dt);
  if (enemy.knockbackTimer > 0) {
    const sec = Math.min(dt, enemy.knockbackTimer);
    moveBy(enemy, enemy.knockbackVx * sec, enemy.knockbackVy * sec);
    enemy.knockbackTimer = Math.max(0, enemy.knockbackTimer - dt);
    const decay = Math.exp(-15 * sec);
    enemy.knockbackVx *= decay;
    enemy.knockbackVy *= decay;
  }
}

export function stepSurvivalSeedEnemy(enemy, dt, player, hooks) {
  if (enemy.hp <= 0) return;
  const config = enemy._def;
  tickEnemyImpact(enemy, dt, hooks.moveBy);

  if (enemy.phase !== "chase") enemy.phaseSec -= dt;
  if (enemy.phase === "recovery" && enemy.phaseSec <= 0) enemy.phase = "chase";
  enemySeeds[config.seedType].update(enemy, dt, player, {
    ...hooks,
    config,
    distance: Math.hypot(player.x - enemy.x, player.y - enemy.y),
  });
}
