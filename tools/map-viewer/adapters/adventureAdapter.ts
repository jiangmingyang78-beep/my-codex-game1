import { loadGameData } from "@/core/gameData";
import { createEternalSystems } from "@/systems/eternal/eternalWorld";
import { solidAt } from "@/systems/world/collision";
import { applyWorldOverrides, type WorldOverrides } from "@/systems/world/worldOverrides";
import { lookupEnemy, bossEnemy } from "../state/derivedMetrics";
import { emptyOverrides, type Draft } from "../state/documents";
import { generateWorld } from "@/systems/world/worldGen";
import { TILE, type World, type WorldObject } from "@/systems/world/worldTypes";
import type { MapObject, MapObjectKind, MapSnapshot, MapSpawn, TilePaletteEntry } from "../types";

const ADVENTURE_PALETTE: Record<number, TilePaletteEntry> = {
  [TILE.snow]: { id: TILE.snow, key: "snow", name: "雪地", color: "#2d3c56", accent: "#43597d", solid: false },
  [TILE.path]: { id: TILE.path, key: "path", name: "浅雪小径", color: "#586d8a", accent: "#7b93b3", solid: false },
  [TILE.tree]: {
    id: TILE.tree,
    key: "tree",
    name: "深林雪松（阻挡）",
    color: "#15232b",
    accent: "#223b3b",
    solid: true,
  },
  [TILE.wall]: {
    id: TILE.wall,
    key: "wall",
    name: "石墙/山岩（阻挡）",
    color: "#1b1f2e",
    accent: "#394159",
    solid: true,
  },
  [TILE.floor]: { id: TILE.floor, key: "floor", name: "磨坊木板", color: "#4d382b", accent: "#6b4f3d", solid: false },
  [TILE.door]: {
    id: TILE.door,
    key: "door",
    name: "铁门（关时阻挡）",
    color: "#9b5634",
    accent: "#d8925a",
    solid: true,
  },
  [TILE.ice]: { id: TILE.ice, key: "ice", name: "冻溪冰面", color: "#3d6a87", accent: "#7ce8ff", solid: false },
  [TILE.fireBase]: {
    id: TILE.fireBase,
    key: "fireBase",
    name: "火盆石座（阻挡）",
    color: "#723624",
    accent: "#ff7a2f",
    solid: true,
  },
  [TILE.bog]: { id: TILE.bog, key: "bog", name: "冻沼泥地", color: "#273b3a", accent: "#4e7a57", solid: false },
};

const REGION_NAME_FALLBACK: Record<string, string> = {
  camp_edge: "炉边雪林",
  old_mill: "废磨坊",
  deep_woods: "密林深处",
  frost_ridge: "霜渊山脊",
};

function mapResourceKind(itemId?: string): MapObjectKind {
  if (itemId === "wood") return "wood";
  if (itemId === "ore") return "ore";
  if (itemId === "stone") return "stone";
  if (itemId === "herb") return "herb";
  if (itemId === "fiber") return "fiber";
  return "food";
}

function buildSolidMask(world: World): Uint8Array {
  const mask = new Uint8Array(world.widthTiles * world.heightTiles);
  for (let ty = 0; ty < world.heightTiles; ty += 1) {
    for (let tx = 0; tx < world.widthTiles; tx += 1) {
      if (solidAt(world, {}, tx, ty)) mask[ty * world.widthTiles + tx] = 1;
    }
  }
  return mask;
}

function mapWorldObject(obj: WorldObject, data: ReturnType<typeof loadGameData>): MapObject {
  const tx = Math.floor(obj.x / data.tileSize);
  const ty = Math.floor(obj.y / data.tileSize);
  if (obj.kind === "campfire") {
    return {
      id: obj.id,
      kind: "campfire",
      label: "主营火",
      tx,
      ty,
      radiusTiles: data.balance.camp.radiiTilesByLevel[1] ?? 4,
      regionId: obj.regionId,
      detail: "初始安全火圈（可升至 Lv.3）",
    };
  }
  if (obj.kind === "relay_socket") {
    return {
      id: obj.id,
      kind: "relay_socket",
      label: "接力火站",
      tx,
      ty,
      radiusTiles: data.balance.camp.relayRadiusTiles ?? 5,
      regionId: obj.regionId,
      detail: `接力火盆点亮后提供半径 ${data.balance.camp.relayRadiusTiles} 格火圈`,
    };
  }
  if (obj.kind === "gate") {
    return { id: obj.id, kind: "gate", label: "区域铁门", tx, ty, regionId: obj.regionId, detail: obj.id };
  }
  if (obj.kind === "beacon") {
    return {
      id: obj.id,
      kind: "beacon",
      label: "东端烽台",
      tx,
      ty,
      radiusTiles: 4,
      regionId: obj.regionId,
      detail: "持两枚炉印可重燃通关",
    };
  }
  if (obj.kind === "node") {
    const item = obj.itemId ? data.items.get(obj.itemId) : undefined;
    const itemName = item?.name ?? obj.itemId ?? "资源";
    return {
      id: obj.id,
      kind: mapResourceKind(obj.itemId),
      itemId: obj.itemId,
      yield: obj.yield,
      renewable: obj.renewable,
      label: `${itemName} ×${obj.yield ?? 1}`,
      tx,
      ty,
      regionId: obj.regionId,
      detail: `${obj.id} · ${obj.renewable ? "黎明可再生" : "固定存量"}`,
    };
  }
  return {
    id: obj.id,
    kind: obj.kind,
    label: obj.storyToast || obj.id,
    tx,
    ty,
    regionId: obj.regionId,
    detail: obj.id,
  };
}

export function adventureSource() {
  const data = loadGameData();
  let base = generateWorld(data, undefined, emptyOverrides);
  let renewal = data.dawnRenewal;
  const mask = buildSolidMask(base);
  return (overrides: WorldOverrides = emptyOverrides, draft?: Draft): MapSnapshot => {
    const nextRenewal = draft?.["regions.json"].dawnRenewal ?? data.dawnRenewal;
    if (nextRenewal !== renewal) {
      renewal = nextRenewal;
      base = generateWorld({ ...data, dawnRenewal: renewal }, undefined, emptyOverrides);
    }
    const world = applyWorldOverrides(base, overrides);
    const spawnMeta = new Map<string, { enemyId: string; isNight: boolean }>();
    for (const reg of draft?.["regions.json"].regions ?? data.regionList) {
      for (const s of reg.residentSpawns) spawnMeta.set(s.spawnId, { enemyId: s.enemyId, isNight: false });
      for (const s of reg.nightSpawns) spawnMeta.set(s.spawnId, { enemyId: s.enemyId, isNight: true });
    }

    const spawns: MapSpawn[] = [
      {
        id: "hero_start",
        kind: "hero",
        label: "英雄出生点",
        tx: Math.floor(world.heroStart.x / world.tileSize),
        ty: Math.floor(world.heroStart.y / world.tileSize),
        detail: "冒险模式初始站位",
      },
    ];
    for (const s of overrides.addedSpawns) spawnMeta.set(s.id, { enemyId: s.enemyId, isNight: false });
    for (const sp of world.spawns.values()) {
      const meta = spawnMeta.get(sp.spawnId);
      const enemyId = overrides.editedSpawns[sp.spawnId]?.enemyId ?? meta?.enemyId;
      const enemy = enemyId ? (draft ? lookupEnemy(draft, enemyId) : data.enemies.get(enemyId)) : undefined;
      const isBoss = enemy && bossEnemy(enemy.id);
      spawns.push({
        id: sp.spawnId,
        enemyId,
        regionId: sp.regionId,
        kind: meta?.isNight ? "night" : isBoss ? "boss" : "resident",
        label: enemy?.name ?? sp.spawnId,
        tx: Math.floor(sp.x / world.tileSize),
        ty: Math.floor(sp.y / world.tileSize),
        detail: enemy
          ? `HP ${enemy.maxHp} · 伤害 ${enemy.attackDamage} · ${meta?.isNight ? "夜刷" : isBoss ? "首领" : "常驻"} (${sp.spawnId})`
          : sp.spawnId,
      });
    }

    return {
      mode: "adventure",
      title: "冒险模式 · 余烬林全图",
      subtitle: `${world.widthTiles}×${world.heightTiles} 格 · 对齐 worldGen.ts & worldLayout.ts`,
      width: world.widthTiles,
      height: world.heightTiles,
      originX: 0,
      originY: 0,
      tileSize: world.tileSize,
      tiles: world.tiles,
      solidMask: mask,
      palette: ADVENTURE_PALETTE,
      regions: world.regions.map((b) => ({
        id: b.id,
        name: data.regions.get(b.id)?.name ?? REGION_NAME_FALLBACK[b.id] ?? b.id,
        x: b.x0,
        y: b.y0,
        w: b.x1 - b.x0 + 1,
        h: b.y1 - b.y0 + 1,
      })),
      objects: world.objectList.map((o) => mapWorldObject(o, data)),
      spawns,
      campRadiiByLevel: { ...(draft?.["balance.json"] ?? data.balance).camp.radiiTilesByLevel },
    };
  };
}

export function buildEternalSnapshot(): MapSnapshot {
  const { data, world } = createEternalSystems();
  return {
    mode: "eternal",
    title: "永恒模式 · 永夜守炉场",
    subtitle: `${world.widthTiles}×${world.heightTiles} 格 · 对齐 eternalWorld.ts (Lv.3 营火开局)`,
    width: world.widthTiles,
    height: world.heightTiles,
    originX: 0,
    originY: 0,
    tileSize: world.tileSize,
    tiles: world.tiles,
    solidMask: buildSolidMask(world),
    palette: ADVENTURE_PALETTE,
    regions: [{ id: "eternal_arena", name: "永夜营火林地", x: 0, y: 0, w: world.widthTiles, h: world.heightTiles }],
    objects: world.objectList.map((o) => mapWorldObject(o, data)),
    spawns: [
      {
        id: "eternal_hero_start",
        kind: "hero",
        label: "英雄出生点",
        tx: Math.floor(world.heroStart.x / world.tileSize),
        ty: Math.floor(world.heroStart.y / world.tileSize),
        detail: "14 敌怪上限 · 永夜波次刷怪",
      },
    ],
    campRadiiByLevel: { ...data.balance.camp.radiiTilesByLevel },
  };
}
