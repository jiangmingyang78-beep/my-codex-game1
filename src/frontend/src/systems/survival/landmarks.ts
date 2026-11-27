import { WORLD_MAX, WORLD_MIN } from "./survivalBiomes";

export const landmarkKinds = {
  mine: {
    name: "矿点",
    color: "#ffd482",
    pixels: ["..##.", ".####", "##.##", ".###.", "..#.."],
  },
  crossing: {
    name: "渡口",
    color: "#9ee4ff",
    pixels: [".#.#.", "#####", ".#.#.", "#####", ".#.#."],
  },
  shelter: {
    name: "临时营地",
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

const directions = ["东", "东南", "南", "西南", "西", "西北", "北", "东北"];

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
