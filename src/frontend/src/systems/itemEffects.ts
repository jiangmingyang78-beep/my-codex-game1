import type { GameData, ItemEffect } from "@/core/dataTypes";
import { getHero } from "@/core/gameData";
import type { Inventory } from "@/core/types";

type OwnedStat = Extract<ItemEffect, { type: "add_owned_stat" }>["stat"];

export function ownedStatBonus(
  data: GameData,
  inventory: Inventory,
  stat: OwnedStat,
): number {
  let bonus = 0;
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    for (const effect of data.items.get(id)?.effects ?? []) {
      if (effect.type === "add_owned_stat" && effect.stat === stat)
        bonus += effect.value;
    }
  }
  return bonus;
}

export function heroMaxHp(
  data: GameData,
  inventory: Inventory,
  heroId?: string,
): number {
  return (
    data.balance.stats.hp.max +
    (getHero(data, heroId).traits.maxHpDelta ?? 0) +
    ownedStatBonus(data, inventory, "maxHp")
  );
}

export function heroLightRadiusMultiplier(
  data: GameData,
  inventory: Inventory,
  heroId?: string,
): number {
  let multiplier = getHero(data, heroId).traits.lightRadiusMult ?? 1;
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    for (const effect of data.items.get(id)?.effects ?? []) {
      if (effect.type === "light_radius_multiplier")
        multiplier *= effect.multiplier;
    }
  }
  return multiplier;
}

/** Shortest periodic block cooldown among owned equipment, or null if none is owned. */
export function bucklerBlockCooldown(
  data: GameData,
  inventory: Inventory,
): number | null {
  let best: number | null = null;
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    for (const effect of data.items.get(id)?.effects ?? []) {
      if (effect.type === "periodic_block") {
        best =
          best === null
            ? effect.cooldownSec
            : Math.min(best, effect.cooldownSec);
      }
    }
  }
  return best;
}

export function heroMoveSpeedMultiplier(
  data: GameData,
  inventory: Inventory,
): number {
  return 1 + ownedStatBonus(data, inventory, "moveSpeedBonus");
}
