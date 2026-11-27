import balance from "@/data/balance.json";
import { resolveSurvivalTuning } from "./survivalOverrides";
export const resourceRoll = (roll: number, density: number) =>
  density > 0 ? roll / density : Number.POSITIVE_INFINITY;
type Stock = Record<string, number>;
export function scaledStock(stock: Stock, multiplier: number): Stock {
  return Object.fromEntries(
    Object.entries(stock).map(([k, v]) => [k, Math.floor(v * multiplier)]),
  );
}
export function nightWaves(day: number, frequency: number): number {
  return Math.floor(day * frequency) - Math.floor((day - 1) * frequency);
}
export function waveSlot(
  age: number,
  dusk: number,
  length: number,
  count: number,
) {
  return Math.floor(((age - dusk) * count) / length);
}
export async function loadSurvivalTuning(request?: typeof fetch) {
  try {
    const response = await (request ?? globalThis.fetch)(
      "/survival-balance.json",
      { cache: "no-store" },
    );
    if (response.ok)
      return resolveSurvivalTuning(balance.survival, await response.json());
  } catch {
    // Offline, malformed or invalid overrides use the complete built-in profile.
  }
  return { ...balance.survival };
}
