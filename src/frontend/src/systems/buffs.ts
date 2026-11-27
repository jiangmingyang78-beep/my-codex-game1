import { getHero } from "@/core/gameData";
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
  let m = getHero(sys.data, state.heroId).traits.lightDrainMult ?? 1;
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

export interface ThermalActor {
  hp: number;
  thermal?: {
    burnUntil: number;
    chillUntil: number;
    chill: number;
    burnCharge: number;
  };
}
export interface ElementResistance {
  burn?: number;
  chill?: number;
}
export function chillSpeed(actor: ThermalActor, time: number) {
  return actor.thermal && actor.thermal.chillUntil > time
    ? 1 - actor.thermal.chill
    : 1;
}

/** One fixed exposure step; fractional resistance affects burn frequency, never fractional HP. */
export function tickExposure(
  actor: ThermalActor,
  time: number,
  dt: number,
  tile: { burning: number; frostZone: number } | undefined,
  resist: ElementResistance | undefined,
  damage: () => void,
) {
  if (!actor.thermal && !tile?.burning && !tile?.frostZone) return;
  actor.thermal ??= {
    burnUntil: 0,
    chillUntil: 0,
    chill: 0,
    burnCharge: 0,
  };
  const status = actor.thermal;
  if (tile?.burning && (resist?.burn ?? 0) < 1) status.burnUntil = time + 1.25;
  if (tile?.frostZone) {
    status.chillUntil = time + 1;
    status.chill = 0.35 * (1 - (resist?.chill ?? 0));
  }
  if (time < status.burnUntil) {
    status.burnCharge += dt * (1 - (resist?.burn ?? 0));
    if (status.burnCharge >= 1) {
      status.burnCharge -= 1;
      damage();
    }
  } else status.burnCharge = 0;
  if (time >= status.burnUntil && time >= status.chillUntil)
    actor.thermal = undefined;
}
