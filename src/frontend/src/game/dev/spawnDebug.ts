import type { RunState, Systems } from "@/core/types";
import { spawnRadii } from "@/systems/combat/spawnRules";
import type { LightGrid } from "@/systems/world/lightGrid";
import type Phaser from "phaser";

export const spawnDebug = { enabled: false };
export function drawSpawnDebug(
  state: RunState,
  sys: Systems,
  grid: LightGrid,
  g: Phaser.GameObjects.Graphics,
) {
  if (!spawnDebug.enabled) return;
  const { min, max } = spawnRadii(
    sys.data.balance.survival,
    grid.tileSize,
    sys.spawnView,
  );
  const { x, y } = state.hero;
  g.lineStyle(2, 0x66ffee)
    .strokeCircle(x, y, min)
    .lineStyle(2, 0xff9966)
    .strokeCircle(x, y, max);
  // An inset keeps both off-screen circles visible when tuning a live camera.
  const ctx = (
    document.getElementById("spawn-debug-map") as HTMLCanvasElement | null
  )?.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#162030";
  ctx.fillRect(0, 0, 150, 150);
  const scale = 70 / max;
  ctx.setTransform(scale, 0, 0, scale, 75 - x * scale, 75 - y * scale);
  ctx.fillStyle = "#ffce72";
  grid.forEachLitTile(
    { x: x - max, y: y - max, width: 2 * max, height: 2 * max },
    (tx, ty, level) => {
      ctx.fillStyle = level > 2 ? "#ffce72" : "#635075";
      ctx.fillRect(tx, ty, grid.tileSize, grid.tileSize);
    },
  );
  ctx.lineWidth = 1 / scale;
  for (const [radius, color] of [
    [min, "#66ffee"],
    [max, "#ff9966"],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  }
  const view = sys.spawnView;
  if (view) {
    ctx.strokeStyle = "#eee";
    ctx.strokeRect(view.x, view.y, view.width, view.height);
  }
}
