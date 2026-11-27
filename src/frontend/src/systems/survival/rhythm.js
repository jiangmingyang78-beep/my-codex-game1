import tuning from "../../data/survivalRhythm.json" with { type: "json" };

export const { clock: winter, raid: raidRules } = tuning;

/** The cycle length stays fixed so old elapsed-time saves retain their day number.
 * @param {number} day @param {number} baseDay @param {number} baseNight @param {number} weatherShift
 */
export function winterDay(day, baseDay, baseNight, weatherShift) {
  const cycle = baseDay + baseNight;
  const age = Math.max(0, day - 1);
  const shift =
    Math.min(winter.maxWinterShift, age * winter.nightGrowthPerDay) +
    weatherShift;
  const lit =
    baseDay *
    Math.max(winter.minDaylightShare, 1 + winter.firstDayBonus - shift);
  // Scale the two weights so even very short custom nights have a real boundary.
  const nightWeight =
    baseNight *
    Math.max(winter.minDaylightShare, 1 - winter.firstDayBonus + shift);
  const nightStart = (cycle * lit) / (lit + nightWeight);
  const duskStart = nightStart * (1 - winter.duskShare);
  return {
    day,
    cycle,
    duskStart,
    nightStart,
    cold:
      1 +
      Math.min(winter.maxWinterCold, age * winter.coldGrowthPerDay) +
      weatherShift,
  };
}

/** @param {ReturnType<typeof winterDay>} clock @param {number} time */
export function winterPhase(clock, time) {
  return time < clock.duskStart
    ? "day"
    : time < clock.nightStart
      ? "dusk"
      : "night";
}

/** @param {number} day @param {number} tier @param {number} base @param {number} weather */
export function raidBudget(day, tier, base, weather) {
  if (base <= 0 || weather <= 0) return 0;
  return Math.min(
    raidRules.maxBudget,
    Math.max(
      1,
      Math.round(
        (base +
          (day - 1) * raidRules.budgetPerDay +
          tier * raidRules.budgetPerTier) *
          weather,
      ),
    ),
  );
}
