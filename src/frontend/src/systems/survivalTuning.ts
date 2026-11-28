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
/** In development Alt+Shift+R rereads spatial rules from the same JSON override in all modes. */
export async function loadWorldTuning(onChange?: () => void) {
  const tuning = await loadSurvivalTuning();
  if (import.meta.env.DEV) {
    let generation = 0;
    const refresh = async (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.altKey ||
        !event.shiftKey ||
        event.code !== "KeyR"
      )
        return;
      event.preventDefault();
      const current = ++generation;
      const next = await loadSurvivalTuning();
      if (current !== generation) return;
      for (const key of [
        "brightCost",
        "fireCost",
        "hearingTiles",
        "minSpawnRadius",
        "maxSpawnRadius",
        "despawnRadius",
      ] as const)
        tuning[key] = next[key];
      tuning.categoryCap = next.categoryCap;
      onChange?.();
    };
    window.addEventListener("keydown", refresh);
    import.meta.hot?.dispose(() =>
      window.removeEventListener("keydown", refresh),
    );
  }
  return tuning;
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
