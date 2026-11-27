import loreJson from "@/data/lore.json";
import type { LoreData } from "./dataTypes";

/** Chinese player-facing text for stable reason codes returned by the rule systems. */
const REASONS: Record<string, string> = {
  unknown_item: "未知物品",
  unknown_recipe: "未知配方",
  recipe_locked: "尚未解锁这个配方",
  not_usable: "这个物品不能直接使用",
  not_owned: "背包里没有这个物品",
  stat_full: "生命已满，无需使用",
  inventory_full: "背包已满，无法拾取",
  missing_material: "材料不足",
  camp_level_too_low: "营火等级不足",
  already_upgraded: "营火已经升到这一级",
  camp_level_max: "营火已是最高等级",
  already_owned: "已经拥有，无法重复制作",
  no_free_relay_slot: "没有空闲的火站插槽，无法再制作接力火盆",
  station_too_far: "离营火太远",
  already_gathered: "这里已经采空了",
  nothing_nearby: "附近没有可互动的目标",
  no_relay_kit: "需要接力火盆才能点亮这座火站",
  already_lit: "火站已经点亮",
  already_open: "大门已经敞开",
  missing_seal: "需要先取得所需的炉印",
};

export function reasonMessage(
  reason: string | undefined,
  detail?: Record<string, unknown>,
): string {
  if (!reason) return "";
  if (reason === "camp_level_too_low" && typeof detail?.need === "number") {
    return `需要${LEVEL_NAME[detail.need] ?? detail.need}级营火`;
  }
  return REASONS[reason] ?? "无法执行该操作";
}

const LEVEL_NAME: Record<number, string> = { 1: "一", 2: "二", 3: "三" };

export const CAMP_NOTE_TEXT: LoreData["campNotes"] = loreJson.campNotes;
