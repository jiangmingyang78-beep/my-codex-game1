import type { PlacedEncounter } from "./encounterPlan";
import { WORLD_MAX, WORLD_MIN } from "./survivalBiomes";
import { seededValue } from "./survivalNoise";

export const landmarkKinds = {
  mine: {
    name: "Mine",
    color: "#ffd482",
    pixels: ["..##.", ".####", "##.##", ".###.", "..#.."],
  },
  crossing: {
    name: "The ferry",
    color: "#9ee4ff",
    pixels: [".#.#.", "#####", ".#.#.", "#####", ".#.#."],
  },
  shelter: {
    name: "Temporary camp",
    color: "#f9a488",
    pixels: ["..#..", ".###.", ".###.", "##.##", "#####"],
  },
};

type Point = { x: number; y: number };
export type Landmark = Point & { kind: keyof typeof landmarkKinds };

export const CAMP_LANDMARK = "camp";
export const landmarkId = ({ x, y }: Point) => `${x},${y}`;

export function normalizeLandmarks(saved: unknown): Landmark[] {
  if (!Array.isArray(saved)) return [];
  const landmarks = new Map<string, Landmark>();
  for (const entry of saved) {
    if (
      !entry ||
      typeof entry.kind !== "string" ||
      !Object.hasOwn(landmarkKinds, entry.kind)
    )
      continue;
    const { x, y, kind } = entry;
    if (
      ![x, y].every(
        (value) =>
          Number.isInteger(value) && value >= WORLD_MIN && value < WORLD_MAX,
      )
    )
      continue;
    const landmark: Landmark = { x, y, kind };
    landmarks.set(landmarkId(landmark), landmark);
  }
  return [...landmarks.values()];
}

const directions = [
  "East",
  "Southeast",
  "South",
  "Southwest",
  "West",
  "Northwest",
  "North",
  "Northeast",
];

export function landmarkBearing(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.ceil(Math.hypot(dx, dy));
  const direction =
    directions[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  return { distance, direction };
}

export function landmarkEdge(
  from: Point,
  to: Point,
  width: number,
  height: number,
  padding: number,
) {
  if (to.x >= 0 && to.x < width && to.y >= 0 && to.y < height) return null;
  const x = Math.max(padding, Math.min(width - padding, from.x));
  const y = Math.max(padding, Math.min(height - padding, from.y));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const tx =
    dx === 0
      ? Number.POSITIVE_INFINITY
      : ((dx > 0 ? width - padding : padding) - x) / dx;
  const ty =
    dy === 0
      ? Number.POSITIVE_INFINITY
      : ((dy > 0 ? height - padding : padding) - y) / dy;
  const t = Math.min(tx, ty);
  return { x: x + dx * t, y: y + dy * t, angle: Math.atan2(dy, dx) };
}

export interface EncounterProgress {
  discovered: string[];
  spent: string[];
}
export function discoverEncounter(
  progress: EncounterProgress,
  site: PlacedEncounter,
  player: Point,
) {
  if (
    Math.hypot(site.x - player.x, site.y - player.y) > 6 ||
    progress.discovered.includes(site.id)
  )
    return false;
  progress.discovered.push(site.id);
  return true;
}
export function activateEncounter(
  progress: EncounterProgress,
  site: PlacedEncounter,
  seed: number,
) {
  if (
    !progress.discovered.includes(site.id) ||
    progress.spent.includes(site.id)
  )
    return null;
  progress.spent.push(site.id);
  const loot: Record<string, number> = {};
  site.trigger.loot.forEach((e, i) => {
    if (seededValue(seed, site.x, site.y, 912 + i) < e.probability)
      loot[e.itemId] = (loot[e.itemId] ?? 0) + e.count;
  });
  return { event: site.trigger.event, loot };
}
