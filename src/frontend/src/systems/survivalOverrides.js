import schema from "../../public/survival-balance.schema.json" with {
  type: "json",
};

/** @typedef {typeof import("../data/balance.json").survival} SurvivalTuning */

/** @param {SurvivalTuning} defaults @param {unknown} overrides @returns {SurvivalTuning} */
export function resolveSurvivalTuning(defaults, overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    throw new Error("survival-balance.json: expected an object");
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(schema.properties, key))
      throw new Error(`survival-balance.json.${key}: unknown multiplier`);
    if (key === "categoryCap") {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("survival-balance.json.categoryCap");
      const caps = { ...defaults.categoryCap };
      for (const [name, cap] of Object.entries(value)) {
        if (!Object.hasOwn(caps, name) || !Number.isSafeInteger(cap) || cap < 0)
          throw new Error(`survival-balance.json.categoryCap.${name}`);
        caps[/** @type {keyof typeof caps} */ (name)] = cap;
      }
      result.categoryCap = caps;
      continue;
    }
    const field = /** @type {Exclude<keyof SurvivalTuning,"categoryCap">} */ (
      key
    );
    const positive = "exclusiveMinimum" in schema.properties[field];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (positive ? value <= 0 : value < 0)
    )
      throw new Error(
        `survival-balance.json.${key}: expected a finite ${positive ? "positive" : "nonnegative"} multiplier`,
      );
    result[field] = value;
  }
  if (
    !(
      result.minSpawnRadius < result.maxSpawnRadius &&
      result.maxSpawnRadius < result.despawnRadius
    )
  )
    throw new Error(
      "survival-balance.json: expected minSpawnRadius < maxSpawnRadius < despawnRadius",
    );
  return result;
}

/** Effective rules shared by the live simulation and the offline report.
 * @param {SurvivalTuning} tuning
 */
export function survivalRates(tuning) {
  const daySec = 120 * tuning.dayDurationMultiplier;
  const nightSec = 72 * tuning.nightDurationMultiplier;
  return {
    daySec,
    nightSec,
    wildRegrowthSec: (daySec + nightSec) / tuning.resourceRefreshMultiplier,
    idleHungerPerSec: 0.3 * tuning.hungerRateMultiplier,
    movingHungerPerSec: 0.42 * tuning.hungerRateMultiplier,
    coldHungerPerSec: tuning.coldHungerPerSecond,
    clearNightWaveSize: 3 * tuning.spawnDensity,
  };
}
