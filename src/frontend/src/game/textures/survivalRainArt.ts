import { SURVIVAL_TILE_SIZE as TILE_SIZE } from "@/systems/survival/survivalBiomes";

export type RainSurface = "water" | "rock" | "grass" | "ice";

const DURATION: Record<RainSurface, number> = {
  water: 0.38,
  rock: 0.19,
  grass: 0.8,
  ice: 0.24,
};
const MAX_IMPACTS = 32;

export function createSurvivalRainArt() {
  const impacts = Array.from({ length: MAX_IMPACTS }, () => ({
    x: 0,
    y: 0,
    age: Number.POSITIVE_INFINITY,
    surface: "water" as RainSurface,
  }));
  let next = 0;

  return {
    land(x: number, y: number, surface: RainSurface) {
      const impact = impacts[next];
      impact.x = Math.floor(x);
      impact.y = Math.floor(y);
      impact.surface = surface;
      impact.age = 0;
      next = (next + 1) % impacts.length;
    },
    clear() {
      for (const impact of impacts) impact.age = Number.POSITIVE_INFINITY;
      next = 0;
    },
    updateAndDraw(ctx: CanvasRenderingContext2D, dt: number) {
      for (const impact of impacts) {
        const { x, y, surface } = impact;
        const duration = DURATION[surface];
        if (impact.age >= duration) continue;
        impact.age += dt;
        const progress = impact.age / duration;
        if (progress >= 1) continue;

        ctx.save();
        ctx.beginPath();
        ctx.rect(
          Math.floor(x / TILE_SIZE) * TILE_SIZE,
          Math.floor(y / TILE_SIZE) * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
        ctx.clip();
        ctx.globalAlpha = 1 - progress;

        if (surface === "water") {
          const radius = 1 + Math.floor(progress * 3);
          ctx.fillStyle = "#b9d6e6";
          ctx.fillRect(x - radius + 1, y - 1, radius * 2 - 1, 1);
          ctx.fillRect(x - radius + 1, y + 1, radius * 2 - 1, 1);
          ctx.fillRect(x - radius, y, 1, 1);
          ctx.fillRect(x + radius, y, 1, 1);
        } else if (surface === "rock") {
          const spread = 1 + Math.floor(progress * 3);
          const rise = progress < 0.55 ? spread : 3 - spread;
          ctx.fillStyle = "#e9cfe0";
          ctx.fillRect(x - spread, y - rise, 1, 1);
          ctx.fillRect(x + spread, y - rise + 1, 1, 1);
        } else if (surface === "ice") {
          ctx.fillStyle = "#dceef1";
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 1);
        } else {
          ctx.fillStyle = "#1e292a";
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y + 1, 2, 1);
        }

        ctx.restore();
      }
    },
  };
}
