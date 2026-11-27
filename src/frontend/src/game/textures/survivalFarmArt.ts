import { SURVIVAL_TILE_SIZE } from "@/systems/survival/survivalBiomes";

const WHEAT_PATTERNS = [
  `................
   ................
   ................
   ................
   ................
   ................
   ..ll..h.........
   ...blb......hl..
   ....s....lllb...
   ...........s....
   ......h.........
   ....llbl........
   ......s.........
   ................
   ................
   ................`,
  `................
   ................
   ................
   ..l.............
   ..bl...h....hl..
   ...b..ll....l...
   .l..bbl...h.l.l.
   ..lbsb....blbll.
   ....s..h...sb...
   .....l.l....s...
   .....blb..l.....
   ......bs.ll.....
   .......sb.......
   ................
   ................
   ................`,
  `................
   ...h............
   ..hbl......h....
   ...hb.....hbl...
   ...bl..h...hb...
   .l..b.hbl..bl...
   ..b.b..hb..b..l.
   ...bs..bl..b.l..
   ....s..b..bsb...
   .....l.b.l..s...
   ......bsbl......
   .......sb.......
   .......s........
   ................
   ................
   ................`,
  `................
   ....hh.....hh...
   ..hgbbl...hggbl.
   .hgb..l..hgb..l.
   .gb...l..gb...b.
   ..b..l..b....bl.
   ....lb..hh...b..
   ..l.b..hggbl.b.l
   ...ls.hgb..lbsb.
   ....s.gb...bs...
   ......b..l.b....
   .......l.bs.....
   ........sb......
   ................
   ................
   ................`,
];

export function createSurvivalWheatArt(
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
  ) => HTMLCanvasElement,
) {
  return WHEAT_PATTERNS.map((pattern, stage) =>
    pixelArt(
      pattern,
      stage === 3
        ? {
            h: "#ffe09a",
            g: "#dfb459",
            b: "#aa7b3e",
            l: "#c19c53",
            s: "#765037",
          }
        : {
            h: stage === 2 ? "#cccf83" : "#bbd88b",
            l: "#90b575",
            b: "#638653",
            s: "#405c42",
          },
    ),
  );
}

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;
const SIZE = SURVIVAL_TILE_SIZE;

export function createSurvivalFenceArt(
  makeCanvas: (width: number, height: number) => HTMLCanvasElement,
) {
  const textures = new Map<number, HTMLCanvasElement>();
  return function fenceTexture(
    kind: "fence" | "gate",
    neighbors: number,
    open: boolean,
  ) {
    const key = neighbors | (kind === "gate" ? (open ? 32 : 16) : 0);
    const cached = textures.get(key);
    if (cached) return cached;

    const canvas = makeCanvas(SIZE, SIZE);
    const g = canvas.getContext("2d");
    if (!g) return canvas;
    const fill = (
      color: string,
      x: number,
      y: number,
      width = 1,
      height = 1,
    ) => {
      g.fillStyle = color;
      g.fillRect(x, y, width, height);
    };
    function post(x: number, y: number) {
      fill("#4a372f", x - 1, y - 3, 3, 6);
      fill("#a47a50", x - 1, y - 3, 2, 5);
      fill("#e2b67e", x - 1, y - 4, 3, 2);
      fill("#6b4b39", x, y - 3);
    }
    function horizontalRails(left: number, right: number) {
      for (const y of [5, 9]) {
        fill("#664a39", left, y, right - left, 2);
        fill("#c79b68", left, y, right - left);
      }
    }
    function verticalRails(top: number, bottom: number) {
      for (const x of [6, 9]) {
        fill("#70513e", x, top, 2, bottom - top);
        fill("#b78b5c", x, top, 1, bottom - top);
      }
    }

    if (kind === "gate") {
      const vertical =
        Number(Boolean(neighbors & NORTH)) + Number(Boolean(neighbors & SOUTH));
      const horizontal =
        Number(Boolean(neighbors & EAST)) + Number(Boolean(neighbors & WEST));
      if (vertical > horizontal) {
        if (open) {
          fill("#73543f", 8, 2, 7, 3);
          fill("#d5a775", 9, 2, 6);
        } else {
          verticalRails(0, SIZE);
          fill("#f0c879", 6, 10, 4, 2);
        }
        post(8, 4);
        post(8, 13);
      } else {
        if (open) {
          fill("#70513e", 1, 2, 3, 8);
          fill("#d5a775", 1, 2, 1, 7);
        } else {
          horizontalRails(0, SIZE);
          fill("#f0c879", 10, 6, 2, 4);
        }
        post(2, 8);
        post(13, 8);
      }
    } else if (!neighbors) {
      horizontalRails(2, 14);
      post(2, 8);
      post(13, 8);
    } else {
      if (neighbors & NORTH) verticalRails(0, 8);
      if (neighbors & SOUTH) verticalRails(8, SIZE);
      if (neighbors & WEST) horizontalRails(0, 9);
      if (neighbors & EAST) horizontalRails(8, SIZE);
      post(8, 8);
    }
    textures.set(key, canvas);
    return canvas;
  };
}
