import type { BalanceData } from "./dataTypes";
import type { DayPhase } from "./types";

export function cycleSec(balance: BalanceData): number {
  return balance.clock.daySec + balance.clock.nightSec;
}

/** Clamps a frame delta to [0, clock.maxStepSec]; non-finite values become 0. */
export function clampStep(sec: number, balance: BalanceData): number {
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.min(sec, balance.clock.maxStepSec);
}

export function phaseAt(elapsedSec: number, balance: BalanceData): DayPhase {
  return elapsedSec % cycleSec(balance) < balance.clock.daySec
    ? "day"
    : "night";
}

/** 1-based day number (night N belongs to day N). */
export function dayAt(elapsedSec: number, balance: BalanceData): number {
  return Math.floor(elapsedSec / cycleSec(balance)) + 1;
}

/** Remaining game seconds until the storm claims the run. */
export function remainingSec(elapsedSec: number, balance: BalanceData): number {
  return Math.max(0, balance.clock.runLimitSec - elapsedSec);
}

/**
 * Presentation clock mapped to 24h: day 06:00-20:00 over daySec, night 20:00-06:00 over nightSec.
 * Returns "HH:MM".
 */
export function clockLabel(elapsedSec: number, balance: BalanceData): string {
  const t = elapsedSec % cycleSec(balance);
  const { daySec, nightSec } = balance.clock;
  const minutes =
    t < daySec
      ? 6 * 60 + (t / daySec) * 14 * 60
      : (20 * 60 + ((t - daySec) / nightSec) * 10 * 60) % (24 * 60);
  const m = Math.floor(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
