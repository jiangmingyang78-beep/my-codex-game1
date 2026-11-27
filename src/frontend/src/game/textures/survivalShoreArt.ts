import {
  SURVIVAL_BIOMES,
  SURVIVAL_TILE_SIZE,
  type SurvivalBiome,
} from "@/systems/survival/survivalBiomes";

const SIZE = SURVIVAL_TILE_SIZE;
const SIDES = [0, 1, 2, 3];

interface ShoreEdge {
  water: number;
  diagonal: number;
  ice: number;
  open: number;
}

export function shoreMaterial(
  biome: SurvivalBiome | null | undefined,
  tile: number,
) {
  if (biome === SURVIVAL_BIOMES[4] || (!biome && tile === 4)) return "ice";
  if (
    biome === SURVIVAL_BIOMES[3] ||
    biome === SURVIVAL_BIOMES[6] ||
    (!biome && tile === 3)
  )
    return "rock";
  return "grass";
}

export function createSurvivalShoreArt(
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
  ) => HTMLCanvasElement,
  makeCanvas: (width: number, height: number) => HTMLCanvasElement,
) {
  // 岸线图案以北边或东北角为原点，旋转后仍与像素网格对齐。
  function rotatedStamps(
    pattern: string,
    palette: Record<string, string>,
    corner = false,
  ) {
    const stamp = pixelArt(pattern, palette);
    return SIDES.map((side) => {
      const canvas = makeCanvas(SIZE, SIZE);
      const g = canvas.getContext("2d");
      if (g) {
        for (let turn = 0; turn < side; turn++)
          g.transform(0, 1, -1, 0, SIZE, 0);
        g.drawImage(stamp, corner ? SIZE - stamp.width : 0, 0);
      }
      return canvas;
    });
  }

  function stamps(
    palette: Record<string, string>,
    edges: string[],
    point: string,
    inlet: string,
  ) {
    return {
      edges: edges.map((pattern) => rotatedStamps(pattern, palette)),
      point: rotatedStamps(point, palette, true),
      inlet: rotatedStamps(inlet, palette, true),
    };
  }

  const shoreline = {
    grass: stamps(
      { w: "#214761", d: "#423b32", s: "#72533d", r: "#ad895b", h: "#8fa66a" },
      [
        "dsdddssddsddddsd ssrsssrrssrsrsss .hh..r..h..r.h.. ..h.....h.......",
        "ddsdddsdsdddssdd rsssrssssrrssrss .r.h.h..rh...h.. ...h........h...",
      ],
      "sdwwww hsdwww .rsdww ..hsdw ....sd .....h",
      "....sd ...hsr ....rh .....h",
    ),
    rock: stamps(
      { w: "#214761", d: "#403c40", s: "#655a53", r: "#978578", h: "#c4b09a" },
      [
        "ddsdsdddsdddsdds rssrrsssdrrssrrs .hrr..hrss..hr.. .....hh.........",
        "sdssdddsddsddssd rrssrrssrrssrrss .hr.rh...hrr.... .......h..r.....",
      ],
      "sdwwww hrswww .rrdww ..hsdw ...rrd ....hr",
      "...rsd ...hrs ....rr ....hr",
    ),
    ice: stamps(
      { w: "#24506b", d: "#55788c", s: "#85a8b7", r: "#bdd7dc", h: "#e2eeee" },
      [
        "ssdddssddsdddsss rrssrrrrsrrrssrr .hhh..hr...hhr.. ............h...",
        "ddsssddsddssddds rrrssrrrssrrrsrr ..hh..hhhr..hr.. .......h........",
      ],
      "sdwwww rrswww .hrsdw ..hrrs ...hhr .....h",
      "...rsd ...hrs ....hh .....h",
    ),
  };
  const iceLips = rotatedStamps(
    "...rrrsss...rrs. ....rss......s.. .....s..........",
    { r: "#afd2df", s: "#779fb6" },
  );

  function drawWater(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    edge: ShoreEdge,
    frame: number,
    variant: number,
  ) {
    const banks = edge.open & ~edge.water;
    const along = (frame * 3 + variant * 2) % 13;
    g.fillStyle = "#79afc0";
    for (const side of SIDES) {
      const bit = 1 << side;
      if (!(banks & bit)) continue;
      if (edge.ice & bit) {
        g.drawImage(iceLips[side], x, y);
      } else if (side % 2) {
        g.fillRect(x + (side === 1 ? SIZE - 1 : 0), y + along, 1, 3);
      } else {
        g.fillRect(x + along, y + (side === 2 ? SIZE - 1 : 0), 3, 1);
      }
    }
  }

  return function drawShores(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    tile: number,
    edge: ShoreEdge,
    frame: number,
    biome: SurvivalBiome | null | undefined,
    variant: number,
  ) {
    if (tile === 5) {
      drawWater(g, x, y, edge, frame, variant);
      return;
    }
    if (!(edge.water || edge.diagonal)) return;
    const art = shoreline[shoreMaterial(biome, tile)];
    for (const side of SIDES) {
      if (edge.water & (1 << side))
        g.drawImage(art.edges[variant & 1][side], x, y);
    }
    for (const side of SIDES) {
      const pair = (1 << side) | (1 << ((side + 1) % SIDES.length));
      if ((edge.water & pair) === pair) g.drawImage(art.point[side], x, y);
      else if (!(edge.water & pair) && edge.diagonal & (1 << side))
        g.drawImage(art.inlet[side], x, y);
    }
  };
}
