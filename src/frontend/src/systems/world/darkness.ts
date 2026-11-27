import type { BalanceData } from "@/core";

export const DUSK_SEC = 60;
export const DAWN_SEC = 30;
const DUSK_PEAK = 0.5;
const NIGHT_PEAK = 0.8;
const DAWN_FLOOR = 0.1;

const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * Math.min(1, Math.max(0, t));

/** Ambient darkness 0..1 for the night overlay; dusk ramps in, dawn ramps out. */
export function darknessAt(
  elapsedSec: number,
  clock: BalanceData["clock"],
): number {
  const cycle = clock.daySec + clock.nightSec;
  const t = ((elapsedSec % cycle) + cycle) % cycle;
  if (t < DAWN_SEC) return lerp(DAWN_FLOOR, 0, t / DAWN_SEC);
  if (t < clock.daySec - DUSK_SEC) return 0;
  if (t < clock.daySec)
    return lerp(0, DUSK_PEAK, (t - (clock.daySec - DUSK_SEC)) / DUSK_SEC);
  if (t < clock.daySec + DUSK_SEC)
    return lerp(DUSK_PEAK, NIGHT_PEAK, (t - clock.daySec) / DUSK_SEC);
  if (t < cycle - DAWN_SEC) return NIGHT_PEAK;
  return lerp(NIGHT_PEAK, DAWN_FLOOR, (t - (cycle - DAWN_SEC)) / DAWN_SEC);
}
