import { DIORAMA_H, DIORAMA_W } from "./seasonsData";
import { type DioramaState, rgbCss } from "./seasonsSample";

interface ParticleSeed {
  x: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
  tint: number;
}

const SEEDS: readonly ParticleSeed[] = Array.from({ length: 68 }, (_, i) => {
  const hash = (n: number) => {
    let v = Math.imul(n + 37, 2654435761) >>> 0;
    v = (v ^ (v >>> 13)) >>> 0;
    return (v % 1000) / 1000;
  };
  return {
    x: hash(i * 5 + 1),
    y: hash(i * 5 + 2),
    speed: 0.65 + hash(i * 5 + 3) * 0.85,
    phase: hash(i * 5 + 4) * Math.PI * 2,
    size: hash(i * 5 + 5) > 0.72 ? 2 : 1,
    tint: i % 3,
  };
});

function drawSunbeams(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const w = st.colors.sunbeamWeight * (0.65 + 0.35 * st.daylightPulse);
  if (w < 0.05) return;
  g.save();
  for (let i = 0; i < 3; i++) {
    const sx = 64 + i * 74 + Math.sin(timeSec * 0.4 + i) * 8;
    const grad = g.createLinearGradient(sx, 0, sx + 38, DIORAMA_H);
    grad.addColorStop(0, rgbCss([255, 240, 186], w * 0.22));
    grad.addColorStop(1, rgbCss([255, 240, 186], 0));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(sx, 0);
    g.lineTo(sx + 26, 0);
    g.lineTo(sx + 68, DIORAMA_H);
    g.lineTo(sx + 34, DIORAMA_H);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function drawWeatherParticles(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const { colors: c } = st;

  // Spring blossom petals
  if (c.petalWeight > 0.05) {
    const count = Math.floor(26 * c.petalWeight);
    for (let i = 0; i < count; i++) {
      const p = SEEDS[i];
      const x =
        (((p.x * DIORAMA_W + timeSec * (18 + c.windSpeed * 0.4) * p.speed) %
          DIORAMA_W) +
          DIORAMA_W) %
        DIORAMA_W;
      const y =
        (p.y * DIORAMA_H +
          timeSec * 14 * p.speed +
          Math.sin(timeSec * 3 + p.phase) * 3) %
        DIORAMA_H;
      const col =
        p.tint === 0
          ? [255, 206, 224]
          : p.tint === 1
            ? [255, 174, 202]
            : [255, 236, 242];
      g.fillStyle = rgbCss(col as [number, number, number], c.petalWeight);
      g.fillRect(Math.round(x), Math.round(y), 2, 1);
    }
  }

  // Spring gentle rain + pond splash rings
  if (c.rainWeight > 0.08) {
    const count = Math.floor(32 * c.rainWeight);
    g.fillStyle = rgbCss([198, 226, 248], c.rainWeight * 0.55);
    for (let i = 0; i < count; i++) {
      const p = SEEDS[(i + 17) % SEEDS.length];
      const x =
        (((p.x * DIORAMA_W - timeSec * 36 * p.speed) % DIORAMA_W) + DIORAMA_W) %
        DIORAMA_W;
      const y = (p.y * DIORAMA_H + timeSec * 135 * p.speed) % DIORAMA_H;
      g.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    const rippleAge = (timeSec * 2.2) % 1;
    const rx = 248 + (Math.floor(timeSec * 2.2) % 3) * 12;
    g.strokeStyle = rgbCss(
      [212, 238, 255],
      (1 - rippleAge) * c.rainWeight * 0.6,
    );
    g.lineWidth = 1;
    g.strokeRect(
      Math.round(rx - rippleAge * 5),
      Math.round(91 - rippleAge * 2),
      Math.round(2 + rippleAge * 10),
      Math.round(1 + rippleAge * 4),
    );
  }

  // Summer glowing fireflies
  if (c.fireflyWeight > 0.05) {
    const count = Math.floor(20 * c.fireflyWeight);
    for (let i = 0; i < count; i++) {
      const p = SEEDS[(i + 29) % SEEDS.length];
      const x =
        16 +
        ((p.x * 288 + Math.sin(timeSec * 0.8 * p.speed + p.phase) * 18) % 288);
      const y = 64 + p.y * 52 + Math.cos(timeSec * 1.4 + p.phase) * 5;
      const pulse =
        0.25 + 0.75 * Math.max(0, Math.sin(timeSec * 3.6 + p.phase));
      const a = pulse * c.fireflyWeight;
      g.fillStyle = rgbCss([214, 255, 134], a * 0.35);
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle = rgbCss([252, 255, 198], a);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  // Autumn tumbling leaves + drifting valley fog
  if (c.leafWeight > 0.05) {
    const count = Math.floor(28 * c.leafWeight);
    for (let i = 0; i < count; i++) {
      const p = SEEDS[(i + 11) % SEEDS.length];
      const x =
        (((p.x * DIORAMA_W + timeSec * (26 + c.windSpeed * 0.5) * p.speed) %
          DIORAMA_W) +
          DIORAMA_W) %
        DIORAMA_W;
      const y =
        (p.y * DIORAMA_H +
          timeSec * 18 * p.speed +
          Math.sin(timeSec * 4 + p.phase) * 4) %
        DIORAMA_H;
      const col =
        p.tint === 0
          ? [242, 152, 54]
          : p.tint === 1
            ? [214, 78, 44]
            : [248, 206, 82];
      g.fillStyle = rgbCss(col as [number, number, number], c.leafWeight);
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }

  // Winter layered snowflakes & diagonal wind streaks
  if (c.snowWeight > 0.05) {
    const count = Math.floor(54 * c.snowWeight);
    for (let i = 0; i < count; i++) {
      const p = SEEDS[i];
      const x =
        (((p.x * DIORAMA_W - timeSec * (22 + c.windSpeed * 0.85) * p.speed) %
          DIORAMA_W) +
          DIORAMA_W) %
        DIORAMA_W;
      const y = (p.y * DIORAMA_H + timeSec * 36 * p.speed) % DIORAMA_H;
      g.fillStyle = rgbCss(
        [234, 244, 255],
        c.snowWeight * (p.size > 1 ? 0.92 : 0.62),
      );
      g.fillRect(Math.round(x), Math.round(y), p.size, p.size);
    }
  }

  // Soft drifting mist bands (autumn fog / winter frost haze)
  if (c.fogAlpha > 0.04) {
    for (let b = 0; b < 3; b++) {
      const fx = ((b * 120 + timeSec * (8 + b * 4)) % (DIORAMA_W + 110)) - 110;
      g.fillStyle = rgbCss([208, 222, 240], c.fogAlpha * 0.45);
      g.fillRect(Math.round(fx), 62 + b * 14, 110, 7);
    }
  }

  // Rising campfire embers (always alive, brightest at night)
  for (let i = 0; i < 10; i++) {
    const age = (timeSec * 0.75 + i * 0.1) % 1;
    const ex =
      166 + Math.sin(timeSec * 4 + i * 2.1) * 5 + age * c.windSpeed * 0.2;
    const ey = 90 - age * 26;
    const col = age < 0.45 ? [255, 218, 112] : [255, 118, 46];
    g.fillStyle = rgbCss(col as [number, number, number], (1 - age) * 0.95);
    g.fillRect(Math.round(ex), Math.round(ey), 1, 1);
  }
}

function drawLightingPass(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  const { colors: c } = st;
  // Seasonal atmospheric wash & night dimming
  if (c.ambientAlpha > 0.01) {
    g.fillStyle = rgbCss(c.ambientTint, c.ambientAlpha);
    g.fillRect(0, 0, DIORAMA_W, DIORAMA_H);
  }
  if (c.nightStrength > 0.12) {
    g.fillStyle = rgbCss([12, 18, 42], c.nightStrength * 0.42);
    g.fillRect(0, 0, DIORAMA_W, DIORAMA_H);
  }

  // Warm radial firelight pool around the hearth & cabin windows
  const flicker = 0.92 + 0.08 * Math.sin(timeSec * 13);
  const fireStrength = (0.22 + c.nightStrength * 0.62) * flicker;
  const fireRadius = 42 + c.nightStrength * 26;
  const fireGrad = g.createRadialGradient(166, 94, 4, 166, 94, fireRadius);
  fireGrad.addColorStop(0, rgbCss([255, 178, 72], fireStrength * 0.65));
  fireGrad.addColorStop(0.5, rgbCss([255, 118, 44], fireStrength * 0.25));
  fireGrad.addColorStop(1, rgbCss([255, 118, 44], 0));
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = fireGrad;
  g.fillRect(166 - fireRadius, 94 - fireRadius, fireRadius * 2, fireRadius * 2);

  if (c.nightStrength > 0.25) {
    const winGrad = g.createRadialGradient(78, 82, 2, 78, 82, 28);
    winGrad.addColorStop(0, rgbCss([255, 196, 96], c.nightStrength * 0.42));
    winGrad.addColorStop(1, rgbCss([255, 196, 96], 0));
    g.fillStyle = winGrad;
    g.fillRect(50, 54, 56, 56);
  }
  g.restore();
}

/** Draws sunbeams, seasonal weather particles, campfire embers and dynamic lighting. */
export function drawSeasonalAtmosphere(
  g: CanvasRenderingContext2D,
  st: DioramaState,
  timeSec: number,
): void {
  drawSunbeams(g, st, timeSec);
  drawWeatherParticles(g, st, timeSec);
  drawLightingPass(g, st, timeSec);
}
