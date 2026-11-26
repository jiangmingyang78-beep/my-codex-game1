import { resourceRoll } from "../survivalTuning";
import {
  COAL_VEIN,
  INITIAL_CLASSIC_ROCKS,
  INITIAL_CLASSIC_TREES,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
  SURVIVAL_HEIGHT,
  SURVIVAL_WIDTH,
  type SurvivalBiome,
  originalPlayableCell,
  solidSurvivalTerrain,
  survivalCellKey,
} from "./survivalBiomes";
import { seededValue, terrainNoise } from "./survivalNoise";

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

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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

export function generateSurvivalTerrain(
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
