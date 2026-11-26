import type { MapSnapshot } from "../types";
import { type Issue, type Path, isRecord, safeKey } from "./documents";
import { emptyOverrides } from "./documents";
export function validateOverrides(
  raw: unknown,
  map: MapSnapshot,
  items: Set<string>,
  enemies: Set<string>,
  regions: Set<string>,
): Issue[] {
  const issues: Issue[] = [];
  const fail = (path: Path, message: string) => issues.push({ file: "worldOverrides.json", path, message });
  if (!isRecord(raw) || raw.version !== 1) {
    fail(["version"], "地图覆写版本必须为 1");
    return issues;
  }
  for (const key of Object.keys(raw)) if (!Object.hasOwn(emptyOverrides, key)) fail([key], "未知字段");
  const occupied = new Set([...map.objects, ...map.spawns].map((p) => p.id));
  for (const kind of ["Object", "Spawn"] as const) {
    const resource = kind === "Object";
    const base = new Set(
      resource
        ? map.objects.filter((o) => o.itemId).map((o) => o.id)
        : map.spawns.filter((s) => s.enemyId && s.kind !== "night").map((s) => s.id),
    );
    const removed = new Set<string>();
    const validId = (s: unknown): s is string => typeof s === "string" && /^[\w-]{1,100}$/.test(s) && safeKey(s);
    for (const op of ["removed", "moved", "edited", "added"]) {
      const key = op === "removed" ? op + kind + "Ids" : op + kind + "s";
      const entries = raw[key];
      const list = op === "removed" || op === "added";
      if (list ? !Array.isArray(entries) : !isRecord(entries)) {
        fail([key], "集合结构无效");
        continue;
      }
      for (const [index, entry] of Object.entries(entries as object)) {
        const path = [key, index];
        const id = op === "removed" ? entry : op === "added" && isRecord(entry) ? entry.id : index;
        if (!validId(id) || (op === "added" ? occupied.has(id) : !base.has(id)) || removed.has(id)) {
          fail(path, "点位 ID 重复、受保护或不存在");
          continue;
        }
        if (op === "removed") {
          removed.add(id);
          continue;
        }
        if (!isRecord(entry)) {
          fail(path, "点位必须为对象");
          continue;
        }
        if (op === "added") occupied.add(id);
        const props = resource
          ? ["itemId", "yield", "renewable", "renewalLimit", "respawnCooldownSec"]
          : ["enemyId", "regionId"];
        const allowed = op === "added" ? ["id", "tx", "ty", ...props] : op === "moved" ? ["tx", "ty"] : props;
        if (Object.keys(entry).some((k) => !allowed.includes(k))) fail(path, "不支持的点位参数");
        if (op !== "edited") {
          const { tx, ty } = entry;
          if (
            typeof tx !== "number" ||
            typeof ty !== "number" ||
            !Number.isInteger(tx) ||
            !Number.isInteger(ty) ||
            tx < 0 ||
            ty < 0 ||
            tx >= map.width ||
            ty >= map.height ||
            map.solidMask[ty * map.width + tx]
          )
            fail(path, "点位位于阻挡格或地图边界外");
        }
        for (const [field, ids] of [
          ["itemId", items],
          ["enemyId", enemies],
          ["regionId", regions],
        ] as const) {
          if (
            (field in entry || (op === "added" && field === (resource ? "itemId" : "enemyId"))) &&
            (typeof entry[field] !== "string" || !ids.has(String(entry[field])))
          )
            fail([...path, field], "引用的 ID 不存在");
        }
        if ("yield" in entry && !(Number.isSafeInteger(entry.yield) && Number(entry.yield) > 0))
          fail([...path, "yield"], "产量须为正整数");
        if ("renewalLimit" in entry && (!Number.isSafeInteger(entry.renewalLimit) || Number(entry.renewalLimit) < 0))
          fail([...path, "renewalLimit"], "再生次数须为非负整数");
        if (
          "respawnCooldownSec" in entry &&
          (typeof entry.respawnCooldownSec !== "number" ||
            !Number.isFinite(entry.respawnCooldownSec) ||
            entry.respawnCooldownSec < 0)
        )
          fail([...path, "respawnCooldownSec"], "刷新冷却须为有限非负数");
        if ("renewable" in entry && typeof entry.renewable !== "boolean")
          fail([...path, "renewable"], "再生开关必须为布尔值");
      }
    }
  }
  return issues;
}
