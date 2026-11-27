import {
  type PlacedEncounter,
  districtOffset,
  planEncounters,
} from "./encounterPlan";
import {
  COAL_VEIN,
  CHUNK_SIZE as SIZE,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP as camp,
  climateBiome,
  solidSurvivalTerrain,
} from "./survivalBiomes";
import {
  campWildness,
  chunkHash,
  sampleClimate,
  seededValue,
} from "./survivalNoise";

const AREA = SIZE * SIZE;
export const MICROCLIMATES = [
  "temperate",
  "frost",
  "wet",
  "exposed",
  "arid",
] as const;
export const FEATURE = {
  none: 0,
  tree: 1,
  ore: 2,
  berry: 3,
  rubble: 4,
  flora: 5,
  forage: 6,
} as const;
export const RESERVATION = { none: 0, trail: 1, landmark: 2, camp: 3 } as const;
export interface Anchor {
  x: number;
  y: number;
  kind: "wood" | "stone" | "coal" | "nest";
}
export interface Landmark {
  x: number;
  y: number;
  kind: "camp" | "encounter";
}
interface ChunkOrigin {
  seed: number;
  x: number;
  y: number;
}
const indexAt = (c: ChunkOrigin, x: number, y: number) =>
  (y - c.y * SIZE) * SIZE + x - c.x * SIZE;
const owns = (c: ChunkOrigin, x: number, y: number) =>
  Math.floor(x / SIZE) === c.x && Math.floor(y / SIZE) === c.y;

export function terrainPass(seed: number, x: number, y: number) {
  const terrain = new Uint8Array(AREA);
  const elevation = new Float32Array(AREA);
  const temperature = new Float32Array(AREA);
  const moisture = new Float32Array(AREA);
  for (let i = 0; i < AREA; i++) {
    const climate = sampleClimate(
      seed,
      x * SIZE + (i % SIZE),
      y * SIZE + Math.floor(i / SIZE),
      camp,
    );
    elevation[i] = climate.elevation;
    temperature[i] = climate.temperature;
    moisture[i] = climate.moisture;
    terrain[i] =
      elevation[i] < 0.25 + (moisture[i] - 0.5) * 0.14
        ? 5
        : elevation[i] > 0.84
          ? 9
          : 1;
  }
  return { seed, x, y, terrain, elevation, temperature, moisture };
}

export function biomePass(c: ReturnType<typeof terrainPass>) {
  const microclimate = new Uint8Array(AREA);
  const terrain = c.terrain.slice();
  const regions = new Uint8Array(AREA);
  const snow = new Uint8Array(AREA);
  for (let i = 0; i < AREA; i++) {
    const region = climateBiome(
      c.elevation[i],
      c.temperature[i],
      c.moisture[i],
    );
    regions[i] = region;
    snow[i] = Math.round(
      255 *
        Math.min(
          1,
          Math.max(0, (0.55 - c.temperature[i]) * 2.5) * (0.45 + c.moisture[i]),
        ),
    );
    microclimate[i] =
      c.temperature[i] < 0.36
        ? 1
        : c.moisture[i] > 0.68
          ? 2
          : c.elevation[i] > 0.74
            ? 3
            : c.moisture[i] < 0.32
              ? 4
              : 0;
    if (terrain[i] === 1) terrain[i] = SURVIVAL_BIOMES[region].floor;
  }
  return { ...c, terrain, regions, snow, microclimate };
}

// Four chunks share one district. Each edge portal belongs to the west or
// north edge of one district, so its two sides agree without loading neighbors.
function roadPass(c: ReturnType<typeof biomePass>) {
  const terrain = c.terrain.slice();
  const reserved = new Uint8Array(AREA);
  const landmarks: Landmark[] = [];
  const side = 2 * SIZE;
  const dx = Math.floor(c.x / 2);
  const dy = Math.floor(c.y / 2);
  const left = dx * side;
  const top = dy * side;
  const right = left + side - 1;
  const bottom = top + side - 1;
  const offset = (x: number, y: number, salt: number) =>
    districtOffset(c.seed, x, y, salt);
  const atCamp =
    dx === Math.floor(camp.x / side) && dy === Math.floor(camp.y / side);
  const hx = atCamp ? camp.x : left + offset(dx, dy, 201);
  const hy = atCamp ? camp.y : top + offset(dx, dy, 202);
  function rect(x0: number, y0: number, x1: number, y1: number, kind: number) {
    for (
      let y = Math.max(y0, c.y * SIZE);
      y <= Math.min(y1, (c.y + 1) * SIZE - 1);
      y++
    ) {
      for (
        let x = Math.max(x0, c.x * SIZE);
        x <= Math.min(x1, (c.x + 1) * SIZE - 1);
        x++
      ) {
        const i = indexAt(c, x, y);
        reserved[i] = kind;
        terrain[i] =
          kind === RESERVATION.trail ? 2 : SURVIVAL_BIOMES[c.regions[i]].floor;
      }
    }
  }
  function segment(x: number, y: number, ex: number, ey: number) {
    rect(
      Math.min(x, ex),
      Math.min(y, ey),
      Math.max(x, ex),
      Math.max(y, ey),
      RESERVATION.trail,
    );
  }
  for (const [edge, bend, owner] of [
    [left, left + 1, dx],
    [right, right - 1, dx + 1],
  ]) {
    const portal = top + offset(owner, dy, 203);
    segment(hx, hy, bend, hy);
    segment(bend, hy, bend, portal);
    segment(bend, portal, edge, portal);
  }
  for (const [edge, bend, owner] of [
    [top, top + 1, dy],
    [bottom, bottom - 1, dy + 1],
  ]) {
    const portal = left + offset(dx, owner, 204);
    segment(hx, hy, hx, bend);
    segment(hx, bend, portal, bend);
    segment(portal, bend, portal, edge);
  }
  function pad(x: number, y: number, kind: Landmark["kind"]) {
    rect(x - 1, y - 1, x + 1, y + 1, RESERVATION.landmark);
    if (owns(c, x, y)) landmarks.push({ x, y, kind });
  }
  if (atCamp) {
    // The starting well, pen, gate and gathering area share this clearing.
    rect(2, 11, 16, 22, RESERVATION.camp);
    segment(hx, hy, 23, hy);
    segment(23, hy, 23, 8);
    pad(23, 8, "encounter");
  }
  pad(hx, hy, atCamp ? "camp" : "encounter");
  return { ...c, terrain, reserved, landmarks };
}

const plans = new Map<number, PlacedEncounter[]>();
export function encounterPlan(seed: number) {
  let plan = plans.get(seed);
  if (!plan) {
    plan = planEncounters(seed, (world, x, y) =>
      roadPass(biomePass(terrainPass(world, x, y))),
    );
    if (plans.size >= 4) plans.delete(plans.keys().next().value!);
    plans.set(seed, plan);
  }
  return plan;
}
export function landmarkPass(
  c: ReturnType<typeof biomePass>,
  pieces = encounterPlan(c.seed),
) {
  const result = roadPass(c);
  const left = c.x * SIZE;
  const top = c.y * SIZE;
  for (const p of pieces) {
    for (
      let y = Math.max(top, p.top);
      y < Math.min(top + SIZE, p.top + p.h);
      y++
    )
      for (
        let x = Math.max(left, p.left);
        x < Math.min(left + SIZE, p.left + p.w);
        x++
      ) {
        const i = indexAt(c, x, y);
        result.terrain[i] = p.tiles[(y - p.top) * p.w + x - p.left];
        if (!result.reserved[i]) result.reserved[i] = RESERVATION.landmark;
      }
  }
  return result;
}

export function featurePass(
  c: ReturnType<typeof landmarkPass>,
  resourceDensity = 1,
) {
  const terrain = c.terrain.slice();
  const features = new Uint8Array(AREA);
  // One candidate in the inner 2×2 cells of a global 4×4 grid. Features
  // remain at least three tiles apart, including across negative chunk edges.
  for (let gy = c.y * 4; gy < (c.y + 1) * 4; gy++)
    for (let gx = c.x * 4; gx < (c.x + 1) * 4; gx++) {
      const h = chunkHash(c.seed, gx, gy, 301);
      const x = gx * 4 + 1 + (h & 1);
      const y = gy * 4 + 1 + ((h >>> 1) & 1);
      const i = indexAt(c, x, y);
      if (c.reserved[i] || solidSurvivalTerrain(terrain[i])) continue;
      // Leave room to approach the feature and step around it on land.
      if (
        [i - 1, i + 1, i - SIZE, i + SIZE].filter(
          (n) => !solidSurvivalTerrain(c.terrain[n]),
        ).length < 3
      )
        continue;
      const biome = SURVIVAL_BIOMES[c.regions[i]];
      if (
        seededValue(c.seed, x, y, 302) >=
        campWildness(x, y, camp) *
          Math.min(1, resourceDensity * (0.45 + biome.tree + biome.rock))
      )
        continue;
      const roll =
        seededValue(c.seed, x, y, 303) * (biome.tree + biome.rock + 0.22);
      if (roll < biome.tree) {
        features[i] = FEATURE.tree;
        terrain[i] = 0;
      } else if (roll < biome.tree + biome.rock) {
        features[i] = FEATURE.ore;
        terrain[i] = biome.coal && h & 4 ? COAL_VEIN : 6;
      } else if (roll < biome.tree + biome.rock + 0.045) {
        features[i] = FEATURE.rubble;
        terrain[i] = 7;
      } else if (roll < biome.tree + biome.rock + 0.115)
        features[i] = FEATURE.flora;
      else features[i] = h & 8 ? FEATURE.berry : FEATURE.forage;
    }
  return { ...c, terrain, features };
}

const supplies: readonly Anchor[] = [
  { x: 3, y: 13, kind: "wood" },
  { x: 8, y: 12, kind: "wood" },
  { x: 3, y: 19, kind: "stone" },
  { x: 8, y: 20, kind: "stone" },
  { x: 4, y: 18, kind: "coal" },
];
export function spawnAnchorPass(c: ReturnType<typeof featurePass>) {
  const terrain = c.terrain.slice();
  const anchors: Anchor[] = [];
  for (const a of supplies)
    if (owns(c, a.x, a.y)) {
      terrain[indexAt(c, a.x, a.y)] =
        a.kind === "wood" ? 0 : a.kind === "stone" ? 6 : COAL_VEIN;
      anchors.push({ ...a });
    }
  // The odd stride visits every candidate exactly once. A nest needs a free
  // approach tile inside its chunk, and never occupies a landmark or feature.
  const start = chunkHash(c.seed, c.x, c.y, 401) % AREA;
  for (let k = 0; k < AREA; k++) {
    const i = (start + 37 * k) % AREA;
    const lx = i % SIZE;
    const ly = Math.floor(i / SIZE);
    if (
      lx === 0 ||
      lx === SIZE - 1 ||
      ly === 0 ||
      ly === SIZE - 1 ||
      c.reserved[i] ||
      c.features[i] ||
      solidSurvivalTerrain(terrain[i])
    )
      continue;
    if (
      [i - 1, i + 1, i - SIZE, i + SIZE].every((n) =>
        solidSurvivalTerrain(terrain[n]),
      )
    )
      continue;
    anchors.push({ x: c.x * SIZE + lx, y: c.y * SIZE + ly, kind: "nest" });
    break;
  }
  return { ...c, terrain, anchors };
}
