export interface Point {
  x: number;
  y: number;
}
export interface StampProp extends Point {
  kind: string;
  interactive: boolean;
}
export interface StampEntity extends Point {
  kind: string;
  ref: string;
}
export type LootEntry = { itemId: string; count: number; probability: number };
export type TriggerEvent = { kind: string; message: string };
export interface StampTrigger extends Point {
  event: TriggerEvent;
  loot: LootEntry[];
}
export interface StampableSetPiece {
  triggerEvent?: TriggerEvent;
  lootTable?: LootEntry[];
  footprint: { w: number; h: number };
  tiles: string[];
  props: StampProp[];
  entities: StampEntity[];
  rotate?: boolean;
  mirror?: boolean;
}
export interface EncounterSetPieceSchema extends StampableSetPiece {
  id: string;
  name: string;
  allowedBiomes: number[];
  minDistanceFromCamp: number;
  minSpacingSameId: number;
  maxCountPerWorld: number;
  weight: number;
  lootTable: LootEntry[];
  triggerEvent: TriggerEvent;
  ldtkLevelRef?: string;
  color: string;
  icon: string[];
}
export interface StampGrid {
  width: number;
  height: number;
  terrain: Uint8Array;
  /** Existing roads stay open even when a prefab contains a pool or an obstacle. */
  road?: Uint8Array;
  triggers: StampTrigger[];
  props: StampProp[];
  entities: StampEntity[];
}
export function stampSetPieceIntoWorld(
  grid: StampGrid,
  piece: StampableSetPiece,
  originX: number,
  originY: number,
  rng: () => number,
) {
  const { w, h } = piece.footprint;
  const turns = piece.rotate ? Math.floor(rng() * 4) : 0;
  const flip = piece.mirror && rng() < 0.5;
  const width = turns % 2 ? h : w;
  const height = turns % 2 ? w : h;
  if (
    !Number.isSafeInteger(w) ||
    !Number.isSafeInteger(h) ||
    w <= 0 ||
    h <= 0 ||
    !Number.isInteger(turns) ||
    turns < 0 ||
    turns > 3 ||
    grid.terrain.length !== grid.width * grid.height ||
    [...piece.props, ...piece.entities].some(
      (p) =>
        !Number.isInteger(p.x) ||
        !Number.isInteger(p.y) ||
        p.x < 0 ||
        p.x >= w ||
        p.y < 0 ||
        p.y >= h,
    ) ||
    !Number.isInteger(originX) ||
    !Number.isInteger(originY) ||
    originX < 0 ||
    originY < 0 ||
    originX + width > grid.width ||
    originY + height > grid.height ||
    piece.tiles.length !== h ||
    !piece.tiles.every((row) => row.length === w && /^[0-9]+$/.test(row))
  )
    return null;
  function transform<T extends Point>(p: T): T {
    const x = flip ? w - 1 - p.x : p.x;
    const y = p.y;
    const tx = [x, h - 1 - y, w - 1 - x, y][turns];
    const ty = [y, x, h - 1 - y, w - 1 - x][turns];
    return { ...p, x: originX + tx, y: originY + ty };
  }
  const props = piece.props.map(transform);
  const entities = piece.entities.map(transform);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = transform({ x, y });
      const i = p.y * grid.width + p.x;
      if (!grid.road?.[i]) grid.terrain[i] = Number(piece.tiles[y][x]);
    }
  grid.props.push(...props);
  grid.entities.push(...entities);
  const triggers: StampTrigger[] = [];
  if (piece.triggerEvent)
    for (const prop of props)
      if (prop.interactive) {
        triggers.push({
          x: prop.x,
          y: prop.y,
          event: piece.triggerEvent,
          loot: piece.lootTable ?? [],
        });
      }
  grid.triggers.push(...triggers);
  return { width, height, props, entities, triggers };
}
