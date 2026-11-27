import type { TileMeta } from "../world/worldTypes";
import {
  CHUNK_SIZE,
  INITIAL_CLASSIC_ROCKS,
  INITIAL_CLASSIC_TREES,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
  SURVIVAL_HEIGHT,
  SURVIVAL_WIDTH,
  type SurvivalBiome,
  inOriginalMap,
  solidSurvivalTerrain,
  survivalCellKey,
} from "./survivalBiomes";
import { chunkCellIndex } from "./survivalNoise";
import {
  MICROCLIMATES,
  biomePass,
  encounterPlan,
  featurePass,
  landmarkPass,
  spawnAnchorPass,
  terrainPass,
} from "./survivalPasses";

export interface SurvivalSite {
  x: number;
  y: number;
  type: number;
}

export interface GeneratedSurvivalTerrain {
  tiles: number[][];
  regions: number[][];
  trail: Set<number | string>;
  sites: SurvivalSite[];
}

export function fillTileRect(
  grid: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tile: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) grid[y][x] = tile;
  }
}

export function buildBaseClassicWorld(): number[][] {
  const grid = Array.from({ length: SURVIVAL_HEIGHT }, () =>
    Array<number>(SURVIVAL_WIDTH).fill(0),
  );
  fillTileRect(grid, 2, 12, 12, 20, 1);
  fillTileRect(grid, 3, 3, 16, 10, 1);
  fillTileRect(grid, 18, 2, 32, 11, 3);
  fillTileRect(grid, 7, 21, 22, 29, 4);
  fillTileRect(grid, 15, 12, 34, 20, 1);
  fillTileRect(grid, 37, 10, 47, 22, 7);
  fillTileRect(grid, 34, 15, 38, 17, 2);
  fillTileRect(grid, 33, 15, 34, 17, 2);
  fillTileRect(grid, 7, 9, 10, 14, 2);
  fillTileRect(grid, 10, 15, 34, 17, 2);
  fillTileRect(grid, 24, 9, 27, 15, 2);
  fillTileRect(grid, 11, 18, 14, 24, 2);
  fillTileRect(grid, 18, 18, 24, 20, 2);
  fillTileRect(grid, 4, 6, 5, 6, 0);
  fillTileRect(grid, 14, 5, 15, 6, 0);
  fillTileRect(grid, 18, 2, 20, 3, 6);
  fillTileRect(grid, 29, 3, 31, 4, 6);
  fillTileRect(grid, 15, 23, 19, 25, 5);
  fillTileRect(grid, 18, 25, 20, 27, 5);
  fillTileRect(grid, 7, 26, 9, 28, 5);
  fillTileRect(grid, 18, 14, 19, 14, 0);
  fillTileRect(grid, 30, 18, 31, 19, 0);
  fillTileRect(grid, 43, 11, 46, 12, 6);
  fillTileRect(grid, 40, 20, 42, 21, 6);
  return grid;
}

export function applyClassicSurvivalTerrain(
  target: number[][],
  baseWorld: readonly (readonly number[])[],
): void {
  baseWorld.forEach((row, y) => {
    target[y] = row.slice();
  });
  fillTileRect(target, 2, 9, 24, 23, 1);
  fillTileRect(target, 6, 15, 24, 16, 2);
  fillTileRect(target, 16, 17, 21, 20, 5);
  fillTileRect(target, 17, 11, 20, 14, 1);
  fillTileRect(target, 18, 13, 20, 13, 2);
  for (const [x, y] of INITIAL_CLASSIC_TREES) target[y][x] = 0;
  for (const [x, y] of INITIAL_CLASSIC_ROCKS) target[y][x] = 6;
}

export function carveCampPassages(
  target: number[][],
  groundTileAt: (x: number, y: number) => number,
  camp: { readonly x: number; readonly y: number } = SURVIVAL_CAMP,
): void {
  for (let x = 0; x < SURVIVAL_WIDTH; x++) {
    if (solidSurvivalTerrain(target[camp.y][x]))
      target[camp.y][x] = groundTileAt(x, camp.y);
  }
  for (let y = 0; y < SURVIVAL_HEIGHT; y++) {
    if (solidSurvivalTerrain(target[y][camp.x]))
      target[y][camp.x] = groundTileAt(camp.x, y);
  }
}

export function resolveEcologyBiome(
  x: number,
  y: number,
  directBiome?: SurvivalBiome,
): SurvivalBiome {
  if (directBiome) return directBiome;
  if (y < 12) return SURVIVAL_BIOMES[x > 17 ? 3 : 1];
  if (y >= 23) return SURVIVAL_BIOMES[x <= 22 ? 2 : 4];
  return SURVIVAL_BIOMES[0];
}

export {
  terrainPass,
  biomePass,
  landmarkPass,
  featurePass,
  spawnAnchorPass,
} from "./survivalPasses";

export function generateChunk(
  seed: number,
  cx: number,
  cy: number,
  density = 1,
  encounters = encounterPlan(seed),
) {
  const terrain = terrainPass(seed, cx, cy);
  const biomes = biomePass(terrain);
  const landmarks = landmarkPass(biomes, encounters);
  const features = featurePass(landmarks, density);
  return spawnAnchorPass(features);
}

export function createSurvivalWorld(
  seed: number,
  density = 1,
  enableEncounters = true,
) {
  const encounters = enableEncounters ? encounterPlan(seed) : [];
  const cache = new Map<string, ReturnType<typeof generateChunk>>();
  function getChunk(cx: number, cy: number) {
    const key = `${cx},${cy}`;
    let chunk = cache.get(key);
    if (!chunk) {
      chunk = generateChunk(seed, cx, cy, density, encounters);
      const first = cache.keys().next();
      if (cache.size >= 64 && !first.done) cache.delete(first.value);
      cache.set(key, chunk);
    }
    return chunk;
  }
  function getTileMeta(x: number, y: number) {
    const chunk = getChunk(
      Math.floor(x / CHUNK_SIZE),
      Math.floor(y / CHUNK_SIZE),
    );
    const i = chunkCellIndex(chunk, x, y);
    const tile = chunk.terrain[i];
    const biomeId = chunk.regions[i];
    const snowDepth = chunk.snow[i] / 255;
    let material: TileMeta["material"];
    if (tile === 5) material = "water";
    else if (tile === 9) material = "cliff";
    else if (tile === 2) material = "trail";
    else if (tile === 7) material = "rubble";
    else if (snowDepth >= 0.18) material = "snow";
    else if (biomeId === 6) material = "ash";
    else if (biomeId === 3) material = "stone";
    else if (biomeId === 2 || biomeId === 8) material = "mud";
    else material = "grass";
    const walkSpeedMultiplier =
      (material === "mud" ? 0.88 : material === "rubble" ? 0.94 : 1) *
      (1 - 0.3 * snowDepth);
    return {
      tile,
      biomeId,
      material,
      snowDepth,
      walkSpeedMultiplier,
      microclimate: MICROCLIMATES[chunk.microclimate[i]],
      feature: chunk.features[i],
      reservation: chunk.reserved[i],
    };
  }
  return { getChunk, getTileMeta, encounters };
}

// The Canvas page keeps its original mutable core grid for harvested tiles.
// Both sides of that window now sample the same deterministic chunk source.
export function generateSurvivalTerrain(
  seed: number,
  density = 1,
  source = createSurvivalWorld(seed, density),
): GeneratedSurvivalTerrain {
  const trail = new Set<number | string>();
  const sites: SurvivalSite[] = [];
  const regions = Array.from({ length: SURVIVAL_HEIGHT }, () =>
    Array<number>(SURVIVAL_WIDTH),
  );
  const tiles = regions.map((row, y) =>
    Array.from({ length: SURVIVAL_WIDTH }, (_, x) => {
      const meta = source.getTileMeta(x, y);
      row[x] = meta.biomeId;
      if (meta.reservation) trail.add(survivalCellKey(x, y));
      return meta.tile;
    }),
  );
  for (let cy = 0; cy < Math.ceil(SURVIVAL_HEIGHT / CHUNK_SIZE); cy++)
    for (let cx = 0; cx < Math.ceil(SURVIVAL_WIDTH / CHUNK_SIZE); cx++) {
      for (const { x, y } of source.getChunk(cx, cy).landmarks)
        if (inOriginalMap(x, y)) sites.push({ x, y, type: regions[y][x] });
    }
  return { tiles, regions, trail, sites };
}
