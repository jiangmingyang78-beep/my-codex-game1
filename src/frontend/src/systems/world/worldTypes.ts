/** Tile ids in World.tiles. Solid tiles block movement (the door only while closed). */
export const TILE = {
  snow: 0,
  path: 1,
  tree: 2,
  wall: 3,
  floor: 4,
  door: 5,
  ice: 6,
  fireBase: 7,
  bog: 8,
} as const;

export type ObjectKind =
  | "campfire"
  | "node"
  | "gate"
  | "relay_socket"
  | "beacon"
  | "story_prop"
  | "explosive_barrel"
  | "mirror_lamp";

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  regionId: string;
  /** World pixel position (centre of the object). */
  x: number;
  y: number;
  itemId?: string;
  yield?: number;
  renewable?: boolean;
  spriteKey?: string;
  storyToast?: string;
  unlockNoteId?: string;
  pickupId?: string;
}

export interface RegionBounds {
  id: string;
  /** Inclusive tile rectangle. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SpawnPoint {
  spawnId: string;
  regionId: string;
  x: number;
  y: number;
}

export interface TileMeta {
  biomeId: number;
  material:
    | "grass"
    | "trail"
    | "stone"
    | "ash"
    | "mud"
    | "snow"
    | "water"
    | "cliff"
    | "rubble";
  /** Normalized snow cover and the fraction of normal walking speed. */
  snowDepth: number;
  walkSpeedMultiplier: number;
}
export const supportsSnowFootprint = (meta: TileMeta): boolean =>
  meta.snowDepth >= 0.18 &&
  meta.material !== "water" &&
  meta.material !== "cliff";

export interface World {
  /** Integer world tile coordinates, including negative coordinates. */
  getTileMeta?(x: number, y: number): TileMeta;
  widthTiles: number;
  heightTiles: number;
  tileSize: number;
  tiles: Uint8Array;
  regions: readonly RegionBounds[];
  objects: ReadonlyMap<string, WorldObject>;
  /** Nodes sorted by id, for stable iteration. */
  objectList: readonly WorldObject[];
  spawns: ReadonlyMap<string, SpawnPoint>;
  /** Tile index -> gate id for the door tiles. */
  gateTiles: ReadonlyMap<number, string>;
  heroStart: { x: number; y: number };
  campfire: { x: number; y: number };
  /** Optional baked-texture key; worlds other than the adventure map use their own. */
  textureKey?: string;
}
