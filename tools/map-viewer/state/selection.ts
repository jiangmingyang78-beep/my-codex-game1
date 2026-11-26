import type { MapObject, MapSnapshot, MapSpawn, MapMode } from "../types";
import type { ConsoleStore } from "./consoleStore";
export type Point = MapObject | MapSpawn;
export type Tab = "map" | "rules" | "enemy" | "hero";
export const toolNames = ["浏览选择", "放置物资", "放置刷怪点", "拖拽移动", "橡皮擦"];
export interface Session {
  store: ConsoleStore;
  base: MapSnapshot;
  map: MapSnapshot;
  mode: MapMode;
  tab: Tab;
  tool: number;
  selected: string | null;
  itemId: string;
  enemyId: string;
  placeEnemy: string;
  heroId: string;
  leash: boolean;
  phase: number;
  focus(): void;
  refresh(): void;
  draw(): void;
}
export function selected(s: Session) {
  return [...s.map.objects, ...s.map.spawns].find((p) => p.id === s.selected);
}
export function editable(p?: Point) {
  return !!p && (("itemId" in p && !!p.itemId) || ("enemyId" in p && !!p.enemyId && p.kind !== "night"));
}
export function blocked(m: MapSnapshot, tx: number, ty: number) {
  const x = tx - m.originX,
    y = ty - m.originY;
  return x < 0 || y < 0 || x >= m.width || y >= m.height || !!m.solidMask[y * m.width + x];
}
