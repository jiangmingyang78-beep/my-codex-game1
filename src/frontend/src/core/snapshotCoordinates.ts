import { blockedAt, regionIdAt } from "@/systems/world/collision";
import type { RegionBounds, World } from "@/systems/world/worldTypes";
import type { RunState } from "./types";

type Point = { x: number; y: number };

const OLD_RIDGE = { x0: 126, x1: 155, y0: 10, y1: 38 };
const EXPANDED_SPAWNS = [
  "brook_woodcutter_a",
  "caravan_alpha",
  "ridge_frozen_guard_b",
];

function nearestPassable(
  world: World,
  changes: RunState["changesByObjectId"],
  point: Point,
  region: RegionBounds | undefined,
  radius: number,
): Point {
  const { x, y } = point;
  const inRegion = !region || regionIdAt(world, x, y) === region.id;
  if (inRegion && !blockedAt(world, changes, x, y, radius)) return point;
  if (!region) return world.heroStart;

  let best = world.heroStart;
  let distance = Number.POSITIVE_INFINITY;
  for (let ty = region.y0; ty <= region.y1; ty++) {
    for (let tx = region.x0; tx <= region.x1; tx++) {
      const cx = (tx + 0.5) * world.tileSize;
      const cy = (ty + 0.5) * world.tileSize;
      const d = Math.hypot(cx - x, cy - y);
      if (d >= distance || blockedAt(world, changes, cx, cy, radius)) continue;
      best = { x: cx, y: cy };
      distance = d;
    }
  }
  return best;
}

/** Relocate pre-expansion saves before deriving their current region and collision state. */
export function migrateAdventureCoordinates(state: RunState, world: World) {
  const ridge = world.regions.find((region) => region.id === "frost_ridge");
  if (
    !ridge ||
    ridge.x0 === OLD_RIDGE.x0 ||
    !world.spawns.has("ridge_frozen_guard_b")
  )
    return;
  const changes = state.changesByObjectId;
  // Development builds of the expanded map briefly saved with the old version.
  if (
    EXPANDED_SPAWNS.some(
      (id) => Object.hasOwn(state.enemiesById, id) || changes[id]?.defeated,
    )
  )
    return;

  const relocate = (point: Point, radius: number, fallbackRegion?: string) => {
    const tx = Math.floor(point.x / world.tileSize);
    const ty = Math.floor(point.y / world.tileSize);
    const wasOnRidge =
      tx >= OLD_RIDGE.x0 &&
      tx <= OLD_RIDGE.x1 &&
      ty >= OLD_RIDGE.y0 &&
      ty <= OLD_RIDGE.y1;
    if (wasOnRidge) {
      const x = point.x + (ridge.x0 - OLD_RIDGE.x0) * world.tileSize;
      return nearestPassable(world, changes, { x, y: point.y }, ridge, radius);
    }
    const id = regionIdAt(world, point.x, point.y) ?? fallbackRegion;
    const region = world.regions.find((candidate) => candidate.id === id);
    return nearestPassable(world, changes, point, region, radius);
  };

  // The new ice-gorge gate sits on the return route and uses the old ridge requirements.
  if (changes.frost_ridge_gate?.opened && world.objects.has("ice_gorge_gate")) {
    changes.ice_gorge_gate = { ...changes.ice_gorge_gate, opened: true };
  }
  const hero = relocate(state.hero, 5, state.regionId);
  state.hero.x = hero.x;
  state.hero.y = hero.y;

  for (const enemy of Object.values(state.enemiesById)) {
    const spawn = world.spawns.get(enemy.spawnId);
    if (!spawn) {
      delete state.enemiesById[enemy.id];
      continue;
    }
    const region = world.regions.find(
      (candidate) => candidate.id === spawn.regionId,
    );
    const point = nearestPassable(
      world,
      changes,
      {
        x: spawn.x + (enemy.x - enemy.homeX),
        y: spawn.y + (enemy.y - enemy.homeY),
      },
      region,
      5,
    );
    if (enemy.aimX !== undefined) enemy.aimX += point.x - enemy.x;
    if (enemy.aimY !== undefined) enemy.aimY += point.y - enemy.y;
    enemy.x = point.x;
    enemy.y = point.y;
    enemy.homeX = spawn.x;
    enemy.homeY = spawn.y;
  }
  for (const loot of Object.values(state.groundLoot)) {
    const point = relocate(loot, 1);
    loot.x = point.x;
    loot.y = point.y;
  }
  if (state.nightRaid) {
    state.nightRaid.spawnedIds = state.nightRaid.spawnedIds.filter((id) =>
      Object.hasOwn(state.enemiesById, id),
    );
  }
  // A projectile in flight was launched against the old terrain and enemy positions.
  state.projectiles = [];
}
