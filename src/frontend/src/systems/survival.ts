import { EVT, makeEvent } from "@/core/events";
import { getHero } from "@/core/gameData";
import type { GameEvent, RunState, Systems } from "@/core/types";
import { isDevGodMode } from "@/game/dev/devTools";
import { lightDrainMultiplier, tickBuffs } from "./buffs";
import { inFireCircle } from "./campCircle";
import { tryArmRiposteOnMitigate } from "./combat/riposte";
import { bucklerBlockCooldown, heroMaxHp, ownedStatBonus } from "./itemEffects";
import { isHeroDashInvulnerable } from "./movement";
import { evaluateRegionModifiers } from "./world/regionEffects";

/** In-memory timers; deliberately not part of RunState/snapshot. */
const restTimers = new WeakMap<RunState, number>();
const bucklerTimers = new WeakMap<RunState, number>();
const REST = { intervalSec: 7, minHunger: 50, hungerCost: 5 };

/** Remaining buckler cooldown in seconds (>= 0), or null when no buckler is owned. */
export function getBucklerCooldownSec(
  state: RunState,
  sys: Systems,
): number | null {
  if (bucklerBlockCooldown(sys.data, state.inventory) === null) return null;
  return Math.max(0, bucklerTimers.get(state) ?? 0);
}

/** Resets buckler cooldown to ready (used by DEV toolbar). */
export function resetBucklerCooldown(state: RunState): void {
  bucklerTimers.delete(state);
}

/** Applies damage unless the shared invulnerability window is active. Returns true when applied. */
export function damageHero(
  state: RunState,
  sys: Systems,
  amount: number,
  events: GameEvent[],
  cause: string,
  source?: { x: number; y: number },
): boolean {
  if (import.meta.env.DEV && isDevGodMode(state)) return false;
  const { hero } = state;
  if (state.status !== "playing" || amount <= 0) return false;
  if (isHeroDashInvulnerable(state)) {
    if (source) tryArmRiposteOnMitigate(state, "dash_iframe", events, source);
    return false;
  }
  if (hero.invulnerableSec > 0) return false;
  const isEnvDamage =
    cause === "hunger" || cause === "darkness" || cause === "burn";
  if (!isEnvDamage) {
    const blockCooldown = bucklerBlockCooldown(sys.data, state.inventory);
    if (blockCooldown !== null && (bucklerTimers.get(state) ?? 0) <= 0) {
      bucklerTimers.set(state, blockCooldown);
      hero.invulnerableSec = 0.35;
      events.push(
        makeEvent(EVT.blocked, hero.x, hero.y, {
          targetId: "hero",
          source: cause,
          message: "锻铁圆盾格挡了攻击！",
        }),
      );
      if (source)
        tryArmRiposteOnMitigate(state, "buckler_block", events, source);
      return false;
    }
  }
  const reduction = isEnvDamage
    ? 0
    : ownedStatBonus(sys.data, state.inventory, "damageReduction");
  const finalAmount = isEnvDamage ? amount : Math.max(1, amount - reduction);
  hero.hp = Math.max(0, hero.hp - finalAmount);
  hero.invulnerableSec =
    sys.data.balance.stats.hp.damageImmunitySec +
    (getHero(sys.data, state.heroId).traits.immunityBonusSec ?? 0) +
    ownedStatBonus(sys.data, state.inventory, "immunityBonusSec");
  events.push(
    makeEvent(EVT.hit, hero.x, hero.y, {
      kind: "hurt",
      amount: finalAmount,
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
  const rem = bucklerTimers.get(state);
  if (rem !== undefined && rem > 0) {
    bucklerTimers.set(state, Math.max(0, rem - sec));
  }
}

/** Gentle campfire rest: +1 hp every few seconds while warm and fed. */
function tickRest(
  state: RunState,
  sys: Systems,
  sec: number,
  events: GameEvent[],
): void {
  const { hero } = state;
  const canRest =
    hero.inFire &&
    hero.hunger >= REST.minHunger &&
    hero.invulnerableSec <= 0 &&
    hero.hp < heroMaxHp(sys.data, state.inventory, state.heroId);
  if (!canRest) {
    restTimers.delete(state);
    return;
  }
  const timer = (restTimers.get(state) ?? 0) + sec;
  if (timer < REST.intervalSec) {
    restTimers.set(state, timer);
    return;
  }
  restTimers.set(state, timer - REST.intervalSec);
  hero.hp += 1;
  hero.hunger -= REST.hungerCost;
  events.push(
    makeEvent(EVT.notice, hero.x, hero.y, {
      message: "篝火旁稍作休整，恢复 1 点生命",
    }),
  );
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
  tickRest(state, sys, sec, events);
  if (hero.inFire) {
    hero.light = Math.min(
      stats.light.max,
      hero.light +
        stats.light.inFireRegenPerSec *
          sec *
          (getHero(sys.data, state.heroId).traits.inFireRegenMult ?? 1),
    );
    hero.darknessDamageSec = 0;
    return;
  }
  if (!night) {
    hero.darknessDamageSec = 0;
    return;
  }
  const warmEmbers =
    state.elements.size &&
    state.elements.at(
      Math.floor(hero.x / sys.data.tileSize),
      Math.floor(hero.y / sys.data.tileSize),
    )?.scorched;
  const regionDrain =
    evaluateRegionModifiers(state, sys).lightDrainMult * (warmEmbers ? 0.8 : 1);
  hero.light = Math.max(
    0,
    hero.light -
      stats.light.nightDrainPerSec *
        lightDrainMultiplier(state, sys) *
        regionDrain *
        sec,
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
