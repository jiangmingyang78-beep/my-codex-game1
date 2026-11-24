import { DIORAMA_H, DIORAMA_W } from "./seasonsData";
import {
  drawCabinAndCrops,
  drawCampfire,
  drawDeciduousTree,
  drawPine,
} from "./seasonsProps";
import { type DioramaState, lerpRgb, rgbCss } from "./seasonsSample";

const HORIZON_Y = 66;
const STARS: readonly (readonly [number, number, number])[] = [
  [18, 9, 0.2],
  [44, 16, 1.4],
  [68, 7, 2.7],
  [95, 19, 0.8],
  [124, 11, 3.1],
  [152, 6, 1.9],
  [180, 18, 0.4],
  [208, 9, 2.3],
  [236, 14, 1.1],
  [264, 7, 3.6],
  [288, 17, 0.7],
  [306, 10, 2.1],
  [54, 28, 1.8],
  [140, 26, 0.5],
  [252, 27, 2.9],
];

const CLOUDS: readonly (readonly [number, number, number, number])[] = [
  [24, 16, 32, 0.36],
  [112, 12, 42, 0.26],
  [206, 20, 28, 0.44],
  [276, 14, 36, 0.3],
];

const px = (
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void => {
  g.fillStyle = fill;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function drawSkyAndBodies(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const { colors: c } = st;
  const bands = 14;
  const bandH = Math.ceil(HORIZON_Y / bands);
  for (let i = 0; i < bands; i++) {
    const f = i / (bands - 1);
    const col =
      f < 0.55
        ? lerpRgb(c.skyTop, c.skyMid, f / 0.55)
        : lerpRgb(c.skyMid, c.skyHorizon, (f - 0.55) / 0.45);
    px(g, 0, i * bandH, DIORAMA_W, bandH + 1, rgbCss(col));
  }

  if (c.nightStrength > 0.22) {
    const starVis = Math.min(1, (c.nightStrength - 0.22) / 0.55);
    for (const [sx, sy, phase] of STARS) {
      const twinkle = 0.45 + 0.55 * Math.sin(timeSec * 2.4 + phase);
      px(g, sx, sy, 1, 1, rgbCss([228, 240, 255], starVis * twinkle));
    }
    if (st.snowCover > 0.35) {
      const aura = (st.snowCover - 0.35) * 0.22;
      for (let x = 20; x < 300; x += 4) {
        const wave = Math.sin(x * 0.035 + timeSec * 0.7) * 5;
        px(g, x, 14 + wave, 4, 8, rgbCss([110, 224, 198], aura));
      }
    }
  }

  const orbX = 54 + ((st.seasonIndex + st.seasonProgress) / 4) * 212;
  const orbY = 48 - Math.abs(c.sunElevation) * 32;
  if (c.sunElevation >= 0) {
    px(g, orbX - 8, orbY - 8, 16, 16, rgbCss([255, 228, 152], 0.28));
    px(g, orbX - 5, orbY - 5, 10, 10, rgbCss([255, 240, 188]));
    px(g, orbX - 3, orbY - 3, 6, 6, rgbCss([255, 252, 232]));
  } else {
    px(g, orbX - 6, orbY - 6, 12, 12, rgbCss([190, 218, 255], 0.18));
    px(g, orbX - 4, orbY - 4, 8, 8, rgbCss([232, 244, 255]));
    px(g, orbX - 1, orbY - 4, 4, 5, rgbCss(c.skyTop));
  }

  for (const [baseX, baseY, width, speed] of CLOUDS) {
    const x =
      ((baseX + timeSec * (6 + c.windSpeed * 0.25) * speed) %
        (DIORAMA_W + width + 24)) -
      width;
    const cloudCol = rgbCss(c.cloud, 0.85);
    const shadeCol = rgbCss(lerpRgb(c.cloud, c.skyMid, 0.38), 0.85);
    px(g, x + 4, baseY, width - 8, 4, cloudCol);
    px(g, x, baseY + 3, width, 4, cloudCol);
    px(g, x + 2, baseY + 6, width - 4, 2, shadeCol);
  }
}

function drawMountains(g: CanvasRenderingContext2D, st: DioramaState): void {
  const { colors: c, snowCover } = st;
  const drawRange = (
    peaks: readonly (readonly [number, number, number])[],
    base: readonly [number, number, number],
    snowThreshold: number,
  ) => {
    for (const [cx, topY, halfW] of peaks) {
      for (let y = topY; y < HORIZON_Y; y += 2) {
        const ratio = (y - topY) / (HORIZON_Y - topY);
        const w = Math.max(4, Math.round(halfW * ratio * 2));
        const col = ratio < snowThreshold + snowCover * 0.45 ? c.snowCap : base;
        px(g, cx - w / 2, y, w, 2, rgbCss(col));
      }
    }
  };
  drawRange(
    [
      [28, 26, 62],
      [104, 18, 84],
      [194, 24, 78],
      [278, 20, 74],
    ],
    c.farMountain,
    0.28,
  );
  drawRange(
    [
      [62, 40, 56],
      [154, 34, 66],
      [244, 38, 62],
    ],
    c.midMountain,
    0.2,
  );
}

function drawGroundAndPond(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const { colors: c, snowCover } = st;
  px(g, 0, HORIZON_Y, DIORAMA_W, DIORAMA_H - HORIZON_Y, rgbCss(c.groundMain));
  px(g, 0, HORIZON_Y, DIORAMA_W, 4, rgbCss(c.groundShade));
  px(
    g,
    0,
    88,
    DIORAMA_W,
    36,
    rgbCss(lerpRgb(c.groundMain, c.groundShade, 0.25)),
  );
  for (let i = 0; i < 42; i++) {
    const py = HORIZON_Y + 12 + i;
    const width = 18 + i * 0.45;
    px(
      g,
      148 + Math.sin(i * 0.08) * 14 - width / 2,
      py,
      width,
      2,
      rgbCss(c.path),
    );
  }
  for (let i = 0; i < 24; i++) {
    const gx = (i * 37 + 13) % (DIORAMA_W - 8);
    const gy = HORIZON_Y + 6 + ((i * 19) % 48);
    if (gx > 205 && gy > 74 && gy < 110) continue;
    px(g, gx, gy, 3, 2, rgbCss(c.groundAccent));
    if (c.petalWeight > 0.4 && i % 3 === 0) {
      px(g, gx + 1, gy - 1, 2, 1, rgbCss([252, 198, 214]));
    }
  }

  const pondX = 222;
  const pondY = 82;
  px(g, pondX - 2, pondY - 2, 74, 24, rgbCss(c.groundShade));
  px(g, pondX, pondY, 70, 20, rgbCss(c.water));
  px(g, pondX + 6, pondY - 3, 56, 4, rgbCss(c.water));
  px(g, pondX + 8, pondY + 18, 52, 4, rgbCss(c.water));
  if (snowCover > 0.65) {
    px(g, pondX + 10, pondY + 5, 16, 1, rgbCss(c.waterHighlight, 0.8));
    px(g, pondX + 36, pondY + 11, 20, 1, rgbCss(c.waterHighlight, 0.8));
    px(g, pondX + 26, pondY + 6, 1, 6, rgbCss(c.waterHighlight, 0.55));
  } else {
    for (let s = 0; s < 5; s++) {
      const shimmerX = pondX + 8 + ((s * 13 + Math.floor(timeSec * 8)) % 54);
      px(g, shimmerX, pondY + 3 + s * 3, 7, 1, rgbCss(c.waterHighlight, 0.72));
    }
  }
}

/** Renders the full layered Stardew-inspired homestead scene for the current season. */
export function drawSeasonalScene(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  drawSkyAndBodies(g, st, timeSec);
  drawMountains(g, st);
  drawGroundAndPond(g, st, timeSec);
  const sway = Math.sin(timeSec * (1.6 + st.colors.windSpeed * 0.03)) * 1.4;
  drawPine(g, 18, 82, 1.15, st, sway);
  drawDeciduousTree(g, 36, 86, st, sway);
  drawPine(g, 198, 78, 0.95, st, -sway * 0.8);
  drawCabinAndCrops(g, st, timeSec);
  drawCampfire(g, timeSec);
  drawDeciduousTree(g, 294, 88, st, sway);
  drawPine(g, 308, 96, 1.1, st, sway * 1.1);
}
