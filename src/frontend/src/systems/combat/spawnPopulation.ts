import { rollRun } from "@/core/rng";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { blockedAt } from "../world/collision";
import { syncRunLight } from "../world/runLight";
import { spawnDirector } from "../world/worldContext";
import { ENEMY_RADIUS } from "./combatMath";
import { projectilePool } from "./projectilePool";
import { MobPool, shouldDespawn, spawnRadii } from "./spawnRules";

export const enemyPool = new MobPool<EnemyState>(96, () => ({}) as EnemyState);
export function spawnPoint(
  state: RunState,
  sys: Systems,
  id: string,
  preferred?: { x: number; y: number },
  boss = false,
) {
  const settings = sys.data.balance.survival;
  const active = Object.values(state.enemiesById).filter(
    (e) =>
      !sys.world.spawns.has(e.spawnId) ||
      e.nightRound !== null ||
      sys.world.spawns.get(e.spawnId)?.regionId === state.regionId,
  );
  const grid = syncRunLight(state, sys);
  const director = spawnDirector(
    grid,
    state.hero,
    settings,
    sys.spawnView,
    active,
    (p) =>
      !blockedAt(sys.world, state.changesByObjectId, p.x, p.y, ENEMY_RADIUS),
  );
  if (!director.hasRoom(id, boss)) return null;
  const { ring } = director;
  const valid = (p: { x: number; y: number }) => director.allowsLocation(p, id);
  if (preferred && valid(preferred)) return preferred;
  for (let i = 0; i < 96; i++) {
    const angle = rollRun(state) * 2 * Math.PI;
    const radius = ring.min + (ring.max - ring.min) * rollRun(state);
    const p = {
      x: state.hero.x + Math.cos(angle) * radius,
      y: state.hero.y + Math.sin(angle) * radius,
    };
    if (valid(p)) return p;
  }
  return null;
}

export function recycleDistant(state: RunState, sys: Systems) {
  const { despawn } = spawnRadii(
    sys.data.balance.survival,
    sys.data.tileSize,
    sys.spawnView,
  );
  for (const mob of Object.values(state.enemiesById)) {
    if (
      !shouldDespawn(mob, state.hero, despawn) ||
      sys.data.enemies.get(mob.enemyId)?.phases
    )
      continue;
    delete state.enemiesById[mob.id];
    enemyPool.release(mob);
  }
}

/** Called after the run's last consumer has detached. */
export function releasePopulation(state: RunState) {
  for (const id in state.enemiesById) {
    const enemy = state.enemiesById[id];
    delete state.enemiesById[id];
    enemyPool.release(enemy);
  }
  while (state.projectiles.length)
    projectilePool.release(state.projectiles.pop()!);
}

export function acquireEnemy(
  id: string,
  enemyId: string,
  spawnId: string,
  x: number,
  y: number,
  hp: number,
  nightRound: number | null,
): EnemyState {
  const enemy = enemyPool.take() ?? ({} as EnemyState);
  enemy.id = id;
  enemy.enemyId = enemyId;
  enemy.spawnId = spawnId;
  enemy.homeX = enemy.x = x;
  enemy.homeY = enemy.y = y;
  enemy.hp = hp;
  enemy.phase = "idle";
  enemy.phaseSec = 0;
  enemy.cooldownSec = 0;
  enemy.dirX = 0;
  enemy.dirY = 1;
  enemy.moveIndex = 0;
  enemy.hitDone = false;
  enemy.persistent = nightRound === null;
  enemy.nightRound = nightRound;
  return enemy;
}
