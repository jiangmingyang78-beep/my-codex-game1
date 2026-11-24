import type { RegionBounds, TILE } from "./worldTypes";

interface TilePoint {
  x: number;
  y: number;
}

interface TerrainRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  tile: keyof typeof TILE;
}

interface NodePlan {
  idPrefix: string;
  itemId: string;
  count: number;
  yield: number;
  /** Optional east limit (tile x) for this plan only. */
  maxX?: number;
}

interface RegionLayout {
  bounds: RegionBounds;
  terrain: readonly TerrainRect[];
  trees?: { density: number; maxX: number; denseEdges?: boolean };
  nodes?: readonly NodePlan[];
  nodeArea?: { minX?: number; campDistance?: readonly [number, number] };
  gate?: {
    tiles: readonly TilePoint[];
    interactAt: TilePoint;
    reserveOffset?: TilePoint;
  };
  relay?: TilePoint;
  beacon?: TilePoint;
}

export interface WorldLayout {
  seed: number;
  heroStart: TilePoint;
  campfire: TilePoint;
  renewableWoodTiles: Readonly<Record<string, TilePoint>>;
  spawns: Readonly<Record<string, TilePoint>>;
  regions: readonly RegionLayout[];
}

/** Shared by the terrain layout and the mill's wall palette. */
export const MILL_BUILDING = { x0: 60, y0: 12, x1: 82, y1: 34 };

/** Tile coordinates; map dimensions and tile size are in balance.json world. */
export const WORLD_LAYOUT: WorldLayout = {
  seed: 0x0e1be2,
  heroStart: { x: 17, y: 26 },
  campfire: { x: 16, y: 24 },
  renewableWoodTiles: {
    camp_dawn_wood_1: { x: 12, y: 21 },
    camp_dawn_wood_2: { x: 20, y: 21 },
    camp_dawn_wood_3: { x: 12, y: 27 },
    camp_dawn_wood_4: { x: 20, y: 27 },
  },
  spawns: {
    camp_edge_weasel: { x: 33, y: 40 },
    camp_edge_night_a: { x: 43, y: 52 },
    camp_edge_night_b: { x: 43, y: 54 },
    old_mill_weasel: { x: 56, y: 29 },
    old_mill_spider: { x: 57, y: 15 },
    old_mill_night_a: { x: 92, y: 40 },
    old_mill_night_b: { x: 92, y: 42 },
    camp_frost_rat: { x: 35, y: 47 },
    camp_woodcutter: { x: 40, y: 42 },
    mill_overseer_spawn: { x: 77, y: 24 },
    mill_frost_crow: { x: 86, y: 35 },
    mill_ash_wolf: { x: 87, y: 15 },
    mill_cinder_husk: { x: 89, y: 30 },
    deep_shadow_lynx: { x: 104, y: 17 },
    deep_bog_spitter: { x: 111, y: 28 },
    deep_ember_wisp: { x: 119, y: 16 },
    deep_woods_night_wolf: { x: 121, y: 34 },
    deep_woods_night_lynx: { x: 101, y: 34 },
    ridge_frozen_guard: { x: 137, y: 28 },
    ridge_warden: { x: 146, y: 23 },
  },
  regions: [
    {
      bounds: { id: "camp_edge", x0: 0, y0: 0, x1: 47, y1: 63 },
      terrain: [
        { x0: 2, y0: 2, x1: 46, y1: 61, tile: "snow" },
        { x0: 6, y0: 14, x1: 26, y1: 14, tile: "path" },
        { x0: 6, y0: 36, x1: 26, y1: 36, tile: "path" },
        { x0: 6, y0: 14, x1: 6, y1: 36, tile: "path" },
        { x0: 26, y0: 14, x1: 26, y1: 36, tile: "path" },
        { x0: 16, y0: 24, x1: 46, y1: 25, tile: "path" },
      ],
      trees: { density: 0.14, maxX: 46 },
      nodeArea: { campDistance: [6, 24] },
      nodes: [
        { idPrefix: "camp_edge_wood", itemId: "wood", count: 6, yield: 2 },
        { idPrefix: "camp_edge_stone", itemId: "stone", count: 5, yield: 2 },
        { idPrefix: "camp_edge_fiber", itemId: "fiber", count: 3, yield: 2 },
        { idPrefix: "camp_edge_berry", itemId: "berry", count: 6, yield: 1 },
        { idPrefix: "camp_edge_herb", itemId: "herb", count: 3, yield: 1 },
      ],
    },
    {
      bounds: { id: "old_mill", x0: 48, y0: 0, x1: 95, y1: 47 },
      terrain: [
        { x0: 49, y0: 2, x1: 93, y1: 45, tile: "snow" },
        { x0: 48, y0: 24, x1: 60, y1: 25, tile: "path" },
        { ...MILL_BUILDING, tile: "wall" },
        { x0: 61, y0: 13, x1: 81, y1: 33, tile: "floor" },
        { x0: 60, y0: 24, x1: 60, y1: 25, tile: "floor" },
        { x0: 67, y0: 18, x1: 68, y1: 19, tile: "wall" },
        { x0: 67, y0: 28, x1: 68, y1: 29, tile: "wall" },
        { x0: 75, y0: 18, x1: 76, y1: 19, tile: "wall" },
        { x0: 75, y0: 28, x1: 76, y1: 29, tile: "wall" },
        { x0: 82, y0: 24, x1: 95, y1: 25, tile: "path" },
      ],
      gate: {
        tiles: [
          { x: 47, y: 24 },
          { x: 47, y: 25 },
        ],
        interactAt: { x: 47, y: 24.5 },
        reserveOffset: { x: -2, y: 0 },
      },
      relay: { x: 54, y: 21 },
      trees: { density: 0.06, maxX: 92 },
      nodeArea: { minX: 54 },
      nodes: [
        { idPrefix: "old_mill_ore", itemId: "ore", count: 5, yield: 2 },
        {
          idPrefix: "old_mill_west_ore",
          itemId: "ore",
          count: 2,
          yield: 2,
          maxX: 59,
        },
        { idPrefix: "old_mill_stone", itemId: "stone", count: 2, yield: 2 },
        { idPrefix: "old_mill_wood", itemId: "wood", count: 2, yield: 2 },
        {
          idPrefix: "old_mill_frostcap",
          itemId: "frostcap",
          count: 4,
          yield: 1,
        },
        { idPrefix: "old_mill_herb", itemId: "herb", count: 2, yield: 1 },
      ],
    },
    {
      bounds: { id: "deep_woods", x0: 96, y0: 10, x1: 125, y1: 38 },
      terrain: [
        { x0: 96, y0: 11, x1: 124, y1: 37, tile: "snow" },
        { x0: 96, y0: 24, x1: 124, y1: 25, tile: "path" },
      ],
      trees: { density: 0.1, maxX: 124, denseEdges: false },
      nodes: [
        { idPrefix: "deep_woods_wood", itemId: "wood", count: 4, yield: 2 },
        {
          idPrefix: "deep_woods_frostcap",
          itemId: "frostcap",
          count: 3,
          yield: 1,
        },
        { idPrefix: "deep_woods_berry", itemId: "berry", count: 4, yield: 1 },
        { idPrefix: "deep_woods_ore", itemId: "ore", count: 3, yield: 2 },
      ],
    },
    {
      bounds: { id: "frost_ridge", x0: 126, y0: 10, x1: 155, y1: 38 },
      terrain: [
        { x0: 126, y0: 11, x1: 154, y1: 37, tile: "snow" },
        { x0: 126, y0: 24, x1: 151, y1: 25, tile: "path" },
      ],
      trees: { density: 0.035, maxX: 154, denseEdges: false },
      nodes: [
        { idPrefix: "frost_ridge_stone", itemId: "stone", count: 4, yield: 2 },
        { idPrefix: "frost_ridge_ore", itemId: "ore", count: 3, yield: 2 },
      ],
      beacon: { x: 151, y: 24 },
      gate: {
        tiles: [
          { x: 125, y: 24 },
          { x: 125, y: 25 },
        ],
        interactAt: { x: 125, y: 24.5 },
      },
    },
  ],
};
