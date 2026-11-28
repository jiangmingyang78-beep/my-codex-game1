import type balance from "@/data/balance.json";
import type current from "@/data/enemies.json";
type EnemyRow = (typeof current.enemies)[number];
type ModernRow = Extract<EnemyRow,{seedType: string}>;
type LegacyRow = Exclude<EnemyRow,ModernRow>;
import type heroes from "@/data/heroes.json";
import type regions from "@/data/regions.json";
import type { WorldOverrides } from "@/systems/world/worldOverrides";

export interface Draft {
  "balance.json": typeof balance;
  "enemies.json": {enemies: ModernRow[]};
  "legacyEnemies.json": {enemies: LegacyRow[]; encounterRewards: typeof current.encounterRewards};
  "heroes.json": typeof heroes;
  "regions.json": typeof regions;
  "worldOverrides.json": WorldOverrides;
  "survival-balance.json": Partial<Omit<typeof balance.survival,"categoryCap">> & {categoryCap?:Partial<typeof balance.survival.categoryCap>};
  "encounters.json": typeof import("@/systems/runtimeRules").rules & {setPieces?:typeof import("@/data/encounters.json").setPieces};
}
export type FileKey = keyof Draft;
export const files: FileKey[] = [
  "balance.json",
  "enemies.json",
  "legacyEnemies.json",
  "heroes.json",
  "regions.json",
  "encounters.json",
  "worldOverrides.json",
  "survival-balance.json",
];
export const emptyOverrides: WorldOverrides = {
  version: 1,
  addedObjects: [],
  removedObjectIds: [],
  movedObjects: {},
  editedObjects: {},
  addedSpawns: [],
  removedSpawnIds: [],
  movedSpawns: {},
  editedSpawns: {},
};
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const safeKey = (k: string) => !["__proto__", "constructor", "prototype"].includes(k);
export type Path = (string | number)[];
export function valueAt(obj: unknown, path: Path): unknown {
  for (const key of path) {
    if (!obj || typeof obj !== "object" || !Object.hasOwn(obj, key)) return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }
  return obj;
}
export function put(obj: unknown, path: Path, value: unknown) {
  if (!path.length || path.some((k) => !safeKey(String(k)))) throw Error("Invalid field path");
  const parent = valueAt(obj, path.slice(0, -1)) as Record<string, unknown>;
  const key = path[path.length - 1];
  if (value === undefined) {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete parent[key];
  } else parent[key] = structuredClone(value);
}
export type Issue = { file: FileKey; path: Path; message: string };
export function diffFields(a: unknown, b: unknown, path: Path = []): { path: Path; before: unknown; after: unknown }[] {
  if (Object.is(a, b)) return [];
  if ((isRecord(a) && isRecord(b)) || (Array.isArray(a) && Array.isArray(b))) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) =>
      diffFields(valueAt(a, [k]), valueAt(b, [k]), [...path, Array.isArray(a) ? Number(k) : k]),
    );
  }
  return [{ path, before: a, after: b }];
}
