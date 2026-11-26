import { type Session, type Point, blocked, editable } from "./selection";
import type { WorldOverrides } from "@/systems/world/worldOverrides";
const file = "worldOverrides.json";
export function place(s: Session, tx: number, ty: number) {
  if (s.mode !== "adventure" || blocked(s.map, tx, ty)) return;
  const id = "manual_" + crypto.randomUUID();
  s.selected = id;
  s.store.edit(file, (o) => {
    if (s.tool === 2) o.addedObjects.push({ id, tx, ty, itemId: s.itemId, yield: 1, renewable: false });
    else {
      s.enemyId = s.placeEnemy;
      o.addedSpawns.push({ id, tx, ty, enemyId: s.placeEnemy });
    }
  });
}
type Patch = {
  tx?: number;
  ty?: number;
  itemId?: string;
  yield?: number;
  renewable?: boolean;
  renewalLimit?: number;
  respawnCooldownSec?: number;
  enemyId?: string;
  regionId?: string;
};
function collections(o: WorldOverrides, p: Point) {
  const node = "itemId" in p;
  return {
    added: node ? o.addedObjects : o.addedSpawns,
    removed: node ? o.removedObjectIds : o.removedSpawnIds,
    moved: node ? o.movedObjects : o.movedSpawns,
    edited: node ? o.editedObjects : o.editedSpawns,
  };
}
export function changePoint(s: Session, p: Point, patch: Patch) {
  if (s.mode !== "adventure" || !editable(p)) return;
  s.store.edit(file, (o) => {
    const c = collections(o, p);
    const added = c.added.find((a) => a.id === p.id);
    if (added) {
      Object.assign(added, patch);
      if ("tx" in patch || "ty" in patch) delete (added as Patch).regionId;
    } else if ("tx" in patch || "ty" in patch) {
      c.moved[p.id] = { tx: patch.tx ?? p.tx, ty: patch.ty ?? p.ty };
      if (c.edited[p.id]) delete (c.edited[p.id] as Patch).regionId;
    } else c.edited[p.id] = { ...c.edited[p.id], ...patch };
  });
}
export function removePoint(s: Session, p: Point) {
  if (s.mode !== "adventure" || !editable(p)) return;
  s.selected = null;
  s.store.edit(file, (o) => {
    const c = collections(o, p),
      i = c.added.findIndex((a) => a.id === p.id);
    if (i >= 0) c.added.splice(i, 1);
    else c.removed.push(p.id);
    delete c.edited[p.id];
    delete c.moved[p.id];
  });
}
export function resetPoint(s: Session, p: Point) {
  if (!editable(p)) return;
  s.store.edit(file, (o) => {
    const c = collections(o, p),
      b = collections(s.store.baseline[file], p);
    for (const k of ["moved", "edited"] as const) {
      delete c[k][p.id];
      if (b[k][p.id]) Object.assign(c[k], { [p.id]: structuredClone(b[k][p.id]) });
    }
    const idx = c.added.findIndex((a) => a.id === p.id),
      orig = b.added.find((a) => a.id === p.id);
    if (orig && idx >= 0) Object.assign(c.added, { [idx]: structuredClone(orig) });
    else if (idx >= 0) c.added.splice(idx, 1);
  });
}
