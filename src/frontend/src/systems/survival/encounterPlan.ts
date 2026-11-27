import plantData from "@/data/plants.json";
import {
  type EncounterSetPieceSchema,
  type StampEntity,
  type StampGrid,
  type StampProp,
  type StampTrigger,
  stampSetPieceIntoWorld,
} from "../world/setPieceStamp";
import { encounterTemplates, resolveEncounter } from "./encounterCatalog";
import {
  CHUNK_SIZE,
  SURVIVAL_CAMP,
  climateBiome,
  solidSurvivalTerrain,
} from "./survivalBiomes";
import { chunkHash, sampleClimate, seededValue } from "./survivalNoise";

const SIDE = CHUNK_SIZE * 2;
export const districtOffset = (
  seed: number,
  x: number,
  y: number,
  salt: number,
) => 5 + (chunkHash(seed, x, y, salt) % (SIDE - 10));
export interface PlacedEncounter {
  id: string;
  templateId: string;
  x: number;
  y: number;
  left: number;
  top: number;
  w: number;
  h: number;
  trigger: StampTrigger;
  tiles: number[];
  props: StampProp[];
  entities: StampEntity[];
}
type RoadChunk = { terrain: Uint8Array; reserved: Uint8Array };
type RoadReader = (seed: number, cx: number, cy: number) => RoadChunk;
const solidPlants = new Set(
  plantData.plants.filter((p) => p.solid).map((p) => p.id),
);
function touchesMainRoad(grid: StampGrid, inside: Uint8Array) {
  const blockers = new Set(
    grid.entities
      .filter((e) => e.kind === "plant" && solidPlants.has(e.ref))
      .map((p) => p.y * SIDE + p.x),
  );
  for (const i of blockers) if (grid.road?.[i]) return false;
  const start = grid.props.find((p) => p.interactive);
  if (!start) return false;
  const queue = [start.y * SIDE + start.x];
  const seen = new Uint8Array(SIDE * SIDE);
  let exit = false;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    if (
      seen[i] ||
      blockers.has(i) ||
      solidSurvivalTerrain(grid.terrain[i]) ||
      (!inside[i] && !grid.road?.[i])
    )
      continue;
    seen[i] = 1;
    const x = i % SIDE;
    const y = Math.floor(i / SIDE);
    if (!inside[i] && (x === 0 || y === 0 || x === SIDE - 1 || y === SIDE - 1))
      exit = true;
    if (x > 0) queue.push(i - 1);
    if (x + 1 < SIDE) queue.push(i + 1);
    if (y > 0) queue.push(i - SIDE);
    if (y + 1 < SIDE) queue.push(i + SIDE);
  }
  return (
    exit &&
    [...grid.props, ...grid.entities].every((p) => {
      const i = p.y * SIDE + p.x;
      if (!blockers.has(i)) return seen[i];
      return [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].some(
        ([dx, dy]) =>
          p.x + dx >= 0 &&
          p.x + dx < SIDE &&
          seen[(p.y + dy) * SIDE + p.x + dx],
      );
    })
  );
}

function place(
  seed: number,
  dx: number,
  dy: number,
  hx: number,
  hy: number,
  template: EncounterSetPieceSchema,
  read: RoadReader,
): PlacedEncounter | null {
  const grid: StampGrid = {
    width: SIDE,
    height: SIDE,
    terrain: new Uint8Array(SIDE * SIDE),
    road: new Uint8Array(SIDE * SIDE),
    props: [],
    entities: [],
    triggers: [],
  };
  for (let cy = 0; cy < 2; cy++)
    for (let cx = 0; cx < 2; cx++) {
      const c = read(seed, 2 * dx + cx, 2 * dy + cy);
      for (let i = 0; i < c.terrain.length; i++) {
        const j =
          (cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE)) * SIDE +
          cx * CHUNK_SIZE +
          (i % CHUNK_SIZE);
        grid.terrain[j] = c.terrain[i];
        grid.road![j] = c.reserved[i];
      }
    }
  const piece = resolveEncounter(template);
  let salt = 872;
  const random = () => seededValue(seed, dx, dy, salt++);
  // Centre both rectangular orientations on the same junction.
  const rotation = random();
  const mirror = random();
  const swap = piece.rotate && Math.floor(rotation * 4) % 2 === 1;
  const left =
    hx - Math.floor((swap ? piece.footprint.h : piece.footprint.w) / 2);
  const top =
    hy - Math.floor((swap ? piece.footprint.w : piece.footprint.h) / 2);
  const rolls = piece.rotate ? [rotation, mirror] : [mirror];
  const stamped = stampSetPieceIntoWorld(
    grid,
    piece,
    left,
    top,
    () => rolls.shift() ?? 0,
  );
  if (!stamped) return null;
  const tiles: number[] = [];
  const inside = new Uint8Array(SIDE * SIDE);
  for (let y = top; y < top + stamped.height; y++)
    for (let x = left; x < left + stamped.width; x++) {
      const wx = dx * SIDE + x;
      const wy = dy * SIDE + y;
      const c = sampleClimate(seed, wx, wy, SURVIVAL_CAMP);
      if (
        !piece.allowedBiomes.includes(
          climateBiome(c.elevation, c.temperature, c.moisture),
        ) ||
        Math.hypot(wx - SURVIVAL_CAMP.x, wy - SURVIVAL_CAMP.y) <
          piece.minDistanceFromCamp
      )
        return null;
      const i = y * SIDE + x;
      inside[i] = 1;
      tiles.push(grid.terrain[i]);
    }
  if (!stamped.triggers.length || !touchesMainRoad(grid, inside)) return null;
  const absolute = <T extends { x: number; y: number }>(p: T) => ({
    ...p,
    x: p.x + dx * SIDE,
    y: p.y + dy * SIDE,
  });
  return {
    trigger: absolute(stamped.triggers[0]),
    id: `${piece.id}@${dx},${dy}`,
    templateId: piece.id,
    ...absolute({ x: hx, y: hy }),
    left: left + dx * SIDE,
    top: top + dy * SIDE,
    w: stamped.width,
    h: stamped.height,
    tiles,
    props: grid.props.map(absolute),
    entities: grid.entities.map(absolute),
  };
}

// Nearest districts first. A fixed global candidate order makes quotas independent of chunk visits.
export function planEncounters(
  seed: number,
  read: RoadReader,
  templates = encounterTemplates,
) {
  const placed: PlacedEncounter[] = [];
  const counts = new Map<string, number>();
  const districts = [];
  for (let dy = -10; dy <= 10; dy++)
    for (let dx = -10; dx <= 10; dx++)
      if (dx || dy)
        districts.push({
          dx,
          dy,
          rank: dx * dx + dy * dy + seededValue(seed, dx, dy, 801),
        });
  districts.sort((a, b) => a.rank - b.rank);
  for (const { dx, dy } of districts) {
    if (templates.every((t) => (counts.get(t.id) ?? 0) >= t.maxCountPerWorld))
      break;
    const hx = districtOffset(seed, dx, dy, 201);
    const hy = districtOffset(seed, dx, dy, 202);
    const x = dx * SIDE + hx;
    const y = dy * SIDE + hy;
    const c = sampleClimate(seed, x, y, SURVIVAL_CAMP);
    const biome = climateBiome(c.elevation, c.temperature, c.moisture);
    const options = templates.filter(
      (t) =>
        (counts.get(t.id) ?? 0) < t.maxCountPerWorld &&
        t.allowedBiomes.includes(biome) &&
        placed.every(
          (p) =>
            Math.hypot(x - p.x, y - p.y) >=
            Math.max(16, p.templateId === t.id ? t.minSpacingSameId : 0),
        ),
    );
    let attempt = 0;
    while (options.length && attempt < 4) {
      let roll =
        seededValue(seed, dx, dy, 810 + attempt++) *
        options.reduce((n, t) => n + t.weight, 0);
      const idx = options.findIndex((t) => {
        roll -= t.weight;
        return roll < 0;
      });
      const [choice] = options.splice(idx < 0 ? options.length - 1 : idx, 1);
      const p = place(seed, dx, dy, hx, hy, choice, read);
      if (!p) continue;
      placed.push(p);
      counts.set(choice.id, (counts.get(choice.id) ?? 0) + 1);
      break;
    }
  }
  const missed = templates.filter(
    (t) => (counts.get(t.id) ?? 0) < t.maxCountPerWorld,
  );
  if (missed.length)
    console.warn(
      "奇遇投放达到候选区上限，跳过剩余名额",
      seed,
      missed.map((t) => t.id),
    );
  return placed;
}
