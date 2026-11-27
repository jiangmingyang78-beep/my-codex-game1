import rockArt from "@/data/survivalRockArt.json";

const TILE_SIZE = 16;

export function createSurvivalRockArt(
  ores: Record<string, { color: string }>,
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
    anchorX: number,
    anchorY: number,
    size: number,
    refine: boolean,
  ) => { image: HTMLCanvasElement },
  makeCanvas: (width: number, height: number) => HTMLCanvasElement,
) {
  const chipColors: Record<string, string> = {
    coal: "#535565",
    stone: "#b3bcc0",
  };
  for (const [id, ore] of Object.entries(ores)) chipColors[id] = ore.color;

  const framesByMaterial = Object.fromEntries(
    Object.entries(rockArt).map(([id, art]) => {
      const palette = {
        r: art.rock,
        s: art.shade,
        d: art.dark,
        b:
          id === "coal"
            ? "#272934"
            : id === "stone"
              ? "#ab8c64"
              : chipColors[id],
        h: art.light,
      };
      const variants = art.forms.map((form, variant) => {
        const { image } = pixelArt(form, palette, 0, 0, 0, false);
        const intact = makeCanvas(TILE_SIZE, TILE_SIZE);
        intact
          .getContext("2d")
          ?.drawImage(image, 0, TILE_SIZE - 1 - image.height);
        const frames = [intact];
        const crackStages = id === "coal" ? 2 : 1;
        for (let stage = 1; stage <= crackStages; stage++) {
          const canvas = makeCanvas(TILE_SIZE, TILE_SIZE);
          const g = canvas.getContext("2d");
          if (!g) throw new Error("Canvas 2D is unavailable.");
          g.drawImage(frames[stage - 1], 0, 0);
          g.globalCompositeOperation = "source-atop";
          if (variant) {
            g.translate(TILE_SIZE, 0);
            g.scale(-1, 1);
          }
          g.fillStyle = art.light;
          g.fillRect(stage === 1 ? 7 : 5, stage === 1 ? 7 : 10, 1, 1);
          g.fillStyle = id === "coal" ? "#100f1c" : "#302537";
          if (stage === 1) {
            g.fillRect(9, 6, 1, 2);
            g.fillRect(7, 8, 3, 1);
            g.fillRect(7, 9, 1, 1);
          } else {
            g.fillRect(6, 10, 2, 1);
            g.fillRect(5, 11, 2, 1);
            g.fillRect(4, 12, 2, 1);
            g.fillRect(8, 10, 2, 1);
            g.fillRect(10, 11, 2, 1);
          }
          frames.push(canvas);
        }
        return frames;
      });
      return [id, variants];
    }),
  );

  return {
    chipColor: (material: string) => chipColors[material] ?? chipColors.stone,
    frame(
      material: string,
      variantRoll: number,
      hits: number,
    ): HTMLCanvasElement {
      const variants = framesByMaterial[material] ?? framesByMaterial.stone;
      const frames = variants[Math.floor(variantRoll * variants.length)];
      return frames[Math.min(hits, frames.length - 1)];
    },
  };
}
