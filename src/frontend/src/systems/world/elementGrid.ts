import { makeEvent } from "@/core/events";
import { nextRandom } from "@/core/rng";
import type { GameEvent } from "@/core/types";
import config from "@/data/elements.json";
import type { LightSource } from "./lightGrid";

export interface ElementTerrain {
  fireproof(x: number, y: number): boolean;
  flammable(x: number, y: number): boolean;
  snowy(x: number, y: number): boolean;
}
export interface ElementWeather {
  fireDecay: number;
  spreadMult: number;
  snowfall: number;
}
interface Tile {
  x: number;
  y: number;
  burning: number;
  intensity: number;
  depth: number;
  ignitedStep: number;
  heatedStep: number;
  scorched: number;
  meltedSnow: number;
  frostZone: number;
}
export const neighbors = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
export const elementalRules = config;
const key = (x: number, y: number) => `${x},${y}`;
const appearance = (t: Tile) =>
  t.burning
    ? "burning"
    : t.scorched
      ? "scorched"
      : t.frostZone
        ? "frost"
        : t.meltedSnow > 0
          ? "melted"
          : "clear";

/** World coordinates here are tile indices, including negative survival chunk coordinates. */
export class ElementGrid {
  private cells = new Map<string, Tile>();
  private fires = new Map<string, LightSource>();
  private dynamic = new Set<Tile>();
  private generation = 0;
  private remainder = 0;
  private rng: number;
  constructor(
    readonly tileSize: number,
    seed = 0,
  ) {
    this.rng = seed >>> 0;
  }
  lightRevision = 0;
  get size() {
    return this.cells.size;
  }
  get lights() {
    return this.fires.values();
  }
  at(x: number, y: number) {
    return this.cells.get(key(x, y));
  }
  private cell(x: number, y: number) {
    const id = key(x, y);
    let t = this.cells.get(id);
    if (
      !t &&
      Number.isSafeInteger(x) &&
      Number.isSafeInteger(y) &&
      this.size < config.maxChangedTiles
    ) {
      t = {
        x,
        y,
        burning: 0,
        intensity: 0,
        depth: 0,
        ignitedStep: -1,
        heatedStep: -1,
        scorched: 0,
        meltedSnow: 0,
        frostZone: 0,
      };
      this.cells.set(id, t);
    }
    return t;
  }
  private event(type: string, t: Tile, events: GameEvent[]) {
    events.push(
      makeEvent(
        type,
        (t.x + 0.5) * this.tileSize,
        (t.y + 0.5) * this.tileSize,
        { surface: appearance(t), tx: t.x, ty: t.y },
      ),
    );
  }
  replay(events: GameEvent[]) {
    for (const t of this.cells.values())
      this.event("element.changed", t, events);
  }
  ignite(
    x: number,
    y: number,
    terrain: ElementTerrain,
    events: GameEvent[],
    depth = 0,
  ) {
    if (
      this.fires.size >= config.maxActiveFireTiles ||
      depth > config.maxSpreadSteps ||
      terrain.fireproof(x, y)
    )
      return false;
    const t = this.cell(x, y);
    if (!t || t.burning || t.scorched) return false;
    t.ignitedStep = this.generation;
    this.dynamic.add(t);
    t.depth = depth;
    t.intensity = 1 - depth / (config.maxSpreadSteps + 2);
    t.burning = config.burnSec * t.intensity;
    t.frostZone = 0;
    const id = key(x, y);
    this.lightRevision++;
    this.fires.set(id, {
      id: `element:${id}`,
      x: (x + 0.5) * this.tileSize,
      y: (y + 0.5) * this.tileSize,
      radius: this.tileSize * config.lightRadiusTiles * t.intensity,
    });
    this.event("element.changed", t, events);
    return true;
  }
  freeze(x: number, y: number, terrain: ElementTerrain, events: GameEvent[]) {
    if (terrain.fireproof(x, y)) return;
    const t = this.cell(x, y);
    if (!t || t.burning || t.scorched) return;
    this.dynamic.add(t);
    if (!t.frostZone) {
      t.frostZone = config.frostSec;
      this.event("element.changed", t, events);
    } else t.frostZone = config.frostSec;
  }
  speed(tx: number, ty: number, base: number, snowDepth: number) {
    const melted = this.size && this.at(tx, ty)?.meltedSnow;
    return melted
      ? (base * (1 - 0.3 * snowDepth * (1 - melted))) / (1 - 0.3 * snowDepth)
      : base;
  }
  advance(
    dt: number,
    climate: ElementWeather | (() => ElementWeather),
    terrain: ElementTerrain,
    events: GameEvent[],
    afterTick?: () => void,
  ) {
    if (!this.size || !Number.isFinite(dt) || dt <= 0) return;
    this.remainder += dt;
    if (this.remainder < config.stepSec) return;
    const weather = typeof climate === "function" ? climate() : climate;
    if (!this.dynamic.size && !weather.snowfall) {
      this.remainder %= config.stepSec;
      return;
    }
    while (this.remainder >= config.stepSec && this.size) {
      this.remainder -= config.stepSec;
      // New ignitions first propagate on the next fixed step.
      this.generation++;
      const active = weather.snowfall
        ? this.cells.values()
        : this.dynamic.values();
      for (const t of [...active]) {
        if (t.ignitedStep !== this.generation)
          this.step(t, weather, terrain, events);
      }
      afterTick?.();
    }
    if (!this.size) this.remainder = 0;
  }
  private melt(
    x: number,
    y: number,
    terrain: ElementTerrain,
    events: GameEvent[],
  ) {
    if (!terrain.snowy(x, y)) return;
    const t = this.cell(x, y);
    if (!t) return;
    t.heatedStep = this.generation;
    if (t.meltedSnow === 1 && !t.frostZone) return;
    const before = appearance(t);
    if (t.meltedSnow === 0) this.event("element.steam", t, events);
    t.meltedSnow = 1;
    t.frostZone = 0;
    if (before !== appearance(t)) this.event("element.changed", t, events);
  }
  private step(
    t: Tile,
    w: ElementWeather,
    terrain: ElementTerrain,
    events: GameEvent[],
  ) {
    const dt = config.stepSec;
    const before = appearance(t);
    if (t.burning) {
      t.burning = Math.max(0, t.burning - dt * w.fireDecay);
      if (!t.burning) {
        this.lightRevision++;
        this.fires.delete(key(t.x, t.y));
        t.scorched = config.emberSec;
        t.intensity = 0;
      } else {
        this.melt(t.x, t.y, terrain, events);
        for (const [dx, dy] of neighbors) {
          const x = t.x + dx;
          const y = t.y + dy;
          this.melt(x, y, terrain, events);
          if (
            t.depth >= config.maxSpreadSteps ||
            this.fires.size >= config.maxActiveFireTiles ||
            !terrain.flammable(x, y)
          )
            continue;
          const roll = nextRandom(this.rng);
          this.rng = roll.state;
          if (roll.value < config.spreadChance * w.spreadMult * t.intensity)
            this.ignite(x, y, terrain, events, t.depth + 1);
        }
      }
    } else {
      t.scorched = Math.max(0, t.scorched - dt);
      t.frostZone = Math.max(0, t.frostZone - dt);
      if (!t.scorched && t.heatedStep !== this.generation)
        t.meltedSnow = Math.max(0, t.meltedSnow - w.snowfall * dt);
    }
    if (before !== appearance(t)) this.event("element.changed", t, events);
    if (!t.burning && !t.scorched && !t.frostZone) this.dynamic.delete(t);
    if (appearance(t) === "clear") this.cells.delete(key(t.x, t.y));
  }
  // Reload is a cold start: a burning tile leaves warm embers and no propagating front.
  toJSON() {
    return Array.from(this.cells.values(), (t) => [
      t.x,
      t.y,
      t.burning ? config.emberSec : t.scorched,
      t.meltedSnow,
      t.frostZone,
    ]);
  }
  static restore(raw: unknown, tileSize: number, seed: number) {
    const grid = new ElementGrid(tileSize, seed);
    if (Array.isArray(raw))
      for (const row of raw.slice(0, config.maxChangedTiles)) {
        if (
          !Array.isArray(row) ||
          row.length !== 5 ||
          !row.every(Number.isFinite)
        )
          continue;
        const [x, y, embers, melt, frost] = row;
        if (embers <= 0 && melt <= 0 && frost <= 0) continue;
        const t = grid.cell(x, y);
        if (t) {
          t.scorched = Math.max(0, Math.min(config.emberSec, embers));
          t.meltedSnow = Math.max(0, Math.min(1, melt));
          t.frostZone = t.scorched
            ? 0
            : Math.max(0, Math.min(config.frostSec, frost));
          if (t.scorched || t.frostZone) grid.dynamic.add(t);
        }
      }
    return grid;
  }
}
