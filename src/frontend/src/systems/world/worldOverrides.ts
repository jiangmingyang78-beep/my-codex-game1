import type { GameData } from "@/core/dataTypes";
import type { World, WorldObject } from "./worldTypes";

type Tile = { tx: number; ty: number };
type Renewal = { renewalLimit?: number; respawnCooldownSec?: number };
type Resource = Pick<WorldObject, "itemId" | "yield" | "renewable"> & Renewal;
type Spawn = { enemyId?: string; regionId?: string };
export interface WorldOverrides {
  version: number;
  addedObjects: (Tile & Resource & { id: string; itemId: string })[];
  removedObjectIds: string[];
  movedObjects: Record<string, Tile>;
  editedObjects: Record<string, Resource>;
  addedSpawns: (Tile & Spawn & { id: string; enemyId: string })[];
  removedSpawnIds: string[];
  movedSpawns: Record<string, Tile>;
  editedSpawns: Record<string, Spawn>;
}

const populated = (v: object) => Object.keys(v).length > 0;
const clip = (n: number, size: number) =>
  Math.max(0, Math.min(size - 1, Math.round(Number.isFinite(n) ? n : 0)));

export function applyWorldOverrides(world: World, o?: WorldOverrides): World {
  if (!o || !Object.values(o).some(populated)) return world;
  const position = ({ tx, ty }: Tile, fallback: string) => {
    const x = clip(tx, world.widthTiles);
    const y = clip(ty, world.heightTiles);
    const region = world.regions.find(
      (r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1,
    );
    return {
      x: (x + 0.5) * world.tileSize,
      y: (y + 0.5) * world.tileSize,
      regionId: region?.id ?? fallback,
    };
  };
  function update<T extends { regionId: string }>(
    source: ReadonlyMap<string, T>,
    removed: string[],
    moved: Record<string, Tile>,
    edits: Record<string, object>,
  ) {
    const result = new Map(source);
    for (const id of removed) result.delete(id);
    for (const [id, entry] of result) {
      if (!moved[id] && !edits[id]) continue;
      const pos = moved[id] && position(moved[id], entry.regionId);
      result.set(id, { ...entry, ...pos, ...edits[id] });
    }
    return result;
  }
  const objects = update(
    world.objects,
    o.removedObjectIds,
    o.movedObjects,
    o.editedObjects,
  );
  const spawns = update(
    world.spawns,
    o.removedSpawnIds,
    o.movedSpawns,
    o.editedSpawns,
  );
  const fallback = world.regions[0]?.id ?? "";
  for (const node of o.addedObjects) {
    const { tx, ty, ...resource } = node;
    const obj = {
      ...resource,
      kind: "node" as const,
      yield: node.yield ?? 1,
      renewable: node.renewable ?? false,
      ...position({ tx, ty }, fallback),
    };
    objects.set(node.id, obj);
  }
  for (const s of o.addedSpawns) {
    const pos = position(s, fallback);
    const point = {
      ...pos,
      spawnId: s.id,
      enemyId: s.enemyId,
      regionId: s.regionId ?? pos.regionId,
    };
    spawns.set(s.id, point);
  }
  const objectList = [...objects.values()].sort((a, b) =>
    a.id < b.id ? -1 : 1,
  );
  return { ...world, objects, objectList, spawns };
}

type Region = GameData["regionList"][number];
const originals = new WeakMap<Region, Region["residentSpawns"]>();
export const residents = (r: Region) => originals.get(r) ?? r.residentSpawns;

// Activation reads region rosters, while positioning reads World.spawns.
export function syncResidentSpawns(
  data: GameData,
  world: World,
  o: WorldOverrides,
) {
  if (!Object.entries(o).some(([k, v]) => k.includes("Spawn") && populated(v)))
    return;
  const defs = data.regionList.flatMap(residents);
  for (const s of o.addedSpawns)
    defs.push({ spawnId: s.id, enemyId: s.enemyId });
  for (const r of data.regionList) {
    if (!originals.has(r)) originals.set(r, r.residentSpawns);
    r.residentSpawns = defs
      .filter((s) => world.spawns.get(s.spawnId)?.regionId === r.id)
      .map((s) => ({
        ...s,
        enemyId: o.editedSpawns[s.spawnId]?.enemyId ?? s.enemyId,
      }));
  }
}
