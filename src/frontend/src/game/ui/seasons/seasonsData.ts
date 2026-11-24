/** Color palettes and timing constants for the 4-season survival diorama. */

export type SeasonId = "spring" | "summer" | "autumn" | "winter";
export type Rgb = readonly [number, number, number];

export interface SeasonColors {
  skyTop: Rgb;
  skyMid: Rgb;
  skyHorizon: Rgb;
  farMountain: Rgb;
  midMountain: Rgb;
  snowCap: Rgb;
  cloud: Rgb;
  groundMain: Rgb;
  groundShade: Rgb;
  groundAccent: Rgb;
  path: Rgb;
  water: Rgb;
  waterHighlight: Rgb;
  pineLight: Rgb;
  pineDark: Rgb;
  leafLight: Rgb;
  leafMid: Rgb;
  leafDark: Rgb;
  ambientTint: Rgb;
  ambientAlpha: number;
  nightStrength: number;
  sunElevation: number;
  windSpeed: number;
  fogAlpha: number;
  rainWeight: number;
  petalWeight: number;
  fireflyWeight: number;
  leafWeight: number;
  snowWeight: number;
  sunbeamWeight: number;
}

export interface SeasonMeta {
  id: SeasonId;
  shortLabel: string;
  title: string;
  weatherLabel: string;
  timeLabel: string;
  palette: SeasonColors;
}

export const DIORAMA_W = 320;
export const DIORAMA_H = 124;
export const SEASON_DURATION_SEC = 9;
export const TOTAL_CYCLE_SEC = SEASON_DURATION_SEC * 4;

export const SEASONS: readonly SeasonMeta[] = [
  {
    id: "spring",
    shortLabel: "春",
    title: "春 · 融雪樱雨",
    weatherLabel: "落英微雨",
    timeLabel: "晨光",
    palette: {
      skyTop: [72, 128, 196],
      skyMid: [134, 186, 224],
      skyHorizon: [242, 214, 194],
      farMountain: [96, 124, 166],
      midMountain: [72, 108, 126],
      snowCap: [232, 240, 248],
      cloud: [246, 238, 240],
      groundMain: [94, 152, 92],
      groundShade: [68, 118, 72],
      groundAccent: [134, 188, 104],
      path: [164, 134, 102],
      water: [64, 138, 182],
      waterHighlight: [176, 224, 242],
      pineLight: [64, 128, 86],
      pineDark: [36, 82, 58],
      leafLight: [248, 178, 200],
      leafMid: [228, 138, 168],
      leafDark: [164, 92, 124],
      ambientTint: [255, 220, 210],
      ambientAlpha: 0.06,
      nightStrength: 0.08,
      sunElevation: 0.72,
      windSpeed: 16,
      fogAlpha: 0.05,
      rainWeight: 0.65,
      petalWeight: 1,
      fireflyWeight: 0,
      leafWeight: 0,
      snowWeight: 0,
      sunbeamWeight: 0.45,
    },
  },
  {
    id: "summer",
    shortLabel: "夏",
    title: "夏 · 暖风萤夜",
    weatherLabel: "晴暖萤火",
    timeLabel: "薄暮",
    palette: {
      skyTop: [36, 74, 148],
      skyMid: [76, 128, 188],
      skyHorizon: [246, 188, 124],
      farMountain: [66, 94, 138],
      midMountain: [48, 88, 92],
      snowCap: [178, 196, 214],
      cloud: [252, 222, 184],
      groundMain: [70, 132, 74],
      groundShade: [46, 98, 56],
      groundAccent: [110, 168, 84],
      path: [152, 122, 86],
      water: [44, 114, 160],
      waterHighlight: [244, 212, 152],
      pineLight: [48, 112, 72],
      pineDark: [26, 68, 46],
      leafLight: [96, 176, 86],
      leafMid: [62, 136, 64],
      leafDark: [36, 88, 48],
      ambientTint: [255, 190, 110],
      ambientAlpha: 0.09,
      nightStrength: 0.34,
      sunElevation: 0.48,
      windSpeed: 11,
      fogAlpha: 0.03,
      rainWeight: 0,
      petalWeight: 0,
      fireflyWeight: 1,
      leafWeight: 0,
      snowWeight: 0,
      sunbeamWeight: 0.85,
    },
  },
  {
    id: "autumn",
    shortLabel: "秋",
    title: "秋 · 霜枫雾岚",
    weatherLabel: "秋风落叶",
    timeLabel: "日暮",
    palette: {
      skyTop: [54, 48, 98],
      skyMid: [152, 86, 102],
      skyHorizon: [242, 146, 84],
      farMountain: [82, 64, 96],
      midMountain: [74, 58, 76],
      snowCap: [224, 198, 184],
      cloud: [246, 176, 128],
      groundMain: [148, 112, 64],
      groundShade: [110, 78, 46],
      groundAccent: [188, 142, 74],
      path: [132, 98, 72],
      water: [66, 92, 124],
      waterHighlight: [244, 174, 114],
      pineLight: [64, 98, 72],
      pineDark: [36, 62, 48],
      leafLight: [242, 162, 58],
      leafMid: [212, 96, 48],
      leafDark: [138, 52, 38],
      ambientTint: [232, 126, 68],
      ambientAlpha: 0.14,
      nightStrength: 0.46,
      sunElevation: 0.24,
      windSpeed: 28,
      fogAlpha: 0.24,
      rainWeight: 0,
      petalWeight: 0,
      fireflyWeight: 0,
      leafWeight: 1,
      snowWeight: 0,
      sunbeamWeight: 0.3,
    },
  },
  {
    id: "winter",
    shortLabel: "冬",
    title: "冬 · 雪夜孤火",
    weatherLabel: "细雪暴风",
    timeLabel: "星夜",
    palette: {
      skyTop: [16, 22, 46],
      skyMid: [30, 42, 78],
      skyHorizon: [62, 82, 122],
      farMountain: [40, 52, 84],
      midMountain: [32, 46, 72],
      snowCap: [216, 232, 248],
      cloud: [112, 134, 170],
      groundMain: [194, 212, 232],
      groundShade: [142, 164, 194],
      groundAccent: [228, 240, 252],
      path: [130, 140, 162],
      water: [128, 166, 202],
      waterHighlight: [224, 242, 255],
      pineLight: [78, 114, 128],
      pineDark: [34, 58, 76],
      leafLight: [196, 214, 234],
      leafMid: [132, 150, 176],
      leafDark: [72, 86, 112],
      ambientTint: [82, 112, 176],
      ambientAlpha: 0.16,
      nightStrength: 0.88,
      sunElevation: -0.22,
      windSpeed: 44,
      fogAlpha: 0.16,
      rainWeight: 0,
      petalWeight: 0,
      fireflyWeight: 0,
      leafWeight: 0,
      snowWeight: 1,
      sunbeamWeight: 0,
    },
  },
];
