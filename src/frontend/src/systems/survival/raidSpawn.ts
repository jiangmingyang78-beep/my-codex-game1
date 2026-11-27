import {
  type Mob,
  type SpawnSettings,
  type View,
  categoryOf,
  hasCapacity,
  spawnRadii,
} from "../combat/spawnRules";
import type { LightGrid } from "../world/lightGrid";
import { spawnDirector } from "../world/worldContext";
import { beaconGuardsAngle } from "./campProjects";
import { raidRules } from "./rhythm";
import { seededValue } from "./survivalNoise";

interface SpawnContext {
  seed: number;
  day: number;
  age: number;
  remaining: number;
  center: { x: number; y: number };
  view: View;
  tile: number;
  guarded: boolean;
  routes: ReadonlyMap<string, unknown>;
  grid: LightGrid;
  tuning: SpawnSettings;
  enemies: readonly Mob[];
  pool: readonly { id: string }[];
}

/** Sample only connected, unlit approaches outside the viewport. Unspent budget can be retried. */
export function raidSpawnPoints(ctx: SpawnContext) {
  const ring = spawnRadii(ctx.tuning, ctx.tile, ctx.view);
  const pool = ctx.pool.slice();
  const occupied = ctx.enemies.slice();
  const director = spawnDirector(
    ctx.grid,
    ctx.center,
    ctx.tuning,
    ctx.view,
    occupied,
    (p) =>
      ctx.routes.has(
        `${Math.floor(p.x / ctx.tile)},${Math.floor(p.y / ctx.tile)}`,
      ),
  );
  const points: { enemyId: string; x: number; y: number }[] = [];
  for (
    let i = 0;
    i < raidRules.spawnAttempts && points.length < ctx.remaining && pool.length;
    i++
  ) {
    const salt = Math.floor(ctx.age) + i * 5;
    const angle = 2 * Math.PI * seededValue(ctx.seed, ctx.day, 0, salt);
    if (ctx.guarded && beaconGuardsAngle(angle)) continue;
    const radius =
      ring.min +
      (ring.max - ring.min) * seededValue(ctx.seed, ctx.day, 0, salt + 1);
    const tx = Math.floor((ctx.center.x + radius * Math.cos(angle)) / ctx.tile);
    const ty = Math.floor((ctx.center.y + radius * Math.sin(angle)) / ctx.tile);
    const at = { x: (tx + 0.5) * ctx.tile, y: (ty + 0.5) * ctx.tile };
    if (
      occupied.some(
        (e) => e.hp > 0 && Math.hypot(e.x - at.x, e.y - at.y) < ctx.tile,
      )
    )
      continue;
    const index = Math.floor(
      seededValue(ctx.seed, tx, ty, salt + 2) * pool.length,
    );
    const enemyId = pool[index].id;
    if (!hasCapacity(occupied, categoryOf(enemyId), ctx.tuning)) {
      pool.splice(index, 1);
      continue;
    }
    if (!director.accepts(at, enemyId)) continue;
    if (
      ctx.guarded &&
      beaconGuardsAngle(Math.atan2(at.y - ctx.center.y, at.x - ctx.center.x))
    )
      continue;
    const p = { ...at, enemyId };
    occupied.push({ ...p, hp: 1 });
    points.push(p);
  }
  return points;
}
