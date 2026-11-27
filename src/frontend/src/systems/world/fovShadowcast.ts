type TilePredicate = (x: number, y: number) => boolean;
const octants = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

/** Tile coordinates. Opaque faces receive light, cells behind them do not. */
export class VisibilityMask {
  readonly radius: number;
  private readonly side: number;
  private readonly cells: Uint8Array;
  private x = 0;
  private y = 0;
  constructor(radius: number) {
    this.radius = Math.ceil(radius);
    this.side = this.radius * 2 + 1;
    this.cells = new Uint8Array(this.side ** 2);
  }
  has(x: number, y: number) {
    const dx = x - this.x + this.radius;
    const dy = y - this.y + this.radius;
    return (
      dx >= 0 &&
      dy >= 0 &&
      dx < this.side &&
      dy < this.side &&
      this.cells[dy * this.side + dx] === 1
    );
  }
  compute(x: number, y: number, opaque: TilePredicate) {
    this.x = x;
    this.y = y;
    this.cells.fill(0);
    const r = this.radius;
    const side = this.side;
    const cells = this.cells;
    cells[r * side + r] = 1;
    function cast(
      row: number,
      startSlope: number,
      end: number,
      xx: number,
      xy: number,
      yx: number,
      yy: number,
    ) {
      let start = startSlope;
      if (start < end) return;
      for (let depth = row; depth <= r; depth++) {
        let blocked = false;
        let next = start;
        for (let col = -depth; col <= 0; col++) {
          const left = (col - 0.5) / (-depth + 0.5);
          const right = (col + 0.5) / (-depth - 0.5);
          if (right > start) continue;
          if (left < end) break;
          const dx = col * xx - depth * xy;
          const dy = col * yx - depth * yy;
          if (dx * dx + dy * dy <= r * r) cells[(dy + r) * side + dx + r] = 1;
          const wall = opaque(x + dx, y + dy);
          if (blocked) {
            if (wall) {
              next = right;
              continue;
            }
            blocked = false;
            start = next;
          } else if (wall) {
            cast(depth + 1, start, left, xx, xy, yx, yy);
            blocked = true;
            next = right;
          }
        }
        if (blocked) break;
      }
    }
    for (const [xx, xy, yx, yy] of octants) cast(1, 1, 0, xx, xy, yx, yy);
    return this;
  }
}
