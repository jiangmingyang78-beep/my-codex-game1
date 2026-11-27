import type { LightGrid } from "../world/lightGrid";

type Point = { x: number; y: number };
export type Category = "hostile" | "elite" | "neutral";
export interface SpawnSettings {
  minSpawnRadius: number;
  maxSpawnRadius: number;
  despawnRadius: number;
  categoryCap: Record<Category, number>;
}
export type View = Point & { width: number; height: number };
export function spawnRadii(settings: SpawnSettings, tile: number, view?: View) {
  const min = Math.max(
    settings.minSpawnRadius * tile,
    view ? Math.hypot(view.width, view.height) / 2 + tile : 0,
  );
  const max = settings.maxSpawnRadius * tile;
  return {
    min,
    max,
    despawn: settings.despawnRadius * tile,
  };
}
export function inRing(
  p: Point,
  hero: Point,
  radii: ReturnType<typeof spawnRadii>,
  view?: View,
) {
  const d = Math.hypot(p.x - hero.x, p.y - hero.y);
  const margin = 12;
  return (
    d >= radii.min &&
    d <= radii.max &&
    !(
      view &&
      p.x >= view.x - margin &&
      p.x <= view.x + view.width + margin &&
      p.y >= view.y - margin &&
      p.y <= view.y + view.height + margin
    )
  );
}
const ordinary = { maxSky: 7, maxBlock: 2 };
const shadow = { maxSky: 7, maxBlock: 0 };
export function spawnLightAllowed(grid: LightGrid, p: Point, id: string) {
  return !grid.isSafeFromSpawn(
    p.x,
    p.y,
    id === "coal_shade" || id === "shadow_lynx" ? shadow : ordinary,
  );
}
export function categoryOf(id: string): Category {
  return ["frozen_guard", "ice_ram", "shadow_lynx"].includes(id)
    ? "elite"
    : "hostile";
}
export interface Mob extends Point {
  enemyId: string;
  category?: Category;
  boss?: boolean;
  persistent?: boolean;
  playerInteracted?: boolean;
  taskLocked?: boolean;
  hp: number;
}
export function hasCapacity(
  mobs: Iterable<Mob>,
  category: Category,
  settings: SpawnSettings,
) {
  let count = 0;
  for (const mob of mobs)
    if (
      mob.hp > 0 &&
      !mob.boss &&
      (mob.category ?? categoryOf(mob.enemyId)) === category
    )
      count++;
  return count < settings.categoryCap[category];
}
function protectedMob(mob: Mob) {
  return Boolean(
    mob.boss || mob.persistent || mob.taskLocked || mob.playerInteracted,
  );
}
export function shouldDespawn(mob: Mob, hero: Point, radius: number) {
  return (
    !protectedMob(mob) && Math.hypot(mob.x - hero.x, mob.y - hero.y) > radius
  );
}
export function despawnAlpha(
  mob: Mob,
  hero: Point,
  radius: number,
  tile: number,
) {
  if (protectedMob(mob)) return 1;
  return Math.max(
    0,
    Math.min(
      1,
      (radius - Math.hypot(mob.x - hero.x, mob.y - hero.y)) / (2 * tile),
    ),
  );
}
// Clear all AI, hit and optional flags before a recycled instance is published again.
export class MobPool<T extends object> {
  private free: T[] = [];
  release(mob: T) {
    if (this.free.length < 128) this.free.push(mob);
  }
  acquire(initial: T): T {
    const mob = this.free.pop();
    if (!mob) return initial;
    for (const key of Object.keys(mob)) Reflect.deleteProperty(mob, key);
    return Object.assign(mob, initial);
  }
}
