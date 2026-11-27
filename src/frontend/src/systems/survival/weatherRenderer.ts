import type { getWeatherModifiers } from "./weatherSystem";
const MAX_PARTICLES = 120;
const REDUCED_PARTICLES = 30;

export function createWeatherRenderer() {
  const pool = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0,
    y: 0,
    speed: 1,
    size: 1,
    opacity: 1,
    landingY: 0,
  }));
  let width = 0;
  let height = 0;
  let kind = "none";
  let context: CanvasRenderingContext2D | null = null;
  let edgeFog: CanvasGradient | null = null;

  function reset(particle: (typeof pool)[number], spread: boolean) {
    particle.x = Math.random() * width;
    particle.y = spread ? Math.random() * height : -8;
    particle.speed = 0.55 + Math.random() * 0.9;
    particle.size = Math.random() < 0.68 ? 1 : 2;
    particle.opacity = 0.35 + Math.random() * 0.6;
    if (kind === "rain") {
      particle.landingY = spread
        ? particle.y + Math.random() * (height - particle.y)
        : Math.random() * height;
    }
  }

  function drawParticle(
    ctx: CanvasRenderingContext2D,
    p: (typeof pool)[number],
    windX: number,
  ) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    ctx.globalAlpha = p.opacity;
    if (kind === "rain") {
      ctx.fillRect(x, y, 1, 5 + p.size * 2);
      ctx.fillRect(x - 1, y + 5, 1, 3);
    } else if (kind === "blizzard") {
      ctx.fillRect(x, y, 3 + p.size, 1);
      ctx.fillRect(x + 2, y - Math.sign(windX), p.size, 1);
    } else if (kind === "fog") {
      ctx.globalAlpha *= 0.12;
      const span = p.size * 15;
      ctx.fillRect(x - span, y, span * 2, 2);
      ctx.fillRect(x - span + 5, y - 2, span * 2 - 10, 2);
    } else ctx.fillRect(x, y, p.size, p.size);
  }

  return {
    updateAndDraw(
      ctx: CanvasRenderingContext2D,
      viewWidth: number,
      viewHeight: number,
      dt: number,
      mods: ReturnType<typeof getWeatherModifiers>,
      reducedMotion: boolean,
      onRainImpact?: (x: number, y: number) => void,
    ) {
      if (width !== viewWidth || height !== viewHeight || context !== ctx) {
        width = viewWidth;
        height = viewHeight;
        context = ctx;
        edgeFog = null;
        for (const p of pool) reset(p, true);
      }
      if (kind !== mods.particleKind) {
        kind = mods.particleKind;
        for (const p of pool) reset(p, true);
      }

      ctx.save();
      if (mods.tintAlpha > 0) {
        const [r, g, b] = mods.tintColor;
        ctx.globalAlpha = mods.tintAlpha;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(0, 0, width, height);
      }
      if (mods.fogAlpha > 0) {
        if (!edgeFog) {
          edgeFog = ctx.createRadialGradient(
            width / 2,
            height / 2,
            Math.min(width, height) * 0.18,
            width / 2,
            height / 2,
            Math.hypot(width, height) / 2,
          );
          edgeFog.addColorStop(0, "rgba(37, 50, 75, 0)");
          edgeFog.addColorStop(1, "rgba(130, 155, 184, 1)");
        }
        ctx.globalAlpha = mods.fogAlpha;
        ctx.fillStyle = edgeFog;
        ctx.fillRect(0, 0, width, height);
      }
      if (kind !== "none") {
        const capacity = reducedMotion ? REDUCED_PARTICLES : MAX_PARTICLES;
        const limit = Math.min(capacity, mods.particleCount);
        ctx.fillStyle =
          kind === "rain" ? "#c1a9d5" : kind === "fog" ? "#afc5d9" : "#dcecff";
        for (let i = 0; i < limit; i++) {
          const p = pool[i];
          p.x += mods.windX * p.speed * dt;
          p.y += mods.fallSpeed * p.speed * dt;
          if (p.x < -8) p.x += width + 16;
          else if (p.x > width + 8) p.x -= width + 16;
          const rainTip = p.y + 4 + p.size * 2;
          if (
            kind === "rain" &&
            dt > 0 &&
            onRainImpact &&
            i % 3 === 0 &&
            rainTip >= p.landingY
          ) {
            if (p.x >= 0 && p.x < width) onRainImpact(p.x, p.landingY);
            reset(p, false);
          } else if (p.y > height + 8) reset(p, false);
          drawParticle(ctx, p, mods.windX);
        }
      }
      ctx.restore();
    },
  };
}
