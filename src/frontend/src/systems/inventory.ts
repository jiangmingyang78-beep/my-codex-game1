import type { GameData } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import { getHero } from "@/core/gameData";
import { reasonMessage } from "@/core/messages";
import type {
  ActionResult,
  GameEvent,
  Inventory,
  RunState,
  Systems,
} from "@/core/types";
import { discoverRecipes } from "@/systems/recipeBook";
import { setNightLightBuff } from "./buffs";
import { heroMaxHp } from "./itemEffects";
import { igniteRunTile } from "./world/runElements";

export function countOf(inventory: Inventory, itemId: string): number {
  return inventory[itemId] ?? 0;
}

export function stackLimit(data: GameData, itemId: string): number {
  return data.items.get(itemId)?.maxStack ?? 0;
}

/** Room left in the stack for an item. */
export function freeSpace(
  data: GameData,
  inventory: Inventory,
  itemId: string,
): number {
  return Math.max(0, stackLimit(data, itemId) - countOf(inventory, itemId));
}

export function canAdd(
  data: GameData,
  inventory: Inventory,
  itemId: string,
  count: number,
): boolean {
  return (
    data.items.has(itemId) &&
    Number.isInteger(count) &&
    count > 0 &&
    freeSpace(data, inventory, itemId) >= count
  );
}

/** All-or-nothing add. Returns false (inventory untouched) when the stack cannot hold `count`. */
export function addItem(
  data: GameData,
  inventory: Inventory,
  itemId: string,
  count: number,
): boolean {
  if (!canAdd(data, inventory, itemId, count)) return false;
  inventory[itemId] = countOf(inventory, itemId) + count;
  return true;
}

/** Removes counts atomically; returns false when any entry is insufficient. */
export function removeItems(
  inventory: Inventory,
  costs: Record<string, number>,
): boolean {
  for (const id in costs) if (countOf(inventory, id) < costs[id]) return false;
  for (const id in costs) {
    const left = countOf(inventory, id) - costs[id];
    if (left > 0) inventory[id] = left;
    else delete inventory[id];
  }
  return true;
}

/**
 * Picks up items for a gather/pickup action. When full the pickup is refused with
 * reason `inventory_full` and nothing is changed so the source keeps its resource.
 */
export function pickUp(
  state: RunState,
  sys: Systems,
  itemId: string,
  count: number,
): ActionResult {
  if (!sys.data.items.has(itemId))
    return { ok: false, reason: "unknown_item", events: [] };
  if (!addItem(sys.data, state.inventory, itemId, count)) {
    return {
      ok: false,
      reason: "inventory_full",
      events: [],
      detail: { itemId, count },
    };
  }
  const events = [
    makeEvent(EVT.itemPicked, state.hero.x, state.hero.y, { itemId, count }),
  ];
  discoverRecipes(state, sys, events);
  return { ok: true, events };
}

/** Quick-use slot (1-based) to item id from balance.hero.quickUseItemIds. */
export function quickUseItemId(data: GameData, slot: number): string | null {
  return data.balance.hero.quickUseItemIds[slot - 1] ?? null;
}

/** Consumes one usable item after validating its effects and inventory count. */
export function consumeItem(
  state: RunState,
  sys: Systems,
  itemId: string,
): ActionResult {
  const { data } = sys;
  const item = data.items.get(itemId);
  const { hero } = state;
  const fail = (reason: string): ActionResult => ({
    ok: false,
    reason,
    events: [
      makeEvent(EVT.useRefused, hero.x, hero.y, {
        itemId,
        reason,
        message: reasonMessage(reason),
      }),
    ],
  });
  if (!item) return fail("unknown_item");
  const effects = item.effects.filter((e) => e.trigger === "use");
  if (effects.length === 0) return fail("not_usable");
  if (countOf(state.inventory, itemId) < 1) return fail("not_owned");
  const maxHp = heroMaxHp(data, state.inventory, state.heroId);
  const statMax = (stat: "hp" | "hunger" | "light") =>
    stat === "hp" ? maxHp : data.balance.stats[stat].max;
  for (const e of effects) {
    if (
      e.type === "restore_stat" &&
      e.requiresBelowMax &&
      hero[e.stat] >= statMax(e.stat)
    ) {
      return fail("stat_full");
    }
  }
  removeItems(state.inventory, { [itemId]: 1 });
  const { healBonus = 0 } = getHero(data, state.heroId).traits;
  for (const e of effects) {
    if (e.type === "restore_stat") {
      const bonus = e.stat === "hp" && e.amount > 0 ? healBonus : 0;
      hero[e.stat] = Math.max(
        0,
        Math.min(statMax(e.stat), hero[e.stat] + e.amount + bonus),
      );
      if (e.stat === "hunger" && hero.hunger > 0) hero.hungerDamageSec = 0;
    } else if (e.type === "night_light_drain_multiplier" && e.durationSec) {
      setNightLightBuff(state, itemId, e.multiplier, e.durationSec);
    }
  }
  const events: GameEvent[] = [
    makeEvent(EVT.itemUsed, hero.x, hero.y, { itemId }),
  ];
  if (itemId === "resin_torch")
    igniteRunTile(
      state,
      sys,
      hero.x + hero.facingX * data.tileSize,
      hero.y + hero.facingY * data.tileSize,
      events,
    );
  return { ok: true, events };
}
