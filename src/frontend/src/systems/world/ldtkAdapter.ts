import type { GameData } from "@/core/dataTypes";
import {
  type ObjectKind,
  type RegionBounds,
  type SpawnPoint,
  TILE,
  type World,
  type WorldObject,
} from "./worldTypes";

interface LdtkField {
  __identifier: string;
  __value: unknown;
}

interface LdtkEntity {
  __identifier: string;
  __grid: [number, number];
  px: [number, number];
  width: number;
  height: number;
  fieldInstances: LdtkField[];
}

interface LdtkLayer {
  __identifier: string;
  __type: "IntGrid" | "Entities" | "Tiles" | "AutoLayer";
  __cWid: number;
  __cHei: number;
  __gridSize: number;
  intGridCsv?: number[];
  entityInstances?: LdtkEntity[];
}

export interface LdtkProjectJson {
  levels: {
    identifier: string;
    pxWid: number;
    pxHei: number;
    layerInstances?: LdtkLayer[];
  }[];
}

function field<T>(entity: LdtkEntity, name: string, fallback: T): T {
  const hit = entity.fieldInstances.find((f) => f.__identifier === name);
  return hit && hit.__value !== null && hit.__value !== undefined
    ? (hit.__value as T)
    : fallback;
}

export function buildWorldFromLdtk(
  ldtk: LdtkProjectJson,
  data: GameData,
  levelIndex = 0,
): World {
  const level = ldtk.levels[levelIndex];
  if (!level?.layerInstances) {
    throw new Error("LDtk JSON 缺少有效的 level 或 layerInstances");
  }

  const terrainLayer = level.layerInstances.find(
    (l) => l.__identifier === "Terrain" && l.__type === "IntGrid",
  );
  const entityLayer = level.layerInstances.find(
    (l) => l.__identifier === "Entities" && l.__type === "Entities",
  );
  if (!terrainLayer?.intGridCsv || !entityLayer?.entityInstances) {
    throw new Error(
      "LDtk 需包含 IntGrid 图层「Terrain」与实体图层「Entities」",
    );
  }

  const widthTiles = terrainLayer.__cWid;
  const heightTiles = terrainLayer.__cHei;
  const tileSize = terrainLayer.__gridSize || data.tileSize;
  const tiles = new Uint8Array(widthTiles * heightTiles);

  for (let i = 0; i < tiles.length; i++) {
    const raw = terrainLayer.intGridCsv[i] ?? 4;
    tiles[i] = raw > 0 ? raw - 1 : TILE.wall;
  }

  const regions: RegionBounds[] = [];
  const objects = new Map<string, WorldObject>();
  const spawns = new Map<string, SpawnPoint>();
  const gateTiles = new Map<number, string>();
  let heroStart = { x: tileSize * 2, y: tileSize * 2 };
  let campfire = { x: tileSize * 2, y: tileSize * 2 };

  const addObj = (o: WorldObject) => {
    if (objects.has(o.id)) throw new Error(`LDtk 重复对象 ID: ${o.id}`);
    objects.set(o.id, o);
  };

  for (const e of entityLayer.entityInstances) {
    const cx = e.px[0] + e.width * 0.5;
    const cy = e.px[1] + e.height * 0.5;
    const regionId = field<string>(
      e,
      "regionId",
      data.balance.starting.regionId,
    );

    switch (e.__identifier) {
      case "HeroStart":
        heroStart = { x: cx, y: cy };
        break;
      case "Campfire":
        campfire = { x: cx, y: cy };
        tiles[e.__grid[1] * widthTiles + e.__grid[0]] = TILE.fireBase;
        addObj({
          id: data.worldObjects.mainCampfireId,
          kind: "campfire",
          regionId,
          x: cx,
          y: cy,
        });
        break;
      case "Region": {
        const w = Math.max(1, Math.round(e.width / tileSize));
        const h = Math.max(1, Math.round(e.height / tileSize));
        regions.push({
          id: regionId,
          x0: e.__grid[0],
          y0: e.__grid[1],
          x1: e.__grid[0] + w - 1,
          y1: e.__grid[1] + h - 1,
        });
        break;
      }
      case "Spawn": {
        const spawnId = field<string>(e, "spawnId", "");
        if (!spawnId) throw new Error("LDtk Spawn 实体缺少 spawnId");
        spawns.set(spawnId, { spawnId, regionId, x: cx, y: cy });
        break;
      }
      case "Gate": {
        const gateId = field<string>(e, "gateId", "");
        if (!gateId) throw new Error("LDtk Gate 实体缺少 gateId");
        addObj({ id: gateId, kind: "gate", regionId, x: cx, y: cy });
        const tw = Math.max(1, Math.round(e.width / tileSize));
        const th = Math.max(1, Math.round(e.height / tileSize));
        for (let dy = 0; dy < th; dy++) {
          for (let dx = 0; dx < tw; dx++) {
            const idx = (e.__grid[1] + dy) * widthTiles + (e.__grid[0] + dx);
            tiles[idx] = TILE.door;
            gateTiles.set(idx, gateId);
          }
        }
        break;
      }
      case "RelaySocket": {
        const relayId = field<string>(e, "relayId", "");
        tiles[e.__grid[1] * widthTiles + e.__grid[0]] = TILE.fireBase;
        addObj({ id: relayId, kind: "relay_socket", regionId, x: cx, y: cy });
        break;
      }
      case "ResourceNode": {
        const objectId = field<string>(
          e,
          "objectId",
          `node_${e.__grid[0]}_${e.__grid[1]}`,
        );
        const itemId = field<string>(e, "itemId", "wood");
        addObj({
          id: objectId,
          kind: "node",
          regionId,
          x: cx,
          y: cy,
          itemId,
          yield: field<number>(e, "yield", 1),
          renewable: data.dawnRenewal.renewableItemIds.includes(itemId),
        });
        break;
      }
      case "StoryProp":
      case "ExplosiveBarrel":
      case "MirrorLamp": {
        const kindMap: Record<string, ObjectKind> = {
          StoryProp: "story_prop",
          ExplosiveBarrel: "explosive_barrel",
          MirrorLamp: "mirror_lamp",
        };
        addObj({
          id: field<string>(
            e,
            "objectId",
            `${e.__identifier}_${e.__grid[0]}_${e.__grid[1]}`,
          ),
          kind: kindMap[e.__identifier],
          regionId,
          x: cx,
          y: cy,
          storyToast: field<string | undefined>(e, "toast", undefined),
          unlockNoteId: field<string | undefined>(e, "unlockNoteId", undefined),
        });
        break;
      }
      default:
        break;
    }
  }

  return {
    widthTiles,
    heightTiles,
    tileSize,
    tiles,
    regions,
    objects,
    objectList: [...objects.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    spawns,
    gateTiles,
    heroStart,
    campfire,
  };
}

export { stampSetPieceIntoWorld } from "./setPieceStamp";
export type { StampableSetPiece } from "./setPieceStamp";
import type { StampableSetPiece } from "./setPieceStamp";

/** SurvivalTerrain uses the survival tile catalogue (IntGrid = tile + 1). */
export function setPieceFromLdtk(
  project: LdtkProjectJson,
  ref: string,
): StampableSetPiece {
  const layers = project.levels.find(
    (l) => l.identifier === ref,
  )?.layerInstances;
  const ground = layers?.find(
    (l) => l.__identifier === "SurvivalTerrain" && l.__type === "IntGrid",
  );
  const actors = layers?.find(
    (l) => l.__identifier === "Entities" && l.__type === "Entities",
  )?.entityInstances;
  if (!ground?.intGridCsv || !actors)
    throw new Error(`LDtk 奇遇缺少图层：${ref}`);
  const { __cWid: w, __cHei: h, intGridCsv: csv } = ground;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w > 15 ||
    h > 15 ||
    csv.length !== w * h ||
    csv.some((n) => !Number.isInteger(n) || n < 1 || n > 10)
  )
    throw new Error(`LDtk 奇遇地形无效：${ref}`);
  const stamp: StampableSetPiece = {
    footprint: { w, h },
    tiles: Array.from({ length: h }, (_, y) =>
      csv
        .slice(y * w, (y + 1) * w)
        .map((n) => n - 1)
        .join(""),
    ),
    props: [],
    entities: [],
  };
  for (const e of actors) {
    const [x, y] = e.__grid;
    if (e.__identifier === "Prop")
      stamp.props.push({
        x,
        y,
        kind: field(e, "kind", ""),
        interactive: field(e, "interactive", false),
      });
    else if (e.__identifier === "Plant" || e.__identifier === "Enemy")
      stamp.entities.push({
        x,
        y,
        kind: e.__identifier.toLowerCase(),
        ref: field(e, "ref", ""),
      });
    else throw new Error(`未知奇遇实体：${e.__identifier}`);
  }
  return stamp;
}
