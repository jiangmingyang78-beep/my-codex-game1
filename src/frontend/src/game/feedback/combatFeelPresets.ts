import type { ObjectKind } from "@/systems/world/worldTypes";
import { RENDER_DEPTH } from "../renderDepth";

export type WindupTimerMode = "remaining" | "elapsed";

export interface HitstopPreset {
  heroStrikeMs: number;
  killMs: number;
  heroHurtMs: number;
  globalCooldownMs: number;
}

export interface ShakeSpec {
  intensity: number;
  durationMs: number;
}

export interface ShakePreset {
  heroStrike: ShakeSpec;
  kill: ShakeSpec;
  heroHurt: ShakeSpec;
  blast: ShakeSpec;
}

export interface InputBufferPreset {
  attackMs: number;
  dashMs: number;
  interactMs: number;
}

export interface TelegraphPreset {
  windupTimerMode: WindupTimerMode;
  groundDepth: number;
  fillColor: number;
  borderColor: number;
  commitFlashColor: number;
  commitWindowSec: number;
  fillAlpha: number;
  progressAlpha: number;
  lineWidthPx: number;
  projectileAimAlpha: number;
}

export interface QolPreset {
  damagePoolSize: number;
  fontFamily: string;
  fontSize: string;
  interactDepth: number;
  interactColors: Partial<Record<ObjectKind, number>>;
  interactDefaultColor: number;
  bossPointerDepth: number;
  bossPointerColor: number;
  bossPointerMarginPx: number;
}

export interface CombatFeelPresets {
  hitstop: HitstopPreset;
  shake: ShakePreset;
  inputBuffer: InputBufferPreset;
  telegraph: TelegraphPreset;
  qol: QolPreset;
}

export const COMBAT_FEEL_PRESETS: CombatFeelPresets = {
  hitstop: {
    heroStrikeMs: 32,
    killMs: 55,
    heroHurtMs: 65,
    globalCooldownMs: 120,
  },
  shake: {
    heroStrike: { intensity: 0.0022, durationMs: 65 },
    kill: { intensity: 0.0042, durationMs: 95 },
    heroHurt: { intensity: 0.0065, durationMs: 130 },
    blast: { intensity: 0.008, durationMs: 170 },
  },
  inputBuffer: {
    attackMs: 140,
    dashMs: 140,
    interactMs: 110,
  },
  telegraph: {
    windupTimerMode: "remaining",
    groundDepth: RENDER_DEPTH.telegraph,
    fillColor: 0xc92a2a,
    borderColor: 0xff6b6b,
    commitFlashColor: 0xffffff,
    commitWindowSec: 0.1,
    fillAlpha: 0.24,
    progressAlpha: 0.44,
    lineWidthPx: 26,
    projectileAimAlpha: 0.7,
  },
  qol: {
    damagePoolSize: 28,
    fontFamily: '"PixelZH", monospace',
    fontSize: "16px",
    interactDepth: RENDER_DEPTH.interact,
    interactColors: {
      campfire: 0xffd166,
      gate: 0xffd166,
      beacon: 0xffd166,
      node: 0x7fe7ff,
      explosive_barrel: 0xff8c1a,
      story_prop: 0xa5c8ff,
      relay_socket: 0x9be7ff,
      mirror_lamp: 0xfff3b0,
    },
    interactDefaultColor: 0xffffff,
    bossPointerDepth: RENDER_DEPTH.bossPointer,
    bossPointerColor: 0xff5a5a,
    bossPointerMarginPx: 22,
  },
};
