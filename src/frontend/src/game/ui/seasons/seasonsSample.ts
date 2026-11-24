import {
  type Rgb,
  SEASONS,
  SEASON_DURATION_SEC,
  type SeasonColors,
  TOTAL_CYCLE_SEC,
} from "./seasonsData";

export interface DioramaState {
  seasonIndex: number;
  nextIndex: number;
  seasonProgress: number;
  blend: number;
  colors: SeasonColors;
  daylightPulse: number;
  snowCover: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export function rgbCss(c: Rgb, alpha = 1): string {
  return alpha >= 0.999
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
}

/** Smoothly samples the blended seasonal colors and atmospheric weights at `cycleSec`. */
export function sampleDioramaState(cycleSec: number): DioramaState {
  const wrapped =
    ((cycleSec % TOTAL_CYCLE_SEC) + TOTAL_CYCLE_SEC) % TOTAL_CYCLE_SEC;
  const seasonIndex = Math.floor(wrapped / SEASON_DURATION_SEC) % 4;
  const nextIndex = (seasonIndex + 1) % 4;
  const seasonProgress =
    (wrapped - seasonIndex * SEASON_DURATION_SEC) / SEASON_DURATION_SEC;
  const blend = smoothstep(
    Math.min(1, Math.max(0, (seasonProgress - 0.68) / 0.32)),
  );

  const a = SEASONS[seasonIndex].palette;
  const b = SEASONS[nextIndex].palette;
  const colors: SeasonColors = {
    skyTop: lerpRgb(a.skyTop, b.skyTop, blend),
    skyMid: lerpRgb(a.skyMid, b.skyMid, blend),
    skyHorizon: lerpRgb(a.skyHorizon, b.skyHorizon, blend),
    farMountain: lerpRgb(a.farMountain, b.farMountain, blend),
    midMountain: lerpRgb(a.midMountain, b.midMountain, blend),
    snowCap: lerpRgb(a.snowCap, b.snowCap, blend),
    cloud: lerpRgb(a.cloud, b.cloud, blend),
    groundMain: lerpRgb(a.groundMain, b.groundMain, blend),
    groundShade: lerpRgb(a.groundShade, b.groundShade, blend),
    groundAccent: lerpRgb(a.groundAccent, b.groundAccent, blend),
    path: lerpRgb(a.path, b.path, blend),
    water: lerpRgb(a.water, b.water, blend),
    waterHighlight: lerpRgb(a.waterHighlight, b.waterHighlight, blend),
    pineLight: lerpRgb(a.pineLight, b.pineLight, blend),
    pineDark: lerpRgb(a.pineDark, b.pineDark, blend),
    leafLight: lerpRgb(a.leafLight, b.leafLight, blend),
    leafMid: lerpRgb(a.leafMid, b.leafMid, blend),
    leafDark: lerpRgb(a.leafDark, b.leafDark, blend),
    ambientTint: lerpRgb(a.ambientTint, b.ambientTint, blend),
    ambientAlpha: lerp(a.ambientAlpha, b.ambientAlpha, blend),
    nightStrength: lerp(a.nightStrength, b.nightStrength, blend),
    sunElevation: lerp(a.sunElevation, b.sunElevation, blend),
    windSpeed: lerp(a.windSpeed, b.windSpeed, blend),
    fogAlpha: lerp(a.fogAlpha, b.fogAlpha, blend),
    rainWeight: lerp(a.rainWeight, b.rainWeight, blend),
    petalWeight: lerp(a.petalWeight, b.petalWeight, blend),
    fireflyWeight: lerp(a.fireflyWeight, b.fireflyWeight, blend),
    leafWeight: lerp(a.leafWeight, b.leafWeight, blend),
    snowWeight: lerp(a.snowWeight, b.snowWeight, blend),
    sunbeamWeight: lerp(a.sunbeamWeight, b.sunbeamWeight, blend),
  };

  return {
    seasonIndex,
    nextIndex,
    seasonProgress,
    blend,
    colors,
    daylightPulse: Math.sin(seasonProgress * Math.PI),
    snowCover: Math.min(1, colors.snowWeight * 1.15),
  };
}
