import type { WorldLayout } from "./worldLayout";
import { TILE } from "./worldTypes";

export interface Grid {
  w: number;
  h: number;
  tiles: Uint8Array;
}

export const at = (g: Grid, x: number, y: number) => y * g.w + x;

export function tileIndex(g: Grid, x: number, y: number): number {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= g.w ||
    y >= g.h
  )
    throw new Error(`Map tile (${x}, ${y}) is outside ${g.w}×${g.h}`);
  return at(g, x, y);
}

function fillRect(
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: number,
): void {
  tileIndex(g, x0, y0);
  tileIndex(g, x1, y1);
  if (x0 > x1 || y0 > y1) throw new Error("Invalid map rectangle");
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) g.tiles[at(g, x, y)] = tile;
}

export function carveTerrain(g: Grid, layout: WorldLayout): void {
  g.tiles.fill(TILE.wall);
  for (const { bounds, terrain } of layout.regions) {
    tileIndex(g, bounds.x0, bounds.y0);
    tileIndex(g, bounds.x1, bounds.y1);
    if (bounds.x0 > bounds.x1 || bounds.y0 > bounds.y1)
      throw new Error(`Invalid bounds for ${bounds.id}`);
    for (const { x0, y0, x1, y1, tile } of terrain)
      fillRect(g, x0, y0, x1, y1, TILE[tile]);
  }
  for (const { gate, relay, beacon } of layout.regions) {
    for (const t of gate?.tiles ?? [])
      g.tiles[tileIndex(g, t.x, t.y)] = TILE.door;
    if (relay) g.tiles[tileIndex(g, relay.x, relay.y)] = TILE.fireBase;
    if (beacon) g.tiles[tileIndex(g, beacon.x, beacon.y)] = TILE.fireBase;
  }
  g.tiles[tileIndex(g, layout.campfire.x, layout.campfire.y)] = TILE.fireBase;
}
