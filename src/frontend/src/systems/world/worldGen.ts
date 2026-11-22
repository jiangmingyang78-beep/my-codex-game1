import type { GameData } from "@/core/dataTypes";
import { createRng } from "@/core/rng";
import {
  CAMP_TILE,
  GATE_TILES,
  HERO_START_TILE,
  MILL_BUILDING,
  MILL_PILLARS,
  MILL_RELAY_TILE,
  NODE_PLANS,
  REGION_BOUNDS,
  SPAWN_TILES,
  WORLD_SEED,
} from "./worldLayout";
import {
  type SpawnPoint,
  TILE,
  type World,
  type WorldObject,
} from "./worldTypes";

const RENEWABLE_WOOD_OFFSETS = [
  { x: -4, y: -3 },
  { x: 4, y: -3 },
  { x: -4, y: 3 },
  { x: 4, y: 3 },
];

interface Grid {
  w: number;
  h: number;
  tiles: Uint8Array;
}

const at = (g: Grid, x: number, y: number) => y * g.w + x;

function fillRect(
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: number,
): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) g.tiles[at(g, x, y)] = tile;
}

function carveTerrain(g: Grid): void {
  g.tiles.fill(TILE.wall);
  fillRect(g, 2, 2, 46, 61, TILE.snow);
  fillRect(g, 49, 2, 93, 45, TILE.snow);
  // Training loop around the camp and the road to the mill gate.
  for (let x = 6; x <= 26; x++) {
    g.tiles[at(g, x, 14)] = TILE.path;
    g.tiles[at(g, x, 36)] = TILE.path;
  }
  for (let y = 14; y <= 36; y++) {
    g.tiles[at(g, 6, y)] = TILE.path;
    g.tiles[at(g, 26, y)] = TILE.path;
  }
  fillRect(g, 16, 24, 46, 25, TILE.path);
  fillRect(g, 48, 24, 60, 25, TILE.path);
  const m = MILL_BUILDING;
  fillRect(g, m.x0, m.y0, m.x1, m.y1, TILE.wall);
  fillRect(g, m.x0 + 1, m.y0 + 1, m.x1 - 1, m.y1 - 1, TILE.floor);
  for (const y of m.openY) g.tiles[at(g, m.x0, y)] = TILE.floor;
  for (const p of MILL_PILLARS)
    fillRect(g, p.x, p.y, p.x + 1, p.y + 1, TILE.wall);
  for (const t of GATE_TILES) g.tiles[at(g, t.x, t.y)] = TILE.door;
  g.tiles[at(g, CAMP_TILE.x, CAMP_TILE.y)] = TILE.fireBase;
  g.tiles[at(g, MILL_RELAY_TILE.x, MILL_RELAY_TILE.y)] = TILE.fireBase;
}

const px = (tile: number, size: number) => (tile + 0.5) * size;

/** Picks free tiles with a seeded RNG; `taken` holds tile indices that are not available. */
function placeNodes(
  data: GameData,
  g: Grid,
  taken: Set<number>,
): WorldObject[] {
  const rng = createRng(WORLD_SEED);
  const size = data.tileSize;
  const out: WorldObject[] = [];
  const claim = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) taken.add(at(g, x + dx, y + dy));
  };
  data.worldObjects.renewableWoodNodeIds.forEach((id, i) => {
    const o = RENEWABLE_WOOD_OFFSETS[i % RENEWABLE_WOOD_OFFSETS.length];
    const x = CAMP_TILE.x + o.x;
    const y = CAMP_TILE.y + o.y;
    claim(x, y);
    out.push({
      id,
      kind: "node",
      regionId: "camp_edge",
      x: px(x, size),
      y: px(y, size),
      itemId: "wood",
      yield: 1,
      renewable: true,
    });
  });
  for (const bounds of REGION_BOUNDS) {
    for (const plan of NODE_PLANS[bounds.id] ?? []) {
      for (let n = 1; n <= plan.count; n++) {
        for (let attempt = 0; attempt < 400; attempt++) {
          const x =
            bounds.x0 + 5 + Math.floor(rng() * (bounds.x1 - bounds.x0 - 10));
          const y =
            bounds.y0 + 5 + Math.floor(rng() * (bounds.y1 - bounds.y0 - 10));
          const tile = g.tiles[at(g, x, y)];
          if (
            (tile !== TILE.snow && tile !== TILE.floor) ||
            taken.has(at(g, x, y))
          )
            continue;
          const nearCamp = Math.hypot(x - CAMP_TILE.x, y - CAMP_TILE.y);
          if (bounds.id === "camp_edge" && (nearCamp < 6 || nearCamp > 24))
            continue;
          if (bounds.id === "old_mill" && x < 54) continue;
          claim(x, y);
          out.push({
            id: `${plan.idPrefix}_${n}`,
            kind: "node",
            regionId: bounds.id,
            x: px(x, size),
            y: px(y, size),
            itemId: plan.itemId,
            yield: plan.yield,
            renewable: data.dawnRenewal.renewableItemIds.includes(plan.itemId),
          });
          break;
        }
      }
    }
  }
  return out;
}

function scatterTrees(g: Grid, taken: Set<number>): void {
  const rng = createRng(WORLD_SEED ^ 0x7ee5);
  for (const b of REGION_BOUNDS) {
    const density = b.id === "camp_edge" ? 0.14 : 0.06;
    for (let y = b.y0 + 2; y <= b.y1 - 2; y++) {
      for (let x = b.x0 + 2; x <= Math.min(b.x1, 93) - 1; x++) {
        const i = at(g, x, y);
        if (g.tiles[i] !== TILE.snow || taken.has(i)) continue;
        if (
          rng() < density ||
          x === b.x0 + 2 ||
          y === b.y0 + 2 ||
          y === b.y1 - 2
        )
          g.tiles[i] = TILE.tree;
      }
    }
  }
}

function reserve(
  g: Grid,
  taken: Set<number>,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x >= 0 && y >= 0 && x < g.w && y < g.h) taken.add(at(g, x, y));
    }
  }
}

/** Builds the deterministic tile grid, collision data and object table. */
export function generateWorld(data: GameData): World {
  const { widthTiles: w, heightTiles: h } = data.balance.world;
  const size = data.tileSize;
  const g: Grid = { w, h, tiles: new Uint8Array(w * h) };
  carveTerrain(g);
  const taken = new Set<number>();
  for (let i = 0; i < g.tiles.length; i++)
    if (g.tiles[i] === TILE.path) taken.add(i);
  reserve(g, taken, CAMP_TILE.x, CAMP_TILE.y, 3);
  reserve(g, taken, HERO_START_TILE.x, HERO_START_TILE.y, 2);
  reserve(g, taken, MILL_RELAY_TILE.x, MILL_RELAY_TILE.y, 2);
  for (const t of Object.values(SPAWN_TILES)) reserve(g, taken, t.x, t.y, 2);
  for (const t of GATE_TILES) reserve(g, taken, t.x - 2, t.y, 2);

  const nodes = placeNodes(data, g, taken);
  scatterTrees(g, taken);

  const objects = new Map<string, WorldObject>();
  const add = (o: WorldObject) => objects.set(o.id, o);
  add({
    id: data.worldObjects.mainCampfireId,
    kind: "campfire",
    regionId: "camp_edge",
    x: px(CAMP_TILE.x, size),
    y: px(CAMP_TILE.y, size),
  });
  for (const region of data.regionList) {
    if (!REGION_BOUNDS.some((b) => b.id === region.id)) continue;
    if (region.entry.gateId) {
      const mid = GATE_TILES.reduce((s, t) => s + t.y, 0) / GATE_TILES.length;
      add({
        id: region.entry.gateId,
        kind: "gate",
        regionId: region.id,
        x: px(GATE_TILES[0].x, size),
        y: px(mid, size),
      });
    }
    if (region.relaySocketId) {
      add({
        id: region.relaySocketId,
        kind: "relay_socket",
        regionId: region.id,
        x: px(MILL_RELAY_TILE.x, size),
        y: px(MILL_RELAY_TILE.y, size),
      });
    }
  }
  for (const n of nodes) add(n);

  const spawns = new Map<string, SpawnPoint>();
  for (const region of data.regionList) {
    if (!REGION_BOUNDS.some((b) => b.id === region.id)) continue;
    for (const s of [...region.residentSpawns, ...region.nightSpawns]) {
      const t = SPAWN_TILES[s.spawnId];
      if (!t) throw new Error(`Missing spawn tile for ${s.spawnId}`);
      spawns.set(s.spawnId, {
        spawnId: s.spawnId,
        regionId: region.id,
        x: px(t.x, size),
        y: px(t.y, size),
      });
    }
  }
  const gateTiles = new Map<number, string>();
  const gateId = data.regionList.find((r) => r.id === "old_mill")?.entry.gateId;
  if (gateId)
    for (const t of GATE_TILES) gateTiles.set(at(g, t.x, t.y), gateId);

  return {
    widthTiles: w,
    heightTiles: h,
    tileSize: size,
    tiles: g.tiles,
    regions: REGION_BOUNDS,
    objects,
    objectList: [...objects.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    spawns,
    gateTiles,
    heroStart: {
      x: px(HERO_START_TILE.x, size),
      y: px(HERO_START_TILE.y, size),
    },
    campfire: { x: px(CAMP_TILE.x, size), y: px(CAMP_TILE.y, size) },
  };
}

let cached: World | null = null;
export function getWorld(data: GameData): World {
  if (!cached) cached = generateWorld(data);
  return cached;
}
