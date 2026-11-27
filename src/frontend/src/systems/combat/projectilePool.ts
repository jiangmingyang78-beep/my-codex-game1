import type { Projectile } from "@/core/types";
export class ObjectPool<T> {
  private readonly free: T[] = [];
  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void,
    private readonly capacity: number,
  ) {
    for (let i = 0; i < capacity; i++) this.free.push(create());
  }
  acquire() {
    return this.free.pop() ?? this.create();
  }
  release(item: T) {
    this.reset(item);
    if (this.free.length < this.capacity) this.free.push(item);
  }
}
export const projectilePool = new ObjectPool<Projectile>(
  () => ({ id: "", x: 0, y: 0, vx: 0, vy: 0, damage: 0, lifeSec: 0 }),
  (p) => {
    p.id = "";
    p.x = p.y = p.vx = p.vy = p.damage = p.lifeSec = 0;
    p.targetId = p.sourceId = undefined;
  },
  64,
);
