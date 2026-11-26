import type { RegionBounds, TILE } from "./worldTypes";

export interface TilePoint {
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
  maxX?: number;
}

export interface RegionLayout {
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
  barrels?: readonly TilePoint[];
  mirrorLamps?: readonly TilePoint[];
}

export interface WorldLayout {
  seed: number;
  heroStart: TilePoint;
  campfire: TilePoint;
  renewableWoodTiles: Readonly<Record<string, TilePoint>>;
  spawns: Readonly<Record<string, TilePoint>>;
  regions: readonly RegionLayout[];
}

export const MILL_BUILDING = { x0: 60, y0: 12, x1: 82, y1: 34 };

const pt = (x: number, y: number): TilePoint => ({ x, y });
const rect = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: keyof typeof TILE,
): TerrainRect => ({ x0, y0, x1, y1, tile });
const node = (
  idPrefix: string,
  itemId: string,
  count: number,
  yieldCount: number,
): NodePlan => ({ idPrefix, itemId, count, yield: yieldCount });

export const WORLD_LAYOUT: WorldLayout = {
  seed: 0x0e1be2,
  heroStart: pt(17, 26),
  campfire: pt(16, 24),
  renewableWoodTiles: {
    camp_dawn_wood_1: pt(12, 21),
    camp_dawn_wood_2: pt(20, 21),
    camp_dawn_wood_3: pt(12, 27),
    camp_dawn_wood_4: pt(20, 27),
  },
  spawns: {
    camp_edge_weasel: pt(33, 40),
    camp_frost_rat: pt(35, 47),
    camp_woodcutter: pt(40, 42),
    camp_edge_night_a: pt(43, 52),
    camp_edge_night_b: pt(43, 54),
    brook_woodcutter_a: pt(58, 58),
    brook_ash_wolf: pt(70, 62),
    brook_shield_guard: pt(80, 56),
    brook_night_a: pt(86, 68),
    caravan_wolf_a: pt(34, 74),
    caravan_wolf_b: pt(24, 82),
    caravan_alpha: pt(16, 78),
    old_mill_weasel: pt(66, 22),
    old_mill_spider: pt(75, 27),
    old_mill_night_a: pt(92, 40),
    old_mill_night_b: pt(92, 42),
    mill_overseer_spawn: pt(77, 24),
    mill_frost_crow: pt(86, 35),
    mill_ash_wolf: pt(87, 15),
    mill_cinder_husk: pt(89, 30),
    deep_shadow_lynx: pt(106, 18),
    deep_bog_spitter: pt(115, 29),
    deep_ember_wisp: pt(126, 18),
    deep_night_a: pt(128, 36),
    hollow_bog_a: pt(110, 58),
    hollow_lynx: pt(124, 62),
    hollow_matriarch: pt(116, 70),
    ice_gorge_ram: pt(154, 24),
    ice_gorge_shade: pt(162, 29),
    ice_gorge_wisp: pt(146, 18),
    ice_gorge_night_a: pt(168, 34),
    ice_gorge_night_b: pt(168, 16),
    outpost_wisp_a: pt(148, 60),
    outpost_mirror_wisp: pt(160, 64),
    ridge_frozen_guard: pt(188, 22),
    ridge_frozen_guard_b: pt(196, 28),
    ridge_warden: pt(204, 24),
    beacon_keeper_spawn: pt(225, 24),
  },
  regions: [
    {
      bounds: { id: "camp_edge", x0: 0, y0: 0, x1: 47, y1: 63 },
      terrain: [
        rect(2, 2, 46, 61, "snow"),
        rect(6, 14, 26, 14, "path"),
        rect(6, 36, 26, 36, "path"),
        rect(6, 14, 6, 36, "path"),
        rect(26, 14, 26, 36, "path"),
        rect(16, 24, 46, 25, "path"),
        rect(26, 36, 27, 55, "path"),
        rect(26, 54, 47, 55, "path"),
      ],
      trees: { density: 0.14, maxX: 46 },
      nodeArea: { campDistance: [6, 24] },
      nodes: [
        node("camp_edge_wood", "wood", 6, 2),
        node("camp_edge_stone", "stone", 5, 2),
        node("camp_edge_fiber", "fiber", 3, 2),
        node("camp_edge_berry", "berry", 6, 1),
      ],
    },
    {
      bounds: { id: "frozen_brook", x0: 48, y0: 48, x1: 95, y1: 79 },
      terrain: [
        rect(48, 49, 93, 77, "snow"),
        rect(56, 50, 66, 76, "ice"),
        rect(67, 58, 73, 72, "bog"),
        rect(74, 52, 84, 74, "ice"),
        rect(48, 54, 90, 55, "path"),
        rect(48, 68, 56, 69, "path"),
      ],
      trees: { density: 0.08, maxX: 92 },
      nodes: [
        node("brook_wood", "wood", 5, 2),
        node("brook_scrap", "iron_scrap", 3, 1),
      ],
    },
    {
      bounds: { id: "burnt_caravan", x0: 0, y0: 64, x1: 47, y1: 95 },
      terrain: [
        rect(3, 66, 47, 93, "snow"),
        rect(12, 68, 47, 70, "path"),
        rect(12, 70, 30, 86, "floor"),
      ],
      barrels: [pt(30, 73), pt(22, 78), pt(18, 82)],
      nodes: [
        node("caravan_resin", "resin", 4, 2),
        node("caravan_pelt", "pelt", 3, 1),
      ],
    },
    {
      bounds: { id: "old_mill", x0: 48, y0: 0, x1: 95, y1: 47 },
      terrain: [
        rect(49, 2, 93, 45, "snow"),
        rect(48, 24, 60, 25, "path"),
        { ...MILL_BUILDING, tile: "wall" },
        rect(61, 13, 81, 33, "floor"),
        rect(60, 24, 60, 25, "floor"),
        rect(67, 18, 68, 19, "wall"),
        rect(67, 28, 68, 29, "wall"),
        rect(75, 18, 76, 19, "wall"),
        rect(75, 28, 76, 29, "wall"),
        rect(82, 24, 95, 25, "path"),
      ],
      gate: {
        tiles: [pt(47, 24), pt(47, 25)],
        interactAt: pt(47, 24.5),
        reserveOffset: pt(-2, 0),
      },
      relay: pt(54, 21),
      trees: { density: 0.06, maxX: 92 },
      nodeArea: { minX: 54 },
      nodes: [
        node("old_mill_ore", "ore", 4, 2),
        node("old_mill_stone", "stone", 2, 2),
        node("old_mill_wood", "wood", 2, 2),
        node("old_mill_frostcap", "frostcap", 4, 1),
      ],
    },
    {
      bounds: { id: "deep_woods", x0: 96, y0: 8, x1: 135, y1: 47 },
      terrain: [
        rect(96, 10, 134, 46, "bog"),
        rect(96, 24, 134, 25, "path"),
        rect(114, 25, 115, 47, "path"),
        rect(120, 20, 124, 24, "snow"),
      ],
      relay: pt(122, 22),
      trees: { density: 0.12, maxX: 133 },
      nodes: [
        node("deep_herb", "herb", 5, 1),
        node("deep_resin", "resin", 4, 1),
      ],
    },
    {
      bounds: { id: "herbalist_hollow", x0: 96, y0: 48, x1: 135, y1: 79 },
      terrain: [
        rect(98, 48, 133, 77, "bog"),
        rect(114, 48, 115, 66, "path"),
        rect(108, 62, 124, 72, "snow"),
      ],
      nodes: [
        node("hollow_herb", "herb", 6, 2),
        node("hollow_resin", "resin", 3, 2),
      ],
    },
    {
      bounds: { id: "ice_gorge", x0: 136, y0: 8, x1: 175, y1: 47 },
      terrain: [
        rect(136, 14, 174, 38, "snow"),
        rect(136, 23, 174, 26, "path"),
        rect(148, 16, 152, 20, "wall"),
        rect(158, 30, 162, 34, "wall"),
        rect(154, 26, 155, 47, "path"),
      ],
      gate: { tiles: [pt(135, 24), pt(135, 25)], interactAt: pt(135, 24.5) },
      relay: pt(166, 22),
      nodes: [
        node("gorge_ore", "ore", 4, 2),
        node("gorge_dust", "ember_dust", 3, 1),
      ],
    },
    {
      bounds: { id: "blackened_outpost", x0: 136, y0: 48, x1: 175, y1: 79 },
      terrain: [
        rect(139, 48, 172, 76, "floor"),
        rect(154, 48, 155, 56, "path"),
      ],
      gate: { tiles: [pt(154, 47), pt(155, 47)], interactAt: pt(154.5, 47) },
      mirrorLamps: [pt(146, 58), pt(164, 58), pt(155, 70)],
      nodes: [node("outpost_dust", "ember_dust", 4, 2)],
    },
    {
      bounds: { id: "frost_ridge", x0: 176, y0: 8, x1: 209, y1: 47 },
      terrain: [
        rect(176, 15, 208, 35, "snow"),
        rect(176, 23, 208, 26, "path"),
        rect(184, 18, 198, 20, "wall"),
      ],
      gate: { tiles: [pt(175, 24), pt(175, 25)], interactAt: pt(175, 24.5) },
    },
    {
      bounds: { id: "beacon", x0: 210, y0: 8, x1: 239, y1: 47 },
      terrain: [
        rect(210, 13, 237, 37, "floor"),
        rect(210, 24, 224, 25, "path"),
        rect(229, 24, 230, 25, "fireBase"),
      ],
      beacon: pt(229, 24),
      gate: { tiles: [pt(209, 24), pt(209, 25)], interactAt: pt(209, 24.5) },
    },
  ],
};
