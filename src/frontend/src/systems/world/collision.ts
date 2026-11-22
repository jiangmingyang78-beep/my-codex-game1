import type { ObjectChange } from "@/core/types";
import { TILE, type World } from "./worldTypes";

/** True when the tile blocks movement. Out-of-map tiles are solid; an opened gate is passable. */
export function solidAt(
  world: World,
  changes: Record<string, ObjectChange>,
  tx: number,
  ty: number,
): boolean {
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles)
    return true;
  const index = ty * world.widthTiles + tx;
  const tile = world.tiles[index];
  if (tile === TILE.door)
    return !changes[world.gateTiles.get(index) ?? ""]?.opened;
  return tile === TILE.tree || tile === TILE.wall || tile === TILE.fireBase;
}

/** True when a circle (approximated by its AABB) at (x, y) overlaps any solid tile. */
export function blockedAt(
  world: World,
  changes: Record<string, ObjectChange>,
  x: number,
  y: number,
  radius: number,
): boolean {
  const s = world.tileSize;
  const x0 = Math.floor((x - radius) / s);
  const x1 = Math.floor((x + radius - 1e-6) / s);
  const y0 = Math.floor((y - radius) / s);
  const y1 = Math.floor((y + radius - 1e-6) / s);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++)
      if (solidAt(world, changes, tx, ty)) return true;
  }
  return false;
}

export interface MoveOut {
  x: number;
  y: number;
}

/** Axis-separated move so bodies slide along walls. Writes into `out` (no allocation). */
export function moveWithCollision(
  world: World,
  changes: Record<string, ObjectChange>,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number,
  out: MoveOut,
): MoveOut {
  let nx = x;
  let ny = y;
  if (dx !== 0 && !blockedAt(world, changes, x + dx, y, radius)) nx = x + dx;
  if (dy !== 0 && !blockedAt(world, changes, nx, y + dy, radius)) ny = y + dy;
  out.x = nx;
  out.y = ny;
  return out;
}

export function regionIdAt(world: World, x: number, y: number): string | null {
  const tx = Math.floor(x / world.tileSize);
  const ty = Math.floor(y / world.tileSize);
  for (const r of world.regions) {
    if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r.id;
  }
  return null;
}
