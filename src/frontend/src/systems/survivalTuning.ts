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
export async function loadSurvivalTuning() {
  const base = {
    resourceDensity: 1,
    spawnFrequency: 1,
    startingSupplyMultiplier: 1,
  };
  const response = await fetch("./survival-balance.json", {
    cache: "no-store",
  });
  if (response.status === 404) return base;
  if (!response.ok) throw Error("生存配置读取失败");
  const config = await response.json();
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    if (Number.isFinite(config[key]) && config[key] >= 0)
      base[key] = config[key];
  }
  return base;
}
