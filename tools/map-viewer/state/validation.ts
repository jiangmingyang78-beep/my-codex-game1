import {dataFiles} from "@/core/gameData";
import {validateGameData} from "@/core/dataValidator";
import tuningSchema from "../../../src/frontend/public/survival-balance.schema.json";
import items from "@/data/items.json";
import type { MapSnapshot } from "../types";
import { type Draft, type FileKey, type Issue, type Path, files, isRecord, safeKey, valueAt } from "./documents";
import { scenarioDefaults, survivalDefaults } from "./ruleConfig";
import { validateOverrides } from "./validateOverrides";

const itemIds = new Set(items.items.map((i) => i.id));
const variableList = (key: string) => ["drops", "renewableItemIds"].includes(key);
export function validateDraft(draft: Draft, baseline: Draft, map: MapSnapshot): Issue[] {
  const issues: Issue[] = [];
  const fail = (file: FileKey, path: Path, message: string) => issues.push({ file, path, message });
  const enemies = new Set(
    [...baseline["enemies.json"].enemies, ...baseline["legacyEnemies.json"].enemies].map((e) => e.id),
  );
  const regions = new Set(baseline["regions.json"].regions.map((r) => r.id));
  for (const file of files) {
    const doc = draft[file];
    if (!isRecord(doc)) {
      fail(file, [], "文件必须为 JSON 对象");
      continue;
    }
    if (file === "worldOverrides.json") {
      issues.push(...validateOverrides(doc, map, itemIds, enemies, regions));
      continue;
    }
    function walk(v: unknown, base: unknown, path: Path) {
      const key = String(path.at(-1) ?? "");
      const parent = String(path.at(-2) ?? "");
      const bad = (msg: string) => fail(file, path, msg);
      if (isRecord(v) && isRecord(base)) {
        const inventory = key === "startingInventory";
        const optional = file === "survival-balance.json" || file === "encounters.json";
        for (const k of Object.keys(base))
          if (!Object.hasOwn(v, k) && !inventory && !optional) fail(file, [...path, k], "缺少必需字段");
        for (const [k, val] of Object.entries(v)) {
          if (!safeKey(k) || (!Object.hasOwn(base, k) && !inventory)) {
            fail(file, [...path, k], "未知字段");
            continue;
          }
          if (inventory && !itemIds.has(k)) fail(file, [...path, k], "物品不存在");
          walk(val, inventory ? 1 : base[k], [...path, k]);
        }
      } else if (Array.isArray(v) && Array.isArray(base)) {
        if (!variableList(key) && v.length !== base.length) bad("固定表的长度不可更改");
        if (key === "renewableItemIds" && new Set(v).size !== v.length) bad("再生物资不可重复");
        v.forEach((el, i) =>
          walk(
            el,
            key === "drops"
              ? {
                  itemId: "wood",
                  count: 1,
                  probability: 1,
                  ...(isRecord(el) && Object.hasOwn(el, "pickupId")
                    ? base.find((d) => d.pickupId === el.pickupId)
                    : {}),
                }
              : (base[i] ?? base[0] ?? ""),
            [...path, i],
          ),
        );
      } else if (typeof v === "number" && typeof base === "number") {
        if (file === "survival-balance.json" && "exclusiveMinimum" in (tuningSchema.properties[key as keyof typeof tuningSchema.properties] ?? {}) && v <= 0) bad("倍率必须大于零");
        if(parent==="categoryCap" && !Number.isSafeInteger(v))bad("数量上限须为非负整数");
        if (!Number.isFinite(v)) bad("必须为有限数值");
        const signed = key.endsWith("Delta") || key === "pushDirX" || key === "pushDirY";
        if (!signed && v < 0) bad("数值不能为负");
        if (/cooldownSec|intervalSec|dashDurationSec|travelSec/i.test(key) && v <= 0) bad("间隔必须大于零");
        if ((key === "maxHp" || (key === "max" && parent === "hp")) && v <= 0) bad("生命上限必须大于零");
        if ((key === "probability" || key === "hpThreshold" || key === "hpRatioAtOrBelow") && (v < 0 || v > 1))
          bad("须在 0 到 1 之间");
        if (
          (key === "count" || key === "renewalLimit" || parent === "startingInventory") &&
          (!Number.isSafeInteger(v) || v <= 0)
        )
          bad("数量须为正整数");
        if (
          (key === "activeEnemies" || key === "activeProjectiles" || parent === "radiiTilesByLevel") &&
          !Number.isSafeInteger(v)
        )
          bad("须为整数");
        if (["world", "clock", "storage"].includes(String(path[0])) && base !== v) bad("受保护的运行时配置");
        if (file === "regions.json" && ["tileX", "tileY", "act", "minCampLevel"].includes(key) && v !== base)
          bad("固定布局字段");
      } else if (typeof v === "string" && typeof base === "string") {
        if (key === "itemId" || ["renewableItemIds", "quickUseItemIds"].includes(parent)) {
          if (!itemIds.has(v)) bad("物品 ID 不存在");
        } else if (key === "enemyId") {
          if (!enemies.has(v)) bad("怪物 ID 不存在");
        } else if (v !== base) bad("固定标识或文本不可更改");
      } else if (v !== base) bad("类型或结构无效");
    }
    if (file === "encounters.json") {
      const template = { ...scenarioDefaults, weights: Object.fromEntries([...regions].map((id) => [id, 1])) };
      const { setPieces, ...rules } = draft[file];
      if(setPieces!==undefined) {
        try {validateGameData({...dataFiles,encounters:doc});}
        catch(error){fail(file,["setPieces"],String(error));}
      }
      walk(rules, template, []);
    } else walk(doc, file === "survival-balance.json" ? survivalDefaults : baseline[file], []);
  }
  const ring={...survivalDefaults,...draft["survival-balance.json"]};
  if(!(ring.minSpawnRadius<ring.maxSpawnRadius && ring.maxSpawnRadius<ring.despawnRadius))
    fail("survival-balance.json",["maxSpawnRadius"],"须满足近环 < 外环 < 回收距离");
  const hp = valueAt(draft["balance.json"], ["stats", "hp", "max"]);
  const heroes = valueAt(draft["heroes.json"], ["heroes"]);
  if (typeof hp === "number" && Array.isArray(heroes))
    heroes.forEach((hero, i) => {
      if (hp + Number(hero?.traits?.maxHpDelta ?? 0) <= 0)
        fail("heroes.json", ["heroes", i, "traits", "maxHpDelta"], "修正后生命须大于零");
    });
  return issues;
}
