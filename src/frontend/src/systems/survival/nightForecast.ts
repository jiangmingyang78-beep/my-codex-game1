import { nightWaves, waveSlot } from "../survivalTuning";

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
