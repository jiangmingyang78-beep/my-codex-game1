import { MILL_BUILDING, TILE, type World } from "@/systems";

/** The subset of the vfx texture generator the world bake needs. */
export interface TileArt {
  ground(opts: {
    land: string;
    detail: string;
    floor?: number;
    variant?: number;
    seed?: number;
  }): { canvas: HTMLCanvasElement };
  water(opts?: { variant?: number; frame?: number }): {
    canvas: HTMLCanvasElement;
  };
  tuft(opts: { color: string; lean?: number }): { canvas: HTMLCanvasElement };
  edge(opts: { color: string; side: number }): { canvas: HTMLCanvasElement };
}

export function tileHash(x: number, y: number, salt = 0): number {
  let v =
    Math.imul(x + 101, 374761393) ^
    Math.imul(y + 57, 668265263) ^
    Math.imul(salt + 13, 1274126177);
  v = (v ^ (v >>> 13)) >>> 0;
  return (v % 1009) / 1009;
}

const SNOW = { land: "#dbe6f1", detail: "#a9bdd3", floor: 1 };
const PATH = { land: "#8f8174", detail: "#6f6258", floor: 3 };
const PLANK = { land: "#6f5543", detail: "#4d392c", floor: 4 };
const ROCK = { land: "#262c40", detail: "#343c58", floor: 3 };
const MILL_WALL = { land: "#5a4a3e", detail: "#3d3129", floor: 3 };
const FIRE_BASE = { land: "#6b7180", detail: "#4a4f5e", floor: 3 };
const BOG = { land: "#3a4f46", detail: "#253630", floor: 2 };
const EDGE_COLOR = "#8497b2";
const TUFT_COLOR = "#7d98a4";
/** Edge dither sides: 0 top, 1 right, 2 bottom, 3 left. */
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [0, -1, 0],
  [1, 0, 1],
  [0, 1, 2],
  [-1, 0, 3],
];

function inMill(tx: number, ty: number): boolean {
  const m = MILL_BUILDING;
  return tx >= m.x0 && tx <= m.x1 && ty >= m.y0 && ty <= m.y1;
}

function style(world: World, tx: number, ty: number): typeof SNOW {
  switch (world.tiles[ty * world.widthTiles + tx]) {
    case TILE.path:
    case TILE.door:
      return PATH;
    case TILE.floor:
      return PLANK;
    case TILE.wall:
      return inMill(tx, ty) ? MILL_WALL : ROCK;
    case TILE.fireBase:
      return FIRE_BASE;
    case TILE.bog:
      return BOG;
    default:
      return SNOW;
  }
}

function isWall(world: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles)
    return true;
  return world.tiles[ty * world.widthTiles + tx] === TILE.wall;
}

/** Bakes the whole tile grid (ground, ice, tufts and snow edges) into one canvas. */
export function bakeWorldCanvas(world: World, art: TileArt): HTMLCanvasElement {
  const size = world.tileSize;
  const canvas = document.createElement("canvas");
  canvas.width = world.widthTiles * size;
  canvas.height = world.heightTiles * size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable.");
  g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < world.heightTiles; ty++) {
    for (let tx = 0; tx < world.widthTiles; tx++) {
      const tile = world.tiles[ty * world.widthTiles + tx];
      const variant = Math.floor(tileHash(tx, ty, 1) * 4);
      const px = tx * size;
      const py = ty * size;
      if (tile === TILE.ice) {
        g.drawImage(art.water({ variant, frame: 0 }).canvas, px, py);
        continue;
      }
      g.drawImage(
        art.ground({ ...style(world, tx, ty), variant, seed: 3 }).canvas,
        px,
        py,
      );
      const baseSnow = tile === TILE.snow || tile === TILE.tree;
      if (!baseSnow) continue;
      for (const [dx, dy, side] of NEIGHBOURS) {
        if (isWall(world, tx + dx, ty + dy)) {
          g.drawImage(art.edge({ color: EDGE_COLOR, side }).canvas, px, py);
        }
      }
      if (tile === TILE.snow && tileHash(tx, ty, 7) < 0.06) {
        const lean = Math.round(tileHash(tx, ty, 9) * 4) - 2;
        g.drawImage(
          art.tuft({ color: TUFT_COLOR, lean }).canvas,
          px + 1,
          py + 5,
        );
      }
    }
  }
  return canvas;
}
