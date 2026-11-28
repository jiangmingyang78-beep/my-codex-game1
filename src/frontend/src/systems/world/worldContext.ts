import type { GameEvent } from "@/core/types";
import {
  type Mob,
  type SpawnSettings,
  type View,
  categoryOf,
  hasCapacity,
  inRing,
  spawnLightAllowed,
  spawnRadii,
} from "../combat/spawnRules";
import type { ElementGrid, ElementTerrain } from "./elementGrid";
import { FlowField } from "./flowField";
import { VisibilityMask } from "./fovShadowcast";
import type { LightGrid } from "./lightGrid";
type Point = { x: number; y: number };
export interface WorldAdapter {
  tuning: { brightCost: number; fireCost: number; hearingTiles: number };
  tileSize: number;
  solid(x: number, y: number): boolean;
  opaque(x: number, y: number): boolean;
  light: LightGrid;
  elements: ElementGrid;
  terrain: ElementTerrain;
}
export interface IWorldContext extends WorldAdapter {
  flow: FlowField;
  prepare(hero: Point, geometry: number): void;
  steer(actor: Point, dx: number, dy: number, out: Point): Point;
  clearCrowd(): void;
  addActor(actor: Point): void;
  visible(x: number, y: number): boolean;
  senses(observer: Point, target: Point): boolean;
  ignite(x: number, y: number, events: GameEvent[]): boolean;
  freeze(x: number, y: number, events: GameEvent[]): void;
}
export interface ISpawnDirector {
  readonly ring: ReturnType<typeof spawnRadii>;
  hasRoom(id: string, boss?: boolean): boolean;
  allowsLocation(at: Point, id: string): boolean;
  accepts(at: Point, id: string, boss?: boolean): boolean;
}
/** Snapshot the shared ring and light rules once per spawn attempt batch. */
export function spawnDirector(
  grid: LightGrid,
  center: Point,
  settings: SpawnSettings,
  view: View | undefined,
  mobs: Iterable<Mob>,
  clear: (at: Point) => boolean,
): ISpawnDirector {
  const ring = spawnRadii(settings, grid.tileSize, view);
  const hasRoom = (id: string, boss = false) =>
    boss || hasCapacity(mobs, categoryOf(id), settings);
  const allowsLocation = (at: Point, id: string) =>
    inRing(at, center, ring, view) &&
    clear(at) &&
    spawnLightAllowed(grid, at, id);
  return {
    ring,
    hasRoom,
    allowsLocation,
    accepts: (at, id, boss) => hasRoom(id, boss) && allowsLocation(at, id),
  };
}

export class WorldContext implements IWorldContext {
  readonly flow = new FlowField();
  private sight = new VisibilityMask(24);
  private observerSight = new VisibilityMask(24);
  private observerX = Number.NaN;
  private observerY = Number.NaN;
  private cx = Number.NaN;
  private cy = Number.NaN;
  private geometry = -1;
  private lightStamp = -1;
  private fireStamp = -1;
  private bright = -1;
  private fire = -1;
  private dirty = true;
  private count = new Uint16Array(32 * 32);
  private sumX = new Float64Array(32 * 32);
  private sumY = new Float64Array(32 * 32);
  clearCrowd() {
    this.count.fill(0);
    this.sumX.fill(0);
    this.sumY.fill(0);
  }
  addActor(actor: Point) {
    const x = Math.floor(actor.x / this.tileSize) - this.cx + 16;
    const y = Math.floor(actor.y / this.tileSize) - this.cy + 16;
    if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
    const i = y * 32 + x;
    this.count[i]++;
    this.sumX[i] += actor.x;
    this.sumY[i] += actor.y;
  }
  private separate(
    actor: Point & { id?: string | number },
    out: Point,
    step: number,
  ) {
    const size = this.tileSize;
    const x = Math.floor(actor.x / size) - this.cx + 16;
    const y = Math.floor(actor.y / size) - this.cy + 16;
    let sx = 0;
    let sy = 0;
    for (let row = Math.max(0, y - 1); row <= Math.min(31, y + 1); row++)
      for (let col = Math.max(0, x - 1); col <= Math.min(31, x + 1); col++) {
        const i = row * 32 + col;
        const n = this.count[i];
        if (!n) continue;
        const dx = actor.x - this.sumX[i] / n;
        const dy = actor.y - this.sumY[i] / n;
        const d = Math.hypot(dx, dy);
        if (d < 0.01 && n > 1 && actor.id !== undefined) {
          // Coincident centres need a stable tie break before separation has a direction.
          const id = String(actor.id);
          let hash = 0;
          for (let k = 0; k < id.length; k++)
            hash = (Math.imul(hash, 31) + id.charCodeAt(k)) | 0;
          const angle = hash * 2.399963229728653;
          sx += Math.cos(angle);
          sy += Math.sin(angle);
        }
        if (d > 0.01 && d < size * 0.85) {
          const w = (1 - d / (size * 0.85)) / d;
          sx += dx * w;
          sy += dy * w;
        }
      }
    const scale = (step * 0.28) / Math.max(1, Math.hypot(sx, sy));
    // Limit lateral drift in single-tile passages before collision sliding.
    const nx = actor.x + out.x + sx * scale;
    const ny = actor.y + out.y + sy * scale;
    const radius = size * 0.375;
    if (
      sx &&
      !this.solid(
        Math.floor((nx + Math.sign(sx) * radius) / size),
        Math.floor(actor.y / size),
      )
    )
      out.x += sx * scale;
    if (
      sy &&
      !this.solid(
        Math.floor(actor.x / size),
        Math.floor((ny + Math.sign(sy) * radius) / size),
      )
    )
      out.y += sy * scale;
  }
  private next = { x: 0, y: 0 };
  constructor(private readonly map: WorldAdapter) {}
  get tuning() {
    return this.map.tuning;
  }
  get tileSize() {
    return this.map.tileSize;
  }
  get terrain() {
    return this.map.terrain;
  }
  ignite(x: number, y: number, events: GameEvent[]) {
    return this.elements.ignite(x, y, this.terrain, events);
  }
  freeze(x: number, y: number, events: GameEvent[]) {
    this.elements.freeze(x, y, this.terrain, events);
  }
  get elements() {
    return this.map.elements;
  }
  get light() {
    return this.map.light;
  }
  solid(x: number, y: number) {
    return this.map.solid(x, y);
  }
  opaque(x: number, y: number) {
    return this.map.opaque(x, y);
  }
  prepare(hero: Point, geometry: number) {
    const x = Math.floor(hero.x / this.tileSize);
    const y = Math.floor(hero.y / this.tileSize);
    if (x !== this.cx || y !== this.cy || this.geometry !== geometry) {
      if (this.geometry !== geometry) this.observerX = Number.NaN;
      this.cx = x;
      this.cy = y;
      this.geometry = geometry;
      this.sight.compute(x, y, this.map.opaque);
      this.dirty = true;
    }
  }
  visible(x: number, y: number) {
    return this.sight.has(x, y);
  }
  senses(observer: Point, target: Point) {
    const size = this.tileSize;
    if (
      Math.hypot(observer.x - target.x, observer.y - target.y) <=
      this.tuning.hearingTiles * size
    )
      return true;
    const x = Math.floor(target.x / size);
    const y = Math.floor(target.y / size);
    const ox = Math.floor(observer.x / size);
    const oy = Math.floor(observer.y / size);
    if (x === this.cx && y === this.cy) return this.visible(ox, oy);
    if (ox !== this.observerX || oy !== this.observerY) {
      this.observerX = ox;
      this.observerY = oy;
      this.observerSight.compute(ox, oy, this.map.opaque);
    }
    return this.observerSight.has(x, y);
  }
  private readonly cost = (x: number, y: number) =>
    this.map.solid(x, y)
      ? 0
      : 1 +
        (this.light.blockAt(x, y) >= 10 ? this.tuning.brightCost : 0) +
        (this.elements.size && this.elements.at(x, y)?.burning
          ? this.tuning.fireCost
          : 0);
  /** Write displacement in pixels. Align before turning to accommodate actor radius. */
  steer(actor: Point, dx: number, dy: number, out: Point) {
    out.x = dx;
    out.y = dy;
    if (
      this.dirty ||
      this.lightStamp !== this.light.revision ||
      this.fireStamp !== this.elements.lightRevision ||
      this.bright !== this.tuning.brightCost ||
      this.fire !== this.tuning.fireCost
    ) {
      this.flow.update(this.cx, this.cy, this.cost);
      this.lightStamp = this.light.revision;
      this.fireStamp = this.elements.lightRevision;
      this.bright = this.tuning.brightCost;
      this.fire = this.tuning.fireCost;
      this.dirty = false;
    }
    const size = this.tileSize;
    const x = Math.floor(actor.x / size);
    const y = Math.floor(actor.y / size);
    if (!this.flow.step(x, y, this.next)) return out;
    const cx = (x + 0.5) * size;
    const cy = (y + 0.5) * size;
    let ax = (this.next.x + 0.5) * size - actor.x;
    let ay = (this.next.y + 0.5) * size - actor.y;
    if (this.next.y === y && Math.abs(cy - actor.y) > size * 0.12) ax = 0;
    if (this.next.x === x && Math.abs(cx - actor.x) > size * 0.12) ay = 0;
    const scale = Math.min(1, Math.hypot(dx, dy) / (Math.hypot(ax, ay) || 1));
    out.x = ax * scale;
    out.y = ay * scale;
    this.separate(actor, out, Math.hypot(out.x, out.y));
    return out;
  }
}
