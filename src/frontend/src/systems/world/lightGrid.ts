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
    string,
    { contributions: Map<string, number>; level: number }
  >();

  constructor(readonly tileSize: number) {}

  sync(sky: number, sources: readonly LightSource[]) {
    this.sky = Math.max(0, Math.min(15, Math.round(sky)));
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
    this.sources = next;
  }

  private same(a: LightSource, b: LightSource) {
    return a.x === b.x && a.y === b.y && a.radius === b.radius;
  }

  private stamp(s: LightSource, add: boolean) {
    const size = this.tileSize;
    // Two weak spill levels beyond the visible fire edge still deter shadows.
    const reach = s.radius + size;
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
        if (distance >= reach) continue;
        const key = `${tx},${ty}`;
        const cell = this.cells.get(key) ?? {
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
    const key = `${Math.floor(x / this.tileSize)},${Math.floor(y / this.tileSize)}`;
    const block = this.cells.get(key)?.level ?? 0;
    return { sky: this.sky, block, effective: Math.max(this.sky, block) };
  }

  forEachLitTile(
    view: { x: number; y: number; width: number; height: number },
    visit: (x: number, y: number, level: number) => void,
  ) {
    const size = this.tileSize;
    if ((view.width * view.height) / (size * size) > this.cells.size) {
      for (const [key, cell] of this.cells) {
        const [tx, ty] = key.split(",").map(Number);
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
        const level = this.getLightLevel(x, y).block;
        if (level) visit(x, y, level);
      }
  }

  isSafeFromSpawn(x: number, y: number, rule: LightRule) {
    const light = this.getLightLevel(x, y);
    return light.sky > rule.maxSky || light.block > rule.maxBlock;
  }
}
