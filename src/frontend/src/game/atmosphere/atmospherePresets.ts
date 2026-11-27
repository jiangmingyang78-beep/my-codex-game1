import { RENDER_DEPTH } from "../renderDepth";

export interface FlamePalette {
  core: number;
  mid: number;
  ember: number;
}

export const ATMOSPHERE_PRESETS = {
  flamePalette: { core: 0xffe49e, mid: 0xff9b3d, ember: 0xff5e2b },
  nightTint: { duskColor: 0x302740, nightColor: 0x16233e, maxNightAlpha: 0.72 },
  flicker: {
    speedA: 7.3,
    speedB: 13.7,
    radiusJitterPx: 2,
    alphaJitter: 0.06,
    lowLightThreshold: 0.25,
  },
  slash: {
    durationMs: 115,
    coreColor: 0xfff3d1,
    trailColor: 0xffa94d,
    depth: RENDER_DEPTH.slash,
  },
  dashGhost: {
    poolSize: 8,
    spawnIntervalMs: 36,
    fadeDurationMs: 185,
    tint: 0x7cc8ff,
    startAlpha: 0.52,
  },
  footprints: {
    maxCount: 48,
    stepDistancePx: 14,
    holdSec: 2.4,
    fadeSec: 1.4,
    color: 0x7f93ad,
    alpha: 0.42,
    depth: RENDER_DEPTH.footprints,
  },
  vignette: {
    lowLightColor: 0x0b1a33,
    maxAlpha: 0.42,
    depth: RENDER_DEPTH.vignette,
  },
};
