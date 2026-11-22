import { EVT, makeEvent } from "@/core/events";
import type { GameEvent, RunState, Systems } from "@/core/types";
import { lightDrainMultiplier, tickBuffs } from "./buffs";
import { inFireCircle } from "./campCircle";

/** Applies damage unless the shared invulnerability window is active. Returns true when applied. */
export function damageHero(
  state: RunState,
  sys: Systems,
  amount: number,
  events: GameEvent[],
  cause: string,
): boolean {
  const { hero } = state;
  if (state.status !== "playing" || hero.invulnerableSec > 0 || amount <= 0)
    return false;
  hero.hp = Math.max(0, hero.hp - amount);
  hero.invulnerableSec = sys.data.balance.stats.hp.damageImmunitySec;
  events.push(
    makeEvent(EVT.hit, hero.x, hero.y, {
      kind: "hurt",
      amount,
      cause,
      hp: hero.hp,
    }),
  );
  return true;
}

export function tickHeroTimers(state: RunState, sec: number): void {
  const { hero } = state;
  hero.invulnerableSec = Math.max(0, hero.invulnerableSec - sec);
  hero.attackCooldownSec = Math.max(0, hero.attackCooldownSec - sec);
  hero.attackAnimSec = Math.max(0, hero.attackAnimSec - sec);
}

/** Hunger, light and their zero-damage ticks. Does not advance the clock. */
export function tickSurvival(
  state: RunState,
  sys: Systems,
  sec: number,
  events: GameEvent[],
): void {
  const { hero } = state;
  const { stats } = sys.data.balance;
  const night = state.phase === "night";
  tickBuffs(state, sec);

  const perMinute = night
    ? stats.hunger.nightDrainPerMinute
    : stats.hunger.dayDrainPerMinute;
  hero.hunger = Math.max(0, hero.hunger - (perMinute / 60) * sec);
  if (hero.hunger <= 0) {
    hero.hungerDamageSec += sec;
    if (hero.hungerDamageSec >= stats.hunger.zeroDamageIntervalSec) {
      // A blocked tick (immunity) retries next frame; the timer only resets on real damage.
      if (damageHero(state, sys, stats.hunger.zeroDamage, events, "hunger")) {
        hero.hungerDamageSec -= stats.hunger.zeroDamageIntervalSec;
      }
    }
  } else {
    hero.hungerDamageSec = 0;
  }

  hero.inFire = inFireCircle(state, sys, hero.x, hero.y);
  if (hero.inFire) {
    hero.light = Math.min(
      stats.light.max,
      hero.light + stats.light.inFireRegenPerSec * sec,
    );
    hero.darknessDamageSec = 0;
    return;
  }
  if (!night) {
    hero.darknessDamageSec = 0;
    return;
  }
  hero.light = Math.max(
    0,
    hero.light -
      stats.light.nightDrainPerSec * lightDrainMultiplier(state, sys) * sec,
  );
  if (hero.light > 0) {
    hero.darknessDamageSec = 0;
    return;
  }
  hero.darknessDamageSec += sec;
  if (hero.darknessDamageSec >= stats.light.zeroDamageIntervalSec) {
    if (damageHero(state, sys, stats.light.zeroDamage, events, "darkness")) {
      hero.darknessDamageSec -= stats.light.zeroDamageIntervalSec;
    }
  }
}
