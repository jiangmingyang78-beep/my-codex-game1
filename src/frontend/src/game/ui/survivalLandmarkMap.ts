import { encounterById } from "@/systems/survival/encounterCatalog";
import {
  type Landmark,
  landmarkEdge,
  landmarkKinds,
} from "@/systems/survival/landmarks";

type Point = { x: number; y: number };
type MapMark = Point &
  (
    | { kind: Landmark["kind"] | "camp" }
    | { kind: "encounter"; templateId: string }
  );
const campMark = {
  color: "#ffe2a3",
  pixels: ["..#..", ".#.#.", ".###.", "#.#.#", "#####"],
};

export function drawSurvivalMapMark(
  ctx: CanvasRenderingContext2D,
  mark: MapMark,
  origin: Point,
  player: Point,
  selected: boolean,
) {
  const x = (mark.x - origin.x) * 3 + 1;
  const y = (mark.y - origin.y) * 3 + 1;
  const { width, height } = ctx.canvas;
  const piece =
    mark.kind === "encounter" ? encounterById.get(mark.templateId) : null;
  const art =
    mark.kind === "encounter"
      ? piece && { pixels: piece.icon, color: piece.color }
      : mark.kind === "camp"
        ? campMark
        : landmarkKinds[mark.kind];
  if (!art) return;
  const edge = landmarkEdge(player, { x, y }, width, height, 7);
  if (edge) {
    if (!selected) return;
    ctx.save();
    ctx.translate(Math.round(edge.x), Math.round(edge.y));
    ctx.rotate(edge.angle);
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#101923";
    ctx.stroke();
    ctx.fillStyle = art.color;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#101923";
  ctx.fillRect(x - 3, y - 3, 7, 7);
  if (selected) {
    ctx.strokeStyle = art.color;
    ctx.strokeRect(x - 3.5, y - 3.5, 8, 8);
  }
  ctx.fillStyle = art.color;
  for (const [row, pixels] of art.pixels.entries()) {
    for (let column = 0; column < pixels.length; column++) {
      if (pixels[column] === "#")
        ctx.fillRect(x + column - 2, y + row - 2, 1, 1);
    }
  }
}
