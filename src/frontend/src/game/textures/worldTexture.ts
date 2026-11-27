import { MILL_BUILDING, TILE, type World } from "@/systems";
import { ETERNAL_TEXTURE_KEY } from "@/systems/eternal/eternalWorld";

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
const WINTER_EDGE_COLOR = "#576b8c";
const TUFT_COLOR = "#7d98a4";
const ICE_PALETTE = {
  base: "#476484",
  rim: "#bed7e2",
  shoulder: "#759ab2",
  detail: "#7095af",
};
export const WINTER_TRAIL_PALETTE = {
  base: "#b7a8a4",
  rim: "#b1bdcb",
  shoulder: "#9894a1",
  detail: "#a1999a",
};
export const WINTER_SNOW_HIGHLIGHTS = { drift: "#8ba0b9", glint: "#91a4bc" };
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

function wrappedNoise(
  x: number,
  y: number,
  cells: number,
  salt: number,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const x0 = ix % cells;
  const x1 = (ix + 1) % cells;
  const y0 = iy % cells;
  const y1 = (iy + 1) % cells;
  const a = tileHash(x0, y0, salt) * (1 - u) + tileHash(x1, y0, salt) * u;
  const b = tileHash(x0, y1, salt) * (1 - u) + tileHash(x1, y1, salt) * u;
  return a * (1 - v) + b * v;
}

/** Samples snow in world coordinates so drifts cross tile and texture boundaries. */
function makeSnowfield(): HTMLCanvasElement {
  const span = 256;
  const canvas = document.createElement("canvas");
  canvas.width = span;
  canvas.height = span;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable.");
  for (let y = 0; y < span; y++) {
    for (let x = 0; x < span; x++) {
      const drift =
        0.68 * wrappedNoise((x + y) / 64, y / 32, 4, 31) +
        0.32 * wrappedNoise(x / 16, y / 8, 16, 77);
      if (drift < 0.28) g.fillStyle = "#7084a1";
      else if (drift < 0.4) g.fillStyle = "#798eaa";
      else if (drift < 0.6) g.fillStyle = "#8297b2";
      else g.fillStyle = WINTER_SNOW_HIGHLIGHTS.drift;
      g.fillRect(x, y, 1, 1);
    }
  }
  for (let i = 0; i < 190; i++) {
    const x = Math.floor(tileHash(i, 4, 41) * span);
    const y = Math.floor(tileHash(i, 5, 9) * span);
    g.fillStyle = i % 4 ? WINTER_SNOW_HIGHLIGHTS.glint : "#748aa6";
    g.fillRect(x, y, 2 + (i % 4), 1);
    if (i % 5 === 0) g.fillRect(x + 3, y - 1, 2, 1);
  }
  return canvas;
}

function drawWinterGround(
  g: CanvasRenderingContext2D,
  world: World,
  sheet: HTMLCanvasElement,
  tile: number,
  tx: number,
  ty: number,
  variant: number,
): boolean {
  const { tileSize: size, widthTiles, heightTiles, tiles } = world;
  const x = tx * size;
  const y = ty * size;
  if (tile === TILE.snow || tile === TILE.tree) {
    const cell = 16;
    const sx = (tx * cell) % sheet.width;
    const sy = (ty * cell) % sheet.height;
    g.drawImage(sheet, sx, sy, cell, cell, x, y, size, size);
    return true;
  }
  const ice = tile === TILE.ice;
  if (!ice && tile !== TILE.path) return false;
  const palette = ice ? ICE_PALETTE : WINTER_TRAIL_PALETTE;
  g.fillStyle = palette.base;
  g.fillRect(x, y, size, size);
  const joins = (dx: number, dy: number): boolean => {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= widthTiles || ny >= heightTiles) return false;
    const next = tiles[ny * widthTiles + nx];
    return next === tile || (!ice && next === TILE.door);
  };
  const sides = NEIGHBOURS.map(([dx, dy]) => joins(dx, dy));
  for (const [dx, dy, side] of NEIGHBOURS) {
    if (sides[side]) continue;
    const vertical = dx !== 0;
    for (let offset = 0; offset < size; offset += 2) {
      const run = Math.floor(offset / 4);
      const depth =
        1 + Math.floor(tileHash(tx + dx, ty + dy, run + side * 5) * 3);
      const along = Math.min(2, size - offset);
      const sx = x + (vertical ? (dx > 0 ? size - depth : 0) : offset);
      const sy = y + (vertical ? offset : dy > 0 ? size - depth : 0);
      g.fillStyle = palette.shoulder;
      g.fillRect(sx, sy, vertical ? depth : along, vertical ? along : depth);
      g.fillStyle = palette.rim;
      g.fillRect(
        dx > 0 ? x + size - 1 : sx,
        dy > 0 ? y + size - 1 : sy,
        vertical ? 1 : along,
        vertical ? along : 1,
      );
    }
  }
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const joinsHorizontal = sides[dx < 0 ? 3 : 1];
      const joinsVertical = sides[dy < 0 ? 0 : 2];
      const outer = !joinsHorizontal && !joinsVertical;
      const inner = joinsHorizontal && joinsVertical && !joins(dx, dy);
      if (!outer && !inner) continue;
      const radius = Math.min(outer ? 5 : 3, size);
      for (let row = 0; row < radius; row++) {
        const width = radius - row;
        const sx = dx < 0 ? x : x + size - width;
        const sy = dy < 0 ? y + row : y + size - 1 - row;
        g.fillStyle = outer ? palette.rim : palette.shoulder;
        g.fillRect(sx, sy, width, 1);
        g.fillStyle = outer ? palette.shoulder : palette.rim;
        g.fillRect(dx < 0 ? sx + width - 1 : sx, sy, 1, 1);
      }
    }
  }
  if (variant === 1 || variant === 3) {
    g.fillStyle = palette.detail;
    g.fillRect(x + 3 + variant, y + 5 + variant, ice ? 5 : 2, 1);
    if (ice) g.fillRect(x + 8 + variant, y + 4 + variant, 2, 1);
  }
  return true;
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
  const snowfield =
    world.textureKey === ETERNAL_TEXTURE_KEY ? null : makeSnowfield();
  const edgeColor = snowfield ? WINTER_EDGE_COLOR : EDGE_COLOR;
  const tuftRate = snowfield ? 0.025 : 0.06;
  for (let ty = 0; ty < world.heightTiles; ty++) {
    for (let tx = 0; tx < world.widthTiles; tx++) {
      const tile = world.tiles[ty * world.widthTiles + tx];
      const variant = Math.floor(tileHash(tx, ty, 1) * 4);
      const px = tx * size;
      const py = ty * size;
      const painted =
        snowfield &&
        drawWinterGround(g, world, snowfield, tile, tx, ty, variant);
      if (!painted) {
        if (tile === TILE.ice) {
          g.drawImage(art.water({ variant, frame: 0 }).canvas, px, py);
          continue;
        }
        g.drawImage(
          art.ground({ ...style(world, tx, ty), variant, seed: 3 }).canvas,
          px,
          py,
        );
      }
      const baseSnow = tile === TILE.snow || tile === TILE.tree;
      if (!baseSnow) continue;
      for (const [dx, dy, side] of NEIGHBOURS) {
        if (isWall(world, tx + dx, ty + dy)) {
          g.drawImage(art.edge({ color: edgeColor, side }).canvas, px, py);
        }
      }
      if (tile === TILE.snow && tileHash(tx, ty, 7) < tuftRate) {
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
