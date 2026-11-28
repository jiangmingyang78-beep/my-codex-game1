import type { EternalHud } from "@/systems/eternal/eternalTypes";
import { bucklerBlockCooldown, heroMaxHp } from "@/systems/itemEffects";
import { getDashCooldownState } from "@/systems/movement";
import { getBucklerCooldownSec } from "@/systems/survival";
import { BEACON_SEAL_IDS, countBeaconSeals } from "@/systems/world/beacon";
import { clockLabel, remainingSec } from "./clock";
import type { RunState, Systems } from "./types";

export interface HudEquipmentItem {
  id: string;
  name: string;
  description: string;
  /** / Express permanent entry into force, 0 sign in place, positive sign in remaining cooling seconds. */
  cooldownSec: number | null;
  maxCooldownSec: number | null;
}

export interface HudModel {
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
  light: number;
  maxLight: number;
  inFire: boolean;
  phase: "day" | "night";
  day: number;
  clock: string;
  /** "Two nights" by "two days" */
  dayLabel: string;
  stormRemainingSec: number;
  campLevel: number;
  /** Seals collected out of total, e.g. "1/2". */
  sealText: string;
  regionName: string;
  quickSlots: { slot: number; itemId: string; name: string; count: number }[];
  buffSecondsLeft: number;
  equipment: HudEquipmentItem[];
  /** Present only in Eternal Mode: replaces the storm clock and objective. */
  eternal?: EternalHud;
}

function buildEquipment(state: RunState, sys: Systems): HudEquipmentItem[] {
  return sys.data.itemList
    .filter(
      (item) =>
        item.type === "equipment" && (state.inventory[item.id] ?? 0) > 0,
    )
    .map((item): HudEquipmentItem => {
      const { id, name, description } = item;
      const view = { id, name, description };
      if (id === "iron_buckler") {
        return {
          ...view,
          cooldownSec: getBucklerCooldownSec(state, sys),
          maxCooldownSec: bucklerBlockCooldown(sys.data, state.inventory),
        };
      }
      if (id === "iron_boots") {
        const { remainingSec, maxSec } = getDashCooldownState(state, sys);
        return { ...view, cooldownSec: remainingSec, maxCooldownSec: maxSec };
      }
      return { ...view, cooldownSec: null, maxCooldownSec: null };
    })
    .sort(
      (a, b) => Number(b.cooldownSec !== null) - Number(a.cooldownSec !== null),
    );
}

/** Read-only view data for the HUD (allocates; call at HUD refresh rate, not per physics step). */
export function buildHudModel(state: RunState, sys: Systems): HudModel {
  const { balance } = sys.data;
  const night = state.phase === "night";
  let buff = 0;
  for (const id in state.buffs)
    buff = Math.max(buff, state.buffs[id].remainingSec);
  return {
    hp: state.hero.hp,
    maxHp: heroMaxHp(sys.data, state.inventory, state.heroId),
    hunger: state.hero.hunger,
    maxHunger: balance.stats.hunger.max,
    light: state.hero.light,
    maxLight: balance.stats.light.max,
    inFire: state.hero.inFire,
    phase: state.phase,
    day: state.day,
    clock: clockLabel(state.elapsedSec, balance),
    dayLabel: night ? `No. No${state.day}Night` : `No. No${state.day}days`,
    stormRemainingSec: remainingSec(state.elapsedSec, balance),
    campLevel: state.campLevel,
    sealText: `${countBeaconSeals(state)}/${BEACON_SEAL_IDS.length}`,
    regionName: sys.data.regions.get(state.regionId)?.name ?? state.regionId,
    quickSlots: balance.hero.quickUseItemIds
      .map((itemId, i) => ({
        slot: i + 1,
        itemId,
        name: sys.data.items.get(itemId)?.name ?? itemId,
        count: state.inventory[itemId] ?? 0,
      }))
      .filter((slot) => slot.slot <= 4 || slot.count > 0),
    buffSecondsLeft: buff,
    equipment: buildEquipment(state, sys),
  };
}
