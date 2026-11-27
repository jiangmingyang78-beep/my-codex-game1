import { CHUNK_SIZE } from "./survivalBiomes";
export interface SurvivalChunk {
  x: number;
  y: number;
  terrain: Uint8Array;
  regions: Uint8Array;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Hash signed grid coordinates directly, so loading order never affects the seed.
export function chunkHash(
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
  return (n ^ (n >>> 16)) >>> 0;
}

export function seededValue(
  seed: number,
  x: number,
  y: number,
  salt: number,
): number {
  return chunkHash(seed, x, y, salt) / 0x100000000;
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

export const chunkCellIndex = (
  chunk: Pick<SurvivalChunk, "x" | "y">,
  x: number,
  y: number,
): number => (y - chunk.y * CHUNK_SIZE) * CHUNK_SIZE + x - chunk.x * CHUNK_SIZE;

const diagonal = Math.SQRT1_2;
const gradients = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [diagonal, diagonal],
  [-diagonal, diagonal],
  [diagonal, -diagonal],
  [-diagonal, -diagonal],
];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const unit = (t: number) => Math.min(1, Math.max(0, t));

function gradient2D(seed: number, x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = x - ix;
  const v = y - iy;
  function dot(dx: number, dy: number) {
    const [gx, gy] = gradients[chunkHash(seed, ix + dx, iy + dy, salt) & 7];
    return gx * (u - dx) + gy * (v - dy);
  }
  return lerp(
    lerp(dot(0, 0), dot(1, 0), fade(u)),
    lerp(dot(0, 1), dot(1, 1), fade(u)),
    fade(v),
  );
}

export interface Climate {
  elevation: number;
  temperature: number;
  moisture: number;
}

/** Zero for the first nine tiles, one from tile 34. The same envelope
 * damps terrain variation and the chance of ordinary solid features. */
export function campWildness(
  x: number,
  y: number,
  camp: { x: number; y: number },
): number {
  const t = unit((Math.hypot(x - camp.x, y - camp.y) - 9) / 25);
  return t * t * (3 - 2 * t);
}

export function sampleClimate(
  seed: number,
  x: number,
  y: number,
  camp: { x: number; y: number },
): Climate {
  const wx = x + 21 * gradient2D(seed, x / 57 + 0.31, y / 57 + 0.64, 101);
  const wy = y + 21 * gradient2D(seed, x / 57 + 0.73, y / 57 + 0.17, 102);
  const wild = campWildness(x, y, camp);
  function channel(scale: number, salt: number, campValue: number) {
    const u = wx / scale + 0.37;
    const v = wy / scale + 0.63;
    const noise =
      0.78 * gradient2D(seed, u, v, salt) +
      0.22 * gradient2D(seed, u * 2 + 0.7, v * 2 + 0.2, salt + 1);
    return lerp(campValue, unit(0.5 + noise), wild);
  }
  return {
    elevation: channel(38, 111, 0.52),
    temperature: channel(72, 121, 0.55),
    moisture: channel(53, 131, 0.48),
  };
}
