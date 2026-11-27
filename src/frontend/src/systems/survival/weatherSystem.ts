import { loadDataFiles } from "@/core/gameData";
import { isRecord } from "@/core/saveMigration";
const weatherData = loadDataFiles().weather;

const { defaultWeatherId, transitionDurationSec, weathers } = weatherData;
type WeatherDef = Omit<(typeof weathers)[number], "transitions"> & {
  transitions: Record<string, number>;
};
export type WeatherState = ReturnType<typeof createWeatherState>;
const weatherById = new Map<string, WeatherDef>(
  weathers.map((def) => [def.id, def]),
);
const TAU = Math.PI * 2;

export function getWeatherDef(id = defaultWeatherId) {
  return weatherById.get(id) ?? weatherById.get(defaultWeatherId)!;
}

function nextRoll(state: { rngState: number }, rng?: () => number) {
  if (rng) return Math.max(0, Math.min(1 - Number.EPSILON, rng()));
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

function duration(
  def: WeatherDef,
  state: { rngState: number },
  rng?: () => number,
) {
  const [min, max] = def.durationSec;
  return min + (max - min) * nextRoll(state, rng);
}

export function createWeatherState(seed = 0) {
  const state = {
    weatherId: defaultWeatherId,
    previousWeatherId: defaultWeatherId,
    remainingSec: 0,
    transitionAlpha: 1,
    gustPhase: 0,
    rngState: (seed ^ 0x8c4f5e91) >>> 0,
  };
  state.remainingSec = duration(getWeatherDef(), state);
  return state;
}

function nextWeather(
  def: WeatherDef,
  day: number,
  state: WeatherState,
  rng?: () => number,
) {
  const candidates = weathers.filter(
    (entry) => entry.minDay <= day && def.transitions[entry.id] > 0,
  );
  const total = candidates.reduce(
    (sum, entry) => sum + def.transitions[entry.id],
    0,
  );
  let roll = nextRoll(state, rng) * total;
  for (const entry of candidates) {
    roll -= def.transitions[entry.id];
    if (roll < 0) return entry;
  }
  return getWeatherDef();
}

export function tickWeather(
  state: WeatherState,
  dt: number,
  day: number,
  rng?: () => number,
) {
  if (!Number.isFinite(dt) || dt <= 0) return null;
  state.gustPhase = (state.gustPhase + dt * 0.8) % TAU;
  let event: {
    type: "weather.changed";
    weatherId: string;
    name: string;
  } | null = null;
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(remaining, state.remainingSec);
    state.remainingSec -= step;
    state.transitionAlpha = Math.min(
      1,
      state.transitionAlpha + step / transitionDurationSec,
    );
    if (state.transitionAlpha === 1) state.previousWeatherId = state.weatherId;
    remaining -= step;
    if (state.remainingSec > 0) break;

    const def = nextWeather(getWeatherDef(state.weatherId), day, state, rng);
    state.remainingSec = duration(def, state, rng);
    if (def.id === state.weatherId) continue;
    state.previousWeatherId = state.weatherId;
    state.weatherId = def.id;
    state.transitionAlpha = 0;
    event = { type: "weather.changed", weatherId: def.id, name: def.name };
  }
  return event;
}

export function getWeatherModifiers(state: WeatherState) {
  const current = getWeatherDef(state.weatherId);
  const previous = getWeatherDef(state.previousWeatherId);
  const alpha = state.transitionAlpha;
  const mix = (a: number, b: number) => a + (b - a) * alpha;
  const particle = alpha < 0.5 ? previous : current;
  const particleCount =
    previous.particleKind === current.particleKind
      ? mix(previous.particleCount, current.particleCount)
      : particle.particleCount * Math.abs(2 * alpha - 1);
  return {
    weatherId: current.id,
    name: current.name,
    lightRadiusMult: mix(previous.lightRadiusMult, current.lightRadiusMult),
    fireDrainMult: mix(previous.fireDrainMult, current.fireDrainMult),
    moveSpeedMult: mix(previous.moveSpeedMult, current.moveSpeedMult),
    plantGrowthMult: mix(previous.plantGrowthMult, current.plantGrowthMult),
    spawnRateMult: mix(previous.spawnRateMult, current.spawnRateMult),
    autoWater: current.autoWater,
    blizzard: previous.id === "blizzard" || current.id === "blizzard",
    particleKind: particle.particleKind,
    particleCount: Math.round(particleCount),
    windX:
      mix(previous.windX, current.windX) *
      (1 + Math.sin(state.gustPhase) * 0.18),
    fallSpeed: mix(previous.fallSpeed, current.fallSpeed),
    fogAlpha: mix(previous.fogAlpha, current.fogAlpha),
    tintColor: current.tintColor.map((channel, i) =>
      Math.round(mix(previous.tintColor[i], channel)),
    ),
    tintAlpha: mix(previous.tintAlpha, current.tintAlpha),
  };
}

export function serializeWeather(state: WeatherState) {
  return { ...state };
}

export function deserializeWeather(raw: unknown, seed = 0): WeatherState {
  const state = createWeatherState(seed);
  if (
    !isRecord(raw) ||
    typeof raw.weatherId !== "string" ||
    !weatherById.has(raw.weatherId)
  )
    return state;
  const def = getWeatherDef(raw.weatherId);
  const alpha =
    typeof raw.transitionAlpha === "number" &&
    Number.isFinite(raw.transitionAlpha)
      ? Math.max(0, Math.min(1, raw.transitionAlpha))
      : 1;
  return {
    weatherId: def.id,
    previousWeatherId:
      alpha < 1 &&
      typeof raw.previousWeatherId === "string" &&
      weatherById.has(raw.previousWeatherId)
        ? raw.previousWeatherId
        : def.id,
    remainingSec:
      typeof raw.remainingSec === "number" && Number.isFinite(raw.remainingSec)
        ? Math.max(0, Math.min(def.durationSec[1], raw.remainingSec))
        : duration(def, state),
    transitionAlpha: alpha,
    gustPhase:
      typeof raw.gustPhase === "number" && Number.isFinite(raw.gustPhase)
        ? raw.gustPhase % TAU
        : 0,
    rngState:
      typeof raw.rngState === "number" && Number.isInteger(raw.rngState)
        ? raw.rngState >>> 0
        : state.rngState,
  };
}
