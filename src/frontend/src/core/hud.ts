import { clockLabel, remainingSec } from "./clock";
import type { RunState, Systems } from "./types";

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
  /** e.g. "第2夜" or "第2天". */
  dayLabel: string;
  stormRemainingSec: number;
  campLevel: number;
  /** Seals collected out of total, e.g. "1/2". */
  sealText: string;
  regionName: string;
  quickSlots: { slot: number; itemId: string; name: string; count: number }[];
  buffSecondsLeft: number;
}

const SEALS_TOTAL = 2;

/** Read-only view data for the HUD (allocates; call at HUD refresh rate, not per physics step). */
export function buildHudModel(state: RunState, sys: Systems): HudModel {
  const { balance } = sys.data;
  const night = state.phase === "night";
  let buff = 0;
  for (const id in state.buffs)
    buff = Math.max(buff, state.buffs[id].remainingSec);
  return {
    hp: state.hero.hp,
    maxHp: balance.stats.hp.max,
    hunger: state.hero.hunger,
    maxHunger: balance.stats.hunger.max,
    light: state.hero.light,
    maxLight: balance.stats.light.max,
    inFire: state.hero.inFire,
    phase: state.phase,
    day: state.day,
    clock: clockLabel(state.elapsedSec, balance),
    dayLabel: night ? `第${state.day}夜` : `第${state.day}天`,
    stormRemainingSec: remainingSec(state.elapsedSec, balance),
    campLevel: state.campLevel,
    sealText: `${state.seals.length}/${SEALS_TOTAL}`,
    regionName: sys.data.regions.get(state.regionId)?.name ?? state.regionId,
    quickSlots: balance.hero.quickUseItemIds.map((itemId, i) => ({
      slot: i + 1,
      itemId,
      name: sys.data.items.get(itemId)?.name ?? itemId,
      count: state.inventory[itemId] ?? 0,
    })),
    buffSecondsLeft: buff,
  };
}
