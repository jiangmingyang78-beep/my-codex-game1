// Layout used to reconstruct previously saved seeded worlds.
import { resourceRoll } from "../survivalTuning";
import {
  CHUNK_RADIUS,
  CHUNK_SIZE,
  COAL_VEIN,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
  SURVIVAL_HEIGHT,
  SURVIVAL_WIDTH,
  originalPlayableCell,
  survivalCellKey,
} from "./survivalBiomes";
import { type SurvivalChunk, seededValue, terrainNoise } from "./survivalNoise";
import type {
  GeneratedSurvivalTerrain,
  SurvivalSite,
} from "./survivalWorldGen";
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function expandedBiome(seed: number, x: number, y: number): number {
  const heat = terrainNoise(seed, x / 79, y / 79, 20);
  const moisture = terrainNoise(seed, x / 64, y / 64, 21);
  const relief = terrainNoise(seed, x / 54, y / 54, 22);
  if (heat < 0.26) return 4;
  if (heat < 0.43 && moisture > 0.34) return 5;
  if (relief > 0.72) return 3;
  if (heat > 0.61 && moisture < 0.42) return 6;
  if (moisture > 0.76) return heat > 0.52 ? 8 : 2;
  if (moisture > 0.6) return 1;
  if (moisture > 0.43 && relief < 0.53) return 7;
  return 0;
}

function buildSurvivalChunk(
  cx: number,
  cy: number,
  seed: number,
  resourceDensity = 1,
  camp: { readonly x: number; readonly y: number } = SURVIVAL_CAMP,
): SurvivalChunk {
  const chunk: SurvivalChunk = {
    x: cx,
    y: cy,
    terrain: new Uint8Array(CHUNK_SIZE ** 2),
    regions: new Uint8Array(CHUNK_SIZE ** 2),
  };
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = cx * CHUNK_SIZE + lx;
      const y = cy * CHUNK_SIZE + ly;
      const i = ly * CHUNK_SIZE + lx;
      const region = expandedBiome(seed, x, y);
      const biome = SURVIVAL_BIOMES[region];
      const roll = resourceRoll(seededValue(seed, x, y, 23), resourceDensity);
      chunk.regions[i] = region;
      if (x === camp.x || y === camp.y) chunk.terrain[i] = biome.floor;
      else if (
        biome.lake &&
        terrainNoise(seed, x / 10, y / 10, 24) < biome.lake
      )
        chunk.terrain[i] = 5;
      else if (region === 3 && roll < 0.12) chunk.terrain[i] = COAL_VEIN;
      else if (roll < biome.rock) chunk.terrain[i] = 6;
      else chunk.terrain[i] = roll < biome.rock + biome.tree ? 0 : biome.floor;
    }
  }
  return chunk;
}

export function getOrCreateSurvivalChunk(
  chunks: Map<string, SurvivalChunk>,
  tx: number,
  ty: number,
  seed: number,
  resourceDensity = 1,
  camp: { readonly x: number; readonly y: number } = SURVIVAL_CAMP,
): SurvivalChunk {
  const cx = Math.floor(tx / CHUNK_SIZE);
  const cy = Math.floor(ty / CHUNK_SIZE);
  const key = `${cx},${cy}`;
  const cached = chunks.get(key);
  if (cached) return cached;
  const chunk = buildSurvivalChunk(cx, cy, seed, resourceDensity, camp);
  if (chunks.size >= (CHUNK_RADIUS * 2 + 3) ** 2) {
    const oldest = chunks.keys().next().value;
    if (oldest !== undefined) chunks.delete(oldest);
  }
  chunks.set(key, chunk);
  return chunk;
}
export function generateLegacyTerrain(
  seed: number,
  resourceDensity = 1,
): GeneratedSurvivalTerrain {
  const types = [0, 1, 2, 3, 4];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(seededValue(seed, i, 0, 1) * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  const sites: SurvivalSite[] = [
    [9, 6],
    [26, 7],
    [41, 7],
    [11, 26],
    [35, 24],
  ].map(([x, y], i) => ({
    x: x + Math.floor(seededValue(seed, x, y, 2) * 7) - 3,
    y: y + Math.floor(seededValue(seed, x, y, 3) * 5) - 2,
    type: types[i],
  }));
  const regions = Array.from({ length: SURVIVAL_HEIGHT }, () =>
    Array<number>(SURVIVAL_WIDTH).fill(0),
  );
  const tiles = regions.map((row, y) =>
    Array.from(row, (_, x) => {
      const wx = x + (terrainNoise(seed, x / 6, y / 6, 4) - 0.5) * 12;
      const wy = y + (terrainNoise(seed, x / 6, y / 6, 5) - 0.5) * 12;
      const site = sites.reduce((best, n) =>
        Math.hypot(wx - n.x, wy - n.y) < Math.hypot(wx - best.x, wy - best.y)
          ? n
          : best,
      );
      const biome = SURVIVAL_BIOMES[site.type];
      regions[y][x] = site.type;
      if (
        !originalPlayableCell(x, y) ||
        terrainNoise(seed, x / 5, y / 5, 6) < biome.lake
      )
        return 5;
      const placement = resourceRoll(
        seededValue(seed, x, y, 7),
        resourceDensity,
      );
      if (site.type === 3 && placement < 0.13) return COAL_VEIN;
      if (placement < biome.rock) return 6;
      return placement < biome.rock + biome.tree ? 0 : biome.floor;
    }),
  );

  const trail = new Set<number | string>();
  const carve = (x: number, y: number) => {
    tiles[y][x] = SURVIVAL_BIOMES[regions[y][x]].floor;
    trail.add(survivalCellKey(x, y));
  };
  for (const site of sites) {
    const steps = Math.max(Math.abs(site.x - 6), Math.abs(site.y - 16));
    let oldX = 6;
    let oldY = 16;
    carve(oldX, oldY);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(lerp(6, site.x, t));
      const y = Math.round(lerp(16, site.y, t) + Math.sin(t * Math.PI) * 2);
      while (oldY !== y) {
        oldY += Math.sign(y - oldY);
        carve(oldX, oldY);
      }
      while (oldX !== x) {
        oldX += Math.sign(x - oldX);
        carve(oldX, oldY);
      }
    }
  }
  for (let y = 12; y <= 22; y++) {
    for (let x = 2; x <= 16; x++) {
      tiles[y][x] = 1;
      regions[y][x] = 0;
    }
  }
  const supplies: [number, number][] = [
    [3, 13],
    [4, 14],
    [5, 12],
    [8, 13],
    [3, 19],
    [5, 20],
    [7, 19],
    [8, 17],
  ];
  supplies.sort(
    ([x, y], [a, b]) =>
      Number(trail.has(survivalCellKey(x, y))) -
        Number(trail.has(survivalCellKey(a, b))) ||
      seededValue(seed, x, y, 8) - seededValue(seed, a, b, 8),
  );
  supplies.slice(0, 4).forEach(([x, y], i) => {
    tiles[y][x] = i < 2 ? 0 : 6;
  });
  const coal = sites.find((site) => site.type === 3);
  if (coal) {
    const coalCell = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: coal.x + dx, y: coal.y + dy }))
      .find(
        ({ x, y }) =>
          !trail.has(survivalCellKey(x, y)) &&
          !(y >= 12 && y <= 22 && x >= 2 && x <= 16) &&
          originalPlayableCell(x, y),
      );
    if (coalCell) tiles[coalCell.y][coalCell.x] = COAL_VEIN;
  }
  return { tiles, regions, trail, sites };
}
