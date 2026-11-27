import { VisibilityMask } from "./fovShadowcast";
const tileKey = (x: number, y: number) => y * 0x100000 + x;
export interface LightSource {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface LightRule {
  maxSky: number;
  maxBlock: number;
}

/** Sparse tile grid. Sky is uniform outdoors, so changing weather costs one write. */
export class LightGrid {
  private sky = 15;
  private sources = new Map<string, LightSource>();
  private cells = new Map<
    number,
    {
      tx: number;
      ty: number;
      contributions: Map<string, number>;
      level: number;
    }
  >();

  private elementalSources = new Map<string, LightSource>();
  private elementOwner?: object;
  private elementRevision = -1;

  /** Element lights change only at ignition and extinction. Normal light sync leaves these stamps intact. */
  syncElements(grid: {
    lightRevision: number;
    readonly lights: Iterable<LightSource>;
  }) {
    if (
      grid === this.elementOwner &&
      grid.lightRevision === this.elementRevision
    )
      return;
    const next = new Map(Array.from(grid.lights, (s) => [s.id, s] as const));
    for (const [id, old] of this.elementalSources)
      if (next.get(id) !== old) this.stamp(old, false);
    for (const [id, s] of next)
      if (this.elementalSources.get(id) !== s) this.stamp(s, true);
    for (const id of this.elementalSources.keys())
      if (!next.has(id)) this.masks.delete(id);
    this.elementalSources = next;
    this.elementOwner = grid;
    this.elementRevision = grid.lightRevision;
  }
  revision = 0;
  private geometry = -1;
  private masks = new Map<string, VisibilityMask>();
  constructor(
    readonly tileSize: number,
    private readonly opaque?: (x: number, y: number) => boolean,
  ) {}
  invalidate(revision: number) {
    if (revision === this.geometry) return;
    this.geometry = revision;
    this.cells.clear();
    this.masks.clear();
    for (const source of this.sources.values()) this.stamp(source, true);
    for (const source of this.elementalSources.values())
      this.stamp(source, true);
    this.revision++;
  }
  sourceVisible(id: string, x: number, y: number) {
    return this.masks.get(id)?.has(x, y) ?? !this.opaque;
  }
  blockAt(x: number, y: number) {
    return this.cells.get(tileKey(x, y))?.level ?? 0;
  }

  sync(sky: number, sources: readonly LightSource[]) {
    this.sky = Math.max(0, Math.min(15, Math.round(sky)));
    let count = 0;
    let unchanged = true;
    for (const source of sources) {
      if (!(source.radius > 0)) continue;
      count++;
      const old = this.sources.get(source.id);
      if (!old || !this.same(old, source)) unchanged = false;
    }
    if (unchanged && count === this.sources.size) return;
    const next = new Map(
      sources.filter((s) => s.radius > 0).map((s) => [s.id, { ...s }] as const),
    );
    for (const [id, old] of this.sources) {
      const source = next.get(id);
      if (!source || !this.same(old, source)) this.stamp(old, false);
    }
    for (const [id, source] of next) {
      const old = this.sources.get(id);
      if (!old || !this.same(old, source)) this.stamp(source, true);
    }
    for (const id of this.sources.keys())
      if (!next.has(id)) this.masks.delete(id);
    this.sources = next;
  }

  private same(a: LightSource, b: LightSource) {
    return a.x === b.x && a.y === b.y && a.radius === b.radius;
  }

  private stamp(s: LightSource, add: boolean) {
    const size = this.tileSize;
    // Two weak spill levels beyond the visible fire edge still deter shadows.
    const reach = s.radius + size;
    this.revision++;
    let mask = this.masks.get(s.id);
    if (add && this.opaque) {
      const radius = Math.ceil(reach / size) + 1;
      if (!mask || mask.radius !== radius) mask = new VisibilityMask(radius);
      mask.compute(Math.floor(s.x / size), Math.floor(s.y / size), this.opaque);
      this.masks.set(s.id, mask);
    }
    for (
      let ty = Math.floor((s.y - reach) / size);
      ty <= Math.floor((s.y + reach) / size);
      ty++
    ) {
      for (
        let tx = Math.floor((s.x - reach) / size);
        tx <= Math.floor((s.x + reach) / size);
        tx++
      ) {
        const distance = Math.hypot(
          (tx + 0.5) * size - s.x,
          (ty + 0.5) * size - s.y,
        );
        if (distance >= reach || (add && mask && !mask.has(tx, ty))) continue;
        const key = tileKey(tx, ty);
        if (!add && !this.cells.has(key)) continue;
        const cell = this.cells.get(key) ?? {
          tx,
          ty,
          contributions: new Map<string, number>(),
          level: 0,
        };
        // The last visible tile is safe even for ordinary night enemies (threshold 2).
        if (add)
          cell.contributions.set(
            s.id,
            distance <= s.radius
              ? 3 + Math.round(12 * (1 - distance / s.radius))
              : Math.ceil((2 * (reach - distance)) / size),
          );
        else cell.contributions.delete(s.id);
        if (!cell.contributions.size) this.cells.delete(key);
        else {
          cell.level = 0;
          for (const value of cell.contributions.values())
            cell.level = Math.max(cell.level, value);
          this.cells.set(key, cell);
        }
      }
    }
  }

  getLightLevel(x: number, y: number) {
    const block = this.blockAt(
      Math.floor(x / this.tileSize),
      Math.floor(y / this.tileSize),
    );
    return { sky: this.sky, block, effective: Math.max(this.sky, block) };
  }

  forEachLitTile(
    view: { x: number; y: number; width: number; height: number },
    visit: (x: number, y: number, level: number) => void,
  ) {
    const size = this.tileSize;
    if ((view.width * view.height) / (size * size) > this.cells.size) {
      for (const cell of this.cells.values()) {
        const { tx, ty } = cell;
        const x = tx * size;
        const y = ty * size;
        if (
          x + size > view.x &&
          y + size > view.y &&
          x < view.x + view.width &&
          y < view.y + view.height
        )
          visit(x, y, cell.level);
      }
      return;
    }
    for (
      let y = Math.floor(view.y / size) * size;
      y < view.y + view.height;
      y += size
    )
      for (
        let x = Math.floor(view.x / size) * size;
        x < view.x + view.width;
        x += size
      ) {
        const level = this.blockAt(x / size, y / size);
        if (level) visit(x, y, level);
      }
  }

  isSafeFromSpawn(x: number, y: number, rule: LightRule) {
    const light = this.getLightLevel(x, y);
    return light.sky > rule.maxSky || light.block > rule.maxBlock;
  }
}
