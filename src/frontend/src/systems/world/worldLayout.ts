import type { RegionBounds } from "./worldTypes";

/** Fixed seed: the generated world is identical on every run and every device. */
export const WORLD_SEED = 0x0e1be2;

/** Tile rectangles of the regions implemented in this build (96 x 64 map). */
export const REGION_BOUNDS: readonly RegionBounds[] = [
  { id: "camp_edge", x0: 0, y0: 0, x1: 47, y1: 63 },
  { id: "old_mill", x0: 48, y0: 0, x1: 95, y1: 47 },
];

export const CAMP_TILE = { x: 16, y: 24 };
export const HERO_START_TILE = { x: 17, y: 26 };
/** The gate door occupies two tiles of the dividing wall column. */
export const GATE_TILES = [
  { x: 47, y: 24 },
  { x: 47, y: 25 },
];
export const MILL_RELAY_TILE = { x: 54, y: 21 };

/** Hand placed spawn tiles; ids come from regions.json (resident and night spawns). */
export const SPAWN_TILES: Record<string, { x: number; y: number }> = {
  camp_edge_weasel: { x: 33, y: 40 },
  camp_edge_night_a: { x: 43, y: 52 },
  camp_edge_night_b: { x: 43, y: 54 },
  old_mill_weasel: { x: 66, y: 22 },
  old_mill_spider: { x: 75, y: 27 },
  old_mill_night_a: { x: 92, y: 40 },
  old_mill_night_b: { x: 92, y: 42 },
};

/** Gatherable plan per region; renewal comes from regions.json dawnRenewal. */
export interface NodePlan {
  idPrefix: string;
  itemId: string;
  count: number;
  yield: number;
}

export const NODE_PLANS: Record<string, readonly NodePlan[]> = {
  camp_edge: [
    { idPrefix: "camp_edge_wood", itemId: "wood", count: 6, yield: 2 },
    { idPrefix: "camp_edge_stone", itemId: "stone", count: 5, yield: 2 },
    { idPrefix: "camp_edge_fiber", itemId: "fiber", count: 3, yield: 2 },
    { idPrefix: "camp_edge_berry", itemId: "berry", count: 6, yield: 1 },
  ],
  old_mill: [
    { idPrefix: "old_mill_ore", itemId: "ore", count: 4, yield: 2 },
    { idPrefix: "old_mill_stone", itemId: "stone", count: 2, yield: 2 },
    { idPrefix: "old_mill_wood", itemId: "wood", count: 2, yield: 2 },
    { idPrefix: "old_mill_frostcap", itemId: "frostcap", count: 4, yield: 1 },
  ],
};

/** Mill building: wall ring, plank floor, two-tile west opening and four pillars. */
export const MILL_BUILDING = {
  x0: 60,
  y0: 12,
  x1: 82,
  y1: 34,
  openY: [24, 25] as const,
};
export const MILL_PILLARS = [
  { x: 67, y: 18 },
  { x: 67, y: 28 },
  { x: 75, y: 18 },
  { x: 75, y: 28 },
];
