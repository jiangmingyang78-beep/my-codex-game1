import { type DioramaState, lerpRgb, rgbCss } from "./seasonsSample";

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

export function drawCabinAndCrops(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const { colors: c, snowCover } = st;
  const cx = 56;
  const cy = 62;
  const shadowDir = Math.round((0.5 - st.seasonProgress) * 10);
  px(g, cx + 4 + shadowDir, cy + 28, 42, 6, rgbCss([18, 22, 38], 0.34));

  // Chimney + rising smoke puffs
  px(g, cx + 33, cy - 8, 7, 14, rgbCss([108, 72, 66]));
  px(g, cx + 32, cy - 9, 9, 2, rgbCss([82, 54, 52]));
  for (let i = 0; i < 4; i++) {
    const age = (timeSec * 0.55 + i * 0.25) % 1;
    const sx = cx + 36 + age * (4 + c.windSpeed * 0.35);
    const sy = cy - 11 - age * 18;
    const size = age > 0.5 ? 5 : 3;
    px(g, sx, sy, size, size - 1, rgbCss([226, 232, 242], (1 - age) * 0.48));
  }

  // Timber cabin body & door
  px(g, cx + 4, cy + 10, 38, 20, rgbCss([118, 78, 52]));
  px(g, cx + 4, cy + 10, 38, 3, rgbCss([84, 54, 38]));
  px(g, cx + 20, cy + 18, 8, 12, rgbCss([72, 46, 32]));
  px(g, cx + 26, cy + 24, 1, 1, rgbCss([236, 198, 114]));

  // Warm candlelit windows intensifying at dusk & night
  const glow = Math.min(1, 0.28 + c.nightStrength * 0.95);
  const winCol = lerpRgb([118, 152, 182], [255, 198, 96], glow);
  px(g, cx + 9, cy + 16, 7, 7, rgbCss([56, 38, 28]));
  px(g, cx + 10, cy + 17, 5, 5, rgbCss(winCol));
  px(g, cx + 30, cy + 16, 7, 7, rgbCss([56, 38, 28]));
  px(g, cx + 31, cy + 17, 5, 5, rgbCss(winCol));

  // Pitched shingle roof + winter snow cap
  const roofBase = lerpRgb([96, 56, 48], [228, 238, 250], snowCover * 0.82);
  for (let r = 0; r < 12; r += 2) {
    px(g, cx + r, cy + 10 - r, 46 - r * 2, 2, rgbCss(roofBase));
  }
  px(g, cx, cy + 10, 46, 2, rgbCss([62, 38, 34]));

  // Fenced seasonal crop plots beside the cabin
  const fx = 104;
  const fy = 82;
  px(g, fx, fy, 34, 12, rgbCss([92, 64, 46]));
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 5; col++) {
      const px0 = fx + 3 + col * 6;
      const py0 = fy + 2 + row * 5;
      if (snowCover > 0.55) {
        px(g, px0, py0 + 1, 4, 2, rgbCss(c.snowCap));
      } else if (c.leafWeight > 0.45) {
        px(g, px0, py0, 4, 3, rgbCss([232, 126, 42]));
        px(g, px0 + 1, py0 - 1, 2, 1, rgbCss([84, 126, 58]));
      } else if (c.fireflyWeight > 0.45) {
        px(g, px0, py0, 4, 3, rgbCss([62, 148, 68]));
        px(g, px0 + 1, py0, 2, 1, rgbCss([230, 74, 92]));
      } else {
        px(g, px0 + 1, py0 + 1, 2, 2, rgbCss([132, 206, 98]));
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    px(g, fx + i * 6, fy - 3, 2, 4, rgbCss([136, 96, 66]));
  }
  px(g, fx, fy - 2, 34, 1, rgbCss([156, 114, 78]));
}

export function drawPine(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  st: DioramaState,
  sway: number,
): void {
  const { colors: c, snowCover } = st;
  px(g, x - 2, y - 5, 4, 6, rgbCss([84, 56, 42]));
  for (let tier = 0; tier < 3; tier++) {
    const w = Math.round((16 - tier * 3) * scale);
    const ty = y - 8 - tier * Math.round(7 * scale);
    const ox = Math.round(sway * (tier + 1) * 0.4);
    px(g, x - w / 2 + ox, ty, w, Math.round(6 * scale), rgbCss(c.pineDark));
    px(
      g,
      x - w / 2 + ox + 2,
      ty - 2,
      Math.max(4, w - 4),
      Math.round(5 * scale),
      rgbCss(c.pineLight),
    );
    if (snowCover > 0.3) {
      px(
        g,
        x - w / 2 + ox + 2,
        ty - 2,
        Math.max(4, w - 4),
        2,
        rgbCss(c.snowCap, Math.min(1, snowCover * 1.1)),
      );
    }
  }
}

export function drawDeciduousTree(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  st: DioramaState,
  sway: number,
): void {
  const { colors: c, snowCover } = st;
  px(g, x - 3, y + 1, 10, 3, rgbCss([18, 22, 38], 0.28));
  px(g, x - 2, y - 12, 4, 14, rgbCss([108, 78, 58]));
  const ox = Math.round(sway);
  if (snowCover > 0.72) {
    px(g, x - 7 + ox, y - 17, 14, 2, rgbCss([108, 78, 58]));
    px(g, x - 5 + ox, y - 21, 10, 2, rgbCss([108, 78, 58]));
    px(g, x - 7 + ox, y - 18, 14, 1, rgbCss(c.snowCap));
    return;
  }
  px(g, x - 11 + ox, y - 24, 22, 13, rgbCss(c.leafDark));
  px(g, x - 9 + ox, y - 28, 18, 13, rgbCss(c.leafMid));
  px(g, x - 6 + ox, y - 29, 12, 7, rgbCss(c.leafLight));
}

export function drawCampfire(
  g: CanvasRenderingContext2D,
  timeSec: number,
): void {
  const fx = 166;
  const fy = 96;
  px(g, fx - 7, fy, 14, 4, rgbCss([78, 86, 106]));
  px(g, fx - 5, fy + 1, 10, 2, rgbCss([44, 34, 38]));
  const flick = Math.floor(timeSec * 10) % 4;
  const h = 7 + (flick % 2) * 2;
  const lean = flick === 1 ? 1 : flick === 3 ? -1 : 0;
  px(g, fx - 4, fy - h + 3, 8, h - 1, rgbCss([238, 102, 34]));
  px(g, fx - 3 + lean, fy - h + 1, 6, h - 2, rgbCss([255, 168, 52]));
  px(g, fx - 1 + lean, fy - h + 4, 3, 4, rgbCss([255, 242, 188]));
}
