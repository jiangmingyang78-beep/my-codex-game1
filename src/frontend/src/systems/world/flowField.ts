type TravelCost = (x: number, y: number) => number;
/** Reverse four-connected Dijkstra with an indexed binary heap and reusable storage.
 * Cost is paid on entering a cell. Nonpositive or infinite cost blocks entry. */
export class FlowField {
  private readonly costs: Float64Array;
  private readonly dist: Float64Array;
  private readonly next: Int32Array;
  private readonly heap: Int32Array;
  private readonly position: Int32Array;
  private count = 0;
  private left = 0;
  private top = 0;
  readonly size: number;
  constructor(size = 32) {
    this.size = size;
    const area = size * size;
    this.costs = new Float64Array(area);
    this.dist = new Float64Array(area);
    this.next = new Int32Array(area).fill(-1);
    this.heap = new Int32Array(area);
    this.position = new Int32Array(area);
  }
  private push(cell: number) {
    let i = this.position[cell];
    if (i < 0) i = this.count++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const other = this.heap[parent];
      if (this.dist[other] <= this.dist[cell]) break;
      this.heap[i] = other;
      this.position[other] = i;
      i = parent;
    }
    this.heap[i] = cell;
    this.position[cell] = i;
  }
  private pop() {
    const first = this.heap[0];
    const last = this.heap[--this.count];
    let i = 0;
    while (i * 2 + 1 < this.count) {
      let child = i * 2 + 1;
      if (
        child + 1 < this.count &&
        this.dist[this.heap[child + 1]] < this.dist[this.heap[child]]
      )
        child++;
      const other = this.heap[child];
      if (this.dist[last] <= this.dist[other]) break;
      this.heap[i] = other;
      this.position[other] = i;
      i = child;
    }
    this.heap[i] = last;
    this.position[last] = i;
    this.position[first] = -1;
    return first;
  }
  private relax(from: number, to: number, via: number) {
    if (
      this.costs[to] <= 0 ||
      !Number.isFinite(this.costs[to]) ||
      via >= this.dist[to]
    )
      return;
    this.dist[to] = via;
    this.next[to] = from;
    this.push(to);
  }
  compute(x: number, y: number, cost: TravelCost) {
    const n = this.size;
    const half = n >> 1;
    this.left = x - half;
    this.top = y - half;
    this.dist.fill(Number.POSITIVE_INFINITY);
    this.position.fill(-1);
    this.next.fill(-1);
    this.count = 0;
    for (let i = 0; i < n * n; i++)
      this.costs[i] = cost(this.left + (i % n), this.top + Math.floor(i / n));
    const goal = half * n + half;
    this.dist[goal] = 0;
    this.push(goal);
    while (this.count) {
      const i = this.pop();
      const col = i % n;
      const via =
        this.dist[i] + (i === goal && !(this.costs[i] > 0) ? 1 : this.costs[i]);
      if (col > 0) this.relax(i, i - 1, via);
      if (col < n - 1) this.relax(i, i + 1, via);
      if (i >= n) this.relax(i, i - n, via);
      if (i < n * (n - 1)) this.relax(i, i + n, via);
    }
  }
  /** Writes the next tile into caller-owned storage. */
  step(x: number, y: number, out: { x: number; y: number }) {
    const dx = x - this.left;
    const dy = y - this.top;
    if (dx < 0 || dy < 0 || dx >= this.size || dy >= this.size) return false;
    const i = this.next[dy * this.size + dx];
    if (i < 0) return false;
    out.x = this.left + (i % this.size);
    out.y = this.top + Math.floor(i / this.size);
    return true;
  }
}
