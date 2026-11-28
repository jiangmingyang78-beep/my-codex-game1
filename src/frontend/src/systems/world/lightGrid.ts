import { VisibilityMask } from "./fovShadowcast";

const tileKey = (x: number, y: number) => y * 0x100000 + x;
const MAX_FREE_CELLS = 2048;

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

interface TrackedLight extends LightSource {
  next?: LightSource;
  stamped: boolean;
}

interface LightCell {
  tx: number;
  ty: number;
  contributions: Map<string, number>;
  level: number;
}

/** Sparse tile grid. Sky is uniform outdoors, so changing weather costs one write. */
export class LightGrid {
  private sky = 15;
  private readonly sources = new Map<string, TrackedLight>();
  private readonly cells = new Map<number, LightCell>();
  private readonly freeCells: LightCell[] = [];

  private readonly elementalSources = new Map<string, TrackedLight>();
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
    this.syncSources(this.elementalSources, grid.lights);
    this.elementOwner = grid;
    this.elementRevision = grid.lightRevision;
  }
  revision = 0;
  private readonly chunkVersions = new Map<number, number>();
  private resetRevision = 0;
  viewRevision(x: number, y: number, width: number, height: number) {
    const span = this.tileSize * 16;
    let revision = this.resetRevision;
    for (
      let cy = Math.floor(y / span);
      cy < Math.ceil((y + height) / span);
      cy++
    )
      for (
        let cx = Math.floor(x / span);
        cx < Math.ceil((x + width) / span);
        cx++
      )
        revision = Math.max(
          revision,
          this.chunkVersions.get(tileKey(cx, cy)) ?? 0,
        );
    return revision;
  }
  private geometry = -1;
  private masks = new Map<string, VisibilityMask>();
  constructor(
    readonly tileSize: number,
    private readonly opaque?: (x: number, y: number) => boolean,
  ) {}
  invalidate(revision: number) {
    if (revision === this.geometry) return;
    this.geometry = revision;
    this.chunkVersions.clear();
    this.resetRevision = ++this.revision;
    for (const cell of this.cells.values()) this.recycleCell(cell);
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
    this.syncSources(this.sources, sources, true);
  }

  private syncSources(
    active: Map<string, TrackedLight>,
    incoming: Iterable<LightSource>,
    requirePositiveRadius = false,
  ) {
    // Stage borrowed inputs so the last eligible occurrence of each ID wins.
    for (const source of incoming) {
      if (requirePositiveRadius && !(source.radius > 0)) continue;
      const slot = active.get(source.id);
      if (slot) slot.next = source;
      else
        active.set(source.id, {
          id: source.id,
          x: source.x,
          y: source.y,
          radius: source.radius,
          next: source,
          stamped: false,
        });
    }
    for (const slot of active.values()) {
      const next = slot.next;
      slot.next = undefined;
      if (!next) {
        this.stamp(slot, false);
        this.masks.delete(slot.id);
        active.delete(slot.id);
      } else if (!slot.stamped || !this.same(slot, next)) {
        if (slot.stamped) this.stamp(slot, false);
        slot.x = next.x;
        slot.y = next.y;
        slot.radius = next.radius;
        this.stamp(slot, true);
        slot.stamped = true;
      }
    }
  }

  private same(a: LightSource, b: LightSource) {
    return a.x === b.x && a.y === b.y && a.radius === b.radius;
  }

  private recycleCell(cell: LightCell) {
    if (this.freeCells.length >= MAX_FREE_CELLS) return;
    cell.contributions.clear();
    this.freeCells.push(cell);
  }

  private stamp(s: LightSource, add: boolean) {
    const size = this.tileSize;
    // Two weak spill levels beyond the visible fire edge still deter shadows.
    const reach = s.radius + size;
    this.revision++;
    if (this.chunkVersions.size > 4096) {
      this.chunkVersions.clear();
      this.resetRevision = this.revision;
    }
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
        let cell = this.cells.get(key);
        if (!cell) {
          if (!add) continue;
          cell = this.freeCells.pop() ?? {
            tx,
            ty,
            contributions: new Map(),
            level: 0,
          };
          cell.tx = tx;
          cell.ty = ty;
          cell.level = 0;
          this.cells.set(key, cell);
        }
        const previous = cell.level;
        // The last visible tile is safe even for ordinary night enemies (threshold 2).
        if (add)
          cell.contributions.set(
            s.id,
            distance <= s.radius
              ? 3 + Math.round(12 * (1 - distance / s.radius))
              : Math.ceil((2 * (reach - distance)) / size),
          );
        else cell.contributions.delete(s.id);
        cell.level = 0;
        for (const value of cell.contributions.values())
          cell.level = Math.max(cell.level, value);
        if (!cell.contributions.size) {
          this.cells.delete(key);
          this.recycleCell(cell);
        }
        if (previous !== cell.level)
          this.chunkVersions.set(
            tileKey(Math.floor(tx / 16), Math.floor(ty / 16)),
            this.revision,
          );
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
    const size = this.tileSize;
    return (
      this.sky > rule.maxSky ||
      this.blockAt(Math.floor(x / size), Math.floor(y / size)) > rule.maxBlock
    );
  }
}
