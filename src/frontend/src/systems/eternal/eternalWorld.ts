import type { GameData } from "@/core/dataTypes";
import { loadGameData } from "@/core/gameData";
import type { Systems } from "@/core/types";
import { TILE, type World } from "../world/worldTypes";
import { ETERNAL } from "./eternalTypes";

const SIZE = 32;
const BORDER = 2;
const CENTER = { x: 16, y: 16 };
const START = { x: 16, y: 19 };
const PINE_RING_TILES = 9;
const PINE_COUNT = 8;
const REGION_ID = "camp_edge";

export const ETERNAL_TEXTURE_KEY = "world-ground-eternal";

const px = (tile: number, size: number): number => (tile + 0.5) * size;

/** 32x32 snow clearing: dense pine border, a shallow cross lane and eight kiting pines. */
export function generateEternalWorld(data: GameData): World {
  const size = data.tileSize;
  const tiles = new Uint8Array(SIZE * SIZE);
  const at = (x: number, y: number): number => y * SIZE + x;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const edge =
        x < BORDER || y < BORDER || x >= SIZE - BORDER || y >= SIZE - BORDER;
      if (edge) tiles[at(x, y)] = TILE.tree;
    }
  }
  for (let i = BORDER; i < SIZE - BORDER; i++) {
    tiles[at(CENTER.x, i)] = TILE.path;
    tiles[at(i, CENTER.y)] = TILE.path;
  }
  for (let k = 0; k < PINE_COUNT; k++) {
    const angle = ((k + 0.5) * Math.PI * 2) / PINE_COUNT;
    const x = CENTER.x + Math.round(Math.cos(angle) * PINE_RING_TILES);
    const y = CENTER.y + Math.round(Math.sin(angle) * PINE_RING_TILES);
    if (tiles[at(x, y)] === TILE.snow) tiles[at(x, y)] = TILE.tree;
  }
  const campfire = { x: px(CENTER.x, size), y: px(CENTER.y, size) };
  const fire = {
    id: data.worldObjects.mainCampfireId,
    kind: "campfire" as const,
    regionId: REGION_ID,
    ...campfire,
  };
  return {
    widthTiles: SIZE,
    heightTiles: SIZE,
    tileSize: size,
    tiles,
    regions: [{ id: REGION_ID, x0: 0, y0: 0, x1: SIZE - 1, y1: SIZE - 1 }],
    objects: new Map([[fire.id, fire]]),
    objectList: [fire],
    spawns: new Map(),
    gateTiles: new Map(),
    heroStart: { x: px(START.x, size), y: px(START.y, size) },
    campfire,
    textureKey: ETERNAL_TEXTURE_KEY,
  };
}

/** Same JSON data, but permanent night, no storm limit, a Lv.3 camp and a 14 enemy cap. */
export function createEternalData(base: GameData): GameData {
  const { balance } = base;
  return {
    ...base,
    balance: {
      ...balance,
      clock: {
        ...balance.clock,
        daySec: ETERNAL.daySec,
        nightSec: ETERNAL.nightSec,
        runLimitSec: Number.MAX_SAFE_INTEGER,
      },
      starting: { ...balance.starting, campLevel: ETERNAL.campLevel },
      limits: { ...balance.limits, activeEnemies: ETERNAL.enemyCap },
    },
  };
}

export function createEternalSystems(base = loadGameData()): Systems {
  const data = createEternalData(base);
  return { data, world: generateEternalWorld(data) };
}
