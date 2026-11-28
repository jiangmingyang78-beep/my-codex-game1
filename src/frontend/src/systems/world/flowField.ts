type TravelCost = (x: number, y: number) => number;
/** Reverse four-connected Dijkstra with an indexed binary heap and reusable storage.
 * Cost is paid on entering a cell. Nonpositive or infinite cost blocks entry. */
export class FlowField {
  private readonly costs: Float64Array;
  private readonly dist: Float64Array;
  private readonly next: Int32Array;
  private readonly heap: Int32Array;
  private readonly position: Int32Array;
  private readonly affected: Int32Array;
  private readonly marked: Uint8Array;
  private initialized = false;
  private count = 0;
  private left = 0;
  private top = 0;
  readonly size: number;
  constructor(size = 32) {
    this.size = size;
    const area = size * size;
    this.affected = new Int32Array(area);
    this.marked = new Uint8Array(area);
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
    this.initialized = true;
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
    this.propagate(goal);
  }

  /** Keep unaffected shortest paths when hazards or walls change in place. */
  update(x: number, y: number, cost: TravelCost) {
    const n = this.size;
    const half = n >> 1;
    if (!this.initialized || this.left !== x - half || this.top !== y - half) {
      this.compute(x, y, cost);
      return;
    }
    const goal = half * n + half;
    let end = 0;
    for (let i = 0; i < this.costs.length; i++) {
      const value = cost(this.left + (i % n), this.top + Math.floor(i / n));
      if (value === this.costs[i]) continue;
      this.costs[i] = value;
      this.marked[i] = 1;
      this.affected[end++] = i;
    }
    if (!end) return;
    // Invalidate dependent successors all the way to the leaves, including islands
    // cut off by a newly closed gate. Boundary neighbours seed the reverse search.
    for (let k = 0; k < end; k++) {
      const i = this.affected[k];
      this.dist[i] = Number.POSITIVE_INFINITY;
      this.next[i] = -1;
      for (let d = 0; d < 4; d++) {
        const j = this.neighbor(i, d);
        if (j >= 0 && !this.marked[j] && this.next[j] === i) {
          this.marked[j] = 1;
          this.affected[end++] = j;
        }
      }
    }
    this.dist[goal] = 0;
    this.push(goal);
    for (let k = 0; k < end; k++) {
      const i = this.affected[k];
      for (let d = 0; d < 4; d++) {
        const j = this.neighbor(i, d);
        if (j >= 0 && !this.marked[j] && Number.isFinite(this.dist[j]))
          this.push(j);
      }
    }
    for (let k = 0; k < end; k++) this.marked[this.affected[k]] = 0;
    this.propagate(goal);
  }

  private neighbor(i: number, direction: number) {
    const n = this.size;
    switch (direction) {
      case 0:
        return i % n > 0 ? i - 1 : -1;
      case 1:
        return i % n < n - 1 ? i + 1 : -1;
      case 2:
        return i >= n ? i - n : -1;
      default:
        return i < this.costs.length - n ? i + n : -1;
    }
  }
  private propagate(goal: number) {
    const n = this.size;
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
