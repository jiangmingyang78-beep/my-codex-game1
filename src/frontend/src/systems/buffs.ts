import type { RunState, Systems } from "@/core/types";

export function setNightLightBuff(
  state: RunState,
  sourceId: string,
  multiplier: number,
  durationSec: number,
): void {
  // Re-use refreshes the duration instead of stacking a second copy.
  state.buffs[sourceId] = {
    effect: "night_light_drain_multiplier",
    multiplier,
    remainingSec: durationSec,
  };
}

export function tickBuffs(state: RunState, sec: number): void {
  for (const key in state.buffs) {
    const buff = state.buffs[key];
    buff.remainingSec -= sec;
    if (buff.remainingSec <= 0) delete state.buffs[key];
  }
}

/**
 * Night light drain multiplier: owned equipment (lantern) and timed buffs (warm stew)
 * multiply together, e.g. 0.5 x 0.75 = 0.375.
 */
export function lightDrainMultiplier(state: RunState, sys: Systems): number {
  let m = 1;
  for (const item of sys.data.itemList) {
    if ((state.inventory[item.id] ?? 0) <= 0) continue;
    for (const effect of item.effects) {
      if (
        effect.trigger === "owned" &&
        effect.type === "night_light_drain_multiplier"
      )
        m *= effect.multiplier;
    }
  }
  for (const key in state.buffs) {
    const buff = state.buffs[key];
    if (buff.effect === "night_light_drain_multiplier") m *= buff.multiplier;
  }
  return m;
}
