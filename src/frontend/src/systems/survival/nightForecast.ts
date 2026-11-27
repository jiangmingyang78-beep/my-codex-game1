import { nightWaves, waveSlot } from "../survivalTuning";
import { raidRules, type winterDay } from "./rhythm";
import { seededValue } from "./survivalNoise";

type Clock = ReturnType<typeof winterDay>;
export interface RaidState {
  day: number;
  stage: "waiting" | "active" | "repelled" | "expired";
  warning: number;
  budget: number;
  remaining: number;
  retryAt: number;
}

export function scheduleRaid(
  seed: number,
  afterDay: number,
  frequency: number,
): RaidState {
  const jitter = Math.round(
    (seededValue(seed, afterDay, 0, 0) * 2 - 1) * raidRules.jitterDays,
  );
  const gap =
    afterDay === 0 ? raidRules.firstDay : raidRules.intervalDays + jitter;
  const day =
    frequency > 0 ? afterDay + Math.max(1, Math.round(gap / frequency)) : 0;
  return {
    day,
    stage: "waiting",
    warning: 0,
    budget: 0,
    remaining: 0,
    retryAt: 0,
  };
}

export function raidForecast(
  seed: number,
  clock: Clock,
  time: number,
  raid: RaidState,
) {
  const roll = (salt: number) => seededValue(seed, clock.day, salt, 0);
  const fractions = raidRules.arrivalFractions;
  const arrival =
    clock.nightStart +
    (clock.cycle - clock.nightStart) *
      fractions[Math.floor(roll(1) * fractions.length)];
  const seconds = arrival - time;
  const lead =
    raidRules.warningMinSec +
    (raidRules.warningMaxSec - raidRules.warningMinSec) * roll(2);
  const scheduled = raid.day === clock.day && raid.stage === "waiting";
  const due = scheduled && seconds <= 0;
  const warning =
    !scheduled || due || seconds > lead
      ? 0
      : seconds <= raidRules.urgentSec
        ? 3
        : seconds <= raidRules.nearSec
          ? 2
          : 1;
  return { arrival, seconds, lead, due, warning };
}

/** Mutate before notifying so a save/reload cannot replay a warning or start. */
export function advanceRaid(
  raid: RaidState,
  forecast: ReturnType<typeof raidForecast>,
  budget: number,
) {
  if (raid.stage !== "waiting") return null;
  if (forecast.due) {
    raid.stage = budget > 0 ? "active" : "expired";
    raid.budget = raid.remaining = budget;
    return budget > 0 ? "arrival" : null;
  }
  if (forecast.warning > raid.warning) {
    raid.warning = forecast.warning;
    return "warning";
  }
  return null;
}

export function finishRaid(raid: RaidState, living: number) {
  if (raid.stage !== "active" || raid.remaining || living || !raid.budget)
    return false;
  raid.stage = "repelled";
  return true;
}

export function dawnAsh(raid: RaidState) {
  if (raid.stage !== "repelled") return 0;
  raid.stage = "expired";
  return raidRules.ashBase + Math.floor(raid.budget * raidRules.ashPerEnemy);
}

/** Legacy regular-wave forecast for callers using the original fixed schedule. */

export function survivalNightForecast(
  age: number,
  dayLength: number,
  dusk: number,
  frequency: number,
) {
  const time = age % dayLength;
  const waves = nightWaves(Math.floor(age / dayLength) + 1, frequency);
  const night = time >= dusk;
  const length = dayLength - dusk;
  const next = night ? waveSlot(time, dusk, length, waves) + 1 : 0;
  const seconds =
    next < waves ? Math.max(0, dusk + (length * next) / waves - time) : null;
  return { night, waves, seconds };
}
