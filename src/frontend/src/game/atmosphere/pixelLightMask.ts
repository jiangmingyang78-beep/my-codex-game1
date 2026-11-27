import type { LightGrid } from "@/systems/world/lightGrid";
export function makePixelHole(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const size = 48;
  const half = size / 2;
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建夜幕挖孔纹理");
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      pixels.data[(y * size + x) * 4 + 3] =
        distance <= 0.48
          ? 255
          : distance <= 0.66
            ? 196
            : distance <= 0.82
              ? 118
              : distance <= 1
                ? 46
                : 0;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Compose the cached night texture from the same per-source occluded cells used by AI. */
export function eraseLitPixels(
  g: CanvasRenderingContext2D,
  grid: LightGrid,
  view: { x: number; y: number; width: number; height: number },
) {
  g.globalCompositeOperation = "destination-out";
  grid.forEachLitTile(view, (x, y, level) => {
    g.globalAlpha = level <= 2 ? 0.025 * level : 0.18 + (0.65 * level) / 15;
    g.fillRect(x - view.x, y - view.y, grid.tileSize, grid.tileSize);
  });
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}
