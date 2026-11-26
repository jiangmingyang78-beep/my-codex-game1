export type MapMode = "adventure" | "survival" | "eternal";

export interface TilePaletteEntry {
  id: number;
  key: string;
  name: string;
  color: string;
  accent?: string;
  solid: boolean;
}

export interface MapRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dashed?: boolean;
}

export type MapObjectKind =
  | "campfire"
  | "relay_socket"
  | "gate"
  | "beacon"
  | "wood"
  | "ore"
  | "stone"
  | "herb"
  | "food"
  | "fiber"
  | "story_prop"
  | "explosive_barrel"
  | "mirror_lamp"
  | "altar"
  | "board"
  | "landmark"
  | "core";

export interface MapObject {
  id: string;
  kind: MapObjectKind;
  label: string;
  tx: number;
  ty: number;
  itemId?: string;
  yield?: number;
  renewable?: boolean;
  radiusTiles?: number;
  regionId?: string;
  detail?: string;
}

export type MapSpawnKind = "hero" | "resident" | "night" | "boss" | "site";

export interface MapSpawn {
  id: string;
  kind: MapSpawnKind;
  enemyId?: string;
  regionId?: string;
  label: string;
  tx: number;
  ty: number;
  detail?: string;
}

export interface LayerFlags {
  regions: boolean;
  lights: boolean;
  resources: boolean;
  spawns: boolean;
  collision: boolean;
  grid: boolean;
}

export interface MapSnapshot {
  mode: MapMode;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  tileSize: number;
  tiles: Uint8Array;
  solidMask: Uint8Array;
  palette: Record<number, TilePaletteEntry>;
  biomeIds?: Uint8Array;
  biomeNames?: readonly string[];
  biomeColors?: readonly string[];
  regions: MapRegion[];
  objects: MapObject[];
  spawns: MapSpawn[];
  campRadiiByLevel: Record<number, number>;
  seedLabel?: string;
}
