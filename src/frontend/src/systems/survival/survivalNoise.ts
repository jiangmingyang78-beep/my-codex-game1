import { resourceRoll } from "../survivalTuning";
import {
  CHUNK_RADIUS,
  CHUNK_SIZE,
  COAL_VEIN,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
} from "./survivalBiomes";

export interface SurvivalChunk {
  x: number;
  y: number;
  terrain: Uint8Array;
  regions: Uint8Array;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function seededValue(
  seed: number,
  x: number,
  y: number,
  salt: number,
): number {
  let n =
    seed ^
    Math.imul(x + 193, 0x85ebca6b) ^
    Math.imul(y + 97, 0xc2b2ae35) ^
    Math.imul(salt, 0x27d4eb2f);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function terrainNoise(
  seed: number,
  x: number,
  y: number,
  salt: number,
): number {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const u = smooth(x - left);
  const v = smooth(y - top);
  return lerp(
    lerp(
      seededValue(seed, left, top, salt),
      seededValue(seed, left + 1, top, salt),
      u,
    ),
    lerp(
      seededValue(seed, left, top + 1, salt),
      seededValue(seed, left + 1, top + 1, salt),
      u,
    ),
    v,
  );
}

export function seedFromText(
  text: string,
  fallbackRandom: () => string = () =>
    String(Math.floor(Math.random() * 4294967296)),
): string {
  if (!text) return fallbackRandom();
  if (/^\d+$/.test(text)) return String(BigInt(text) & 0xffffffffn);
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value = Math.imul(value ^ text.charCodeAt(i), 0x01000193);
  }
  return String(value >>> 0);
}

export function expandedBiome(seed: number, x: number, y: number): number {
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

export const chunkCellIndex = (
  chunk: Pick<SurvivalChunk, "x" | "y">,
  x: number,
  y: number,
): number => (y - chunk.y * CHUNK_SIZE) * CHUNK_SIZE + x - chunk.x * CHUNK_SIZE;

export function buildSurvivalChunk(
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
