import { rollRun } from "@/core/rng";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { blockedAt } from "../world/collision";
import { syncRunLight } from "../world/runLight";
import { ENEMY_RADIUS } from "./combatMath";
import {
  MobPool,
  categoryOf,
  hasCapacity,
  inRing,
  shouldDespawn,
  spawnLightAllowed,
  spawnRadii,
} from "./spawnRules";

export const enemyPool = new MobPool<EnemyState>();
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
  if (!boss && !hasCapacity(active, categoryOf(id), settings)) return null;
  const grid = syncRunLight(state, sys);
  const ring = spawnRadii(settings, sys.data.tileSize, sys.spawnView);
  const valid = (p: { x: number; y: number }) =>
    inRing(p, state.hero, ring, sys.spawnView) &&
    spawnLightAllowed(grid, p, id) &&
    !blockedAt(sys.world, state.changesByObjectId, p.x, p.y, ENEMY_RADIUS);
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
