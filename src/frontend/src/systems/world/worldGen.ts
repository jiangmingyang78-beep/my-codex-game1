import type { GameData } from "@/core/dataTypes";
import { createRng } from "@/core/rng";
import diskOverrides from "@/data/worldOverrides.json";
import { type LdtkProjectJson, buildWorldFromLdtk } from "./ldtkAdapter";
import { WORLD_LAYOUT, type WorldLayout } from "./worldLayout";
import * as edits from "./worldOverrides";
import { type Grid, at, carveTerrain, tileIndex } from "./worldTerrain";
import {
  type SpawnPoint,
  TILE,
  type World,
  type WorldObject,
} from "./worldTypes";

const px = (tile: number, size: number) => (tile + 0.5) * size;

function reserve(
  g: Grid,
  taken: Set<number>,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x >= 0 && y >= 0 && x < g.w && y < g.h) taken.add(at(g, x, y));
    }
  }
}

/** Picks free tiles with a seeded RNG; `taken` holds tile indices that are not available. */
function placeNodes(
  data: GameData,
  g: Grid,
  taken: Set<number>,
  layout: WorldLayout,
): WorldObject[] {
  const rng = createRng(layout.seed);
  const size = data.tileSize;
  const out: WorldObject[] = [];
  for (const id of data.worldObjects.renewableWoodNodeIds) {
    const pt = layout.renewableWoodTiles[id];
    if (!pt) throw new Error(`Missing renewable wood tile for ${id}`);
    tileIndex(g, pt.x, pt.y);
    reserve(g, taken, pt.x, pt.y, 1);
    out.push({
      id,
      kind: "node",
      regionId: data.balance.starting.regionId,
      x: px(pt.x, size),
      y: px(pt.y, size),
      itemId: "wood",
      yield: 1,
      renewable: true,
    });
  }
  for (const { bounds, nodes, nodeArea } of layout.regions) {
    for (const plan of nodes ?? []) {
      if (!data.items.has(plan.itemId))
        throw new Error(`Unknown resource item ${plan.itemId}`);
      if (bounds.x1 - bounds.x0 <= 10 || bounds.y1 - bounds.y0 <= 10)
        throw new Error(`Resource area too small for ${bounds.id}`);
      for (let n = 1; n <= plan.count; n++) {
        for (let attempt = 0; attempt < 400; attempt++) {
          const x =
            bounds.x0 + 5 + Math.floor(rng() * (bounds.x1 - bounds.x0 - 10));
          const y =
            bounds.y0 + 5 + Math.floor(rng() * (bounds.y1 - bounds.y0 - 10));
          const tile = g.tiles[at(g, x, y)];
          if (
            (tile !== TILE.snow && tile !== TILE.floor && tile !== TILE.bog) ||
            taken.has(at(g, x, y))
          )
            continue;
          if (nodeArea?.minX !== undefined && x < nodeArea.minX) continue;
          if (plan.maxX !== undefined && x > plan.maxX) continue;
          if (nodeArea?.campDistance) {
            const d = Math.hypot(x - layout.campfire.x, y - layout.campfire.y);
            if (d < nodeArea.campDistance[0] || d > nodeArea.campDistance[1])
              continue;
          }
          reserve(g, taken, x, y, 1);
          out.push({
            id: `${plan.idPrefix}_${n}`,
            kind: "node",
            regionId: bounds.id,
            x: px(x, size),
            y: px(y, size),
            itemId: plan.itemId,
            yield: plan.yield,
            renewable: data.dawnRenewal.renewableItemIds.includes(plan.itemId),
          });
          break;
        }
      }
    }
  }
  return out;
}

function scatterTrees(g: Grid, taken: Set<number>, layout: WorldLayout): void {
  const rng = createRng(layout.seed ^ 0x7ee5);
  for (const { bounds: b, trees } of layout.regions) {
    if (!trees) continue;
    for (let y = b.y0 + 2; y <= b.y1 - 2; y++) {
      for (let x = b.x0 + 2; x <= Math.min(b.x1, trees.maxX); x++) {
        const i = at(g, x, y);
        if (g.tiles[i] !== TILE.snow || taken.has(i)) continue;
        if (
          rng() < trees.density ||
          (trees.denseEdges !== false &&
            (x === b.x0 + 2 || y === b.y0 + 2 || y === b.y1 - 2))
        )
          g.tiles[i] = TILE.tree;
      }
    }
  }
}

/** Builds the deterministic tile grid, collision data and object table. */
export function generateWorld(
  data: GameData,
  layout = WORLD_LAYOUT,
  overrides: edits.WorldOverrides = diskOverrides,
): World {
  const { widthTiles: w, heightTiles: h } = data.balance.world;
  const size = data.tileSize;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
    throw new Error("Invalid world dimensions");
  const g: Grid = { w, h, tiles: new Uint8Array(w * h) };
  carveTerrain(g, layout);
  const { campfire, heroStart } = layout;
  tileIndex(g, heroStart.x, heroStart.y);
  const taken = new Set<number>();
  for (let i = 0; i < g.tiles.length; i++)
    if (g.tiles[i] === TILE.path) taken.add(i);
  reserve(g, taken, campfire.x, campfire.y, 3);
  reserve(g, taken, heroStart.x, heroStart.y, 2);
  for (const t of Object.values(layout.spawns)) {
    tileIndex(g, t.x, t.y);
    reserve(g, taken, t.x, t.y, 2);
  }
  for (const {
    bounds,
    gate,
    relay,
    beacon,
    barrels,
    mirrorLamps,
  } of layout.regions) {
    if (relay) reserve(g, taken, relay.x, relay.y, 2);
    if (beacon) reserve(g, taken, beacon.x, beacon.y, 2);
    for (const b of barrels ?? []) reserve(g, taken, b.x, b.y, 1);
    for (const m of mirrorLamps ?? []) reserve(g, taken, m.x, m.y, 1);
    for (const p of data.regions.get(bounds.id)?.storyProps ?? [])
      reserve(g, taken, p.tileX, p.tileY, 1);
    for (const t of gate?.tiles ?? [])
      reserve(
        g,
        taken,
        t.x + (gate?.reserveOffset?.x ?? 0),
        t.y + (gate?.reserveOffset?.y ?? 0),
        2,
      );
  }

  const nodes = placeNodes(data, g, taken, layout);
  scatterTrees(g, taken, layout);

  const objects = new Map<string, WorldObject>();
  const add = (o: WorldObject) => {
    if (objects.has(o.id)) throw new Error(`Duplicate map object ${o.id}`);
    objects.set(o.id, o);
  };
  const pos = (p: { x: number; y: number }) => ({
    x: px(p.x, size),
    y: px(p.y, size),
  });
  add({
    id: data.worldObjects.mainCampfireId,
    kind: "campfire",
    regionId: data.balance.starting.regionId,
    ...pos(campfire),
  });
  const gateTiles = new Map<number, string>();
  const spawns = new Map<string, SpawnPoint>();
  for (const {
    bounds,
    gate,
    relay,
    beacon,
    barrels,
    mirrorLamps,
  } of layout.regions) {
    const region = data.regions.get(bounds.id);
    if (!region) throw new Error(`Unknown map region ${bounds.id}`);
    const gateId = region.entry.gateId;
    if (Boolean(gateId) !== Boolean(gate?.tiles.length))
      throw new Error(`Missing gate id or tiles for ${region.id}`);
    if (gateId && gate) {
      add({
        id: gateId,
        kind: "gate",
        regionId: region.id,
        ...pos(gate.interactAt),
      });
      for (const t of gate.tiles) {
        const index = at(g, t.x, t.y);
        if (gateTiles.has(index))
          throw new Error(`Overlapping gate tile (${t.x}, ${t.y})`);
        gateTiles.set(index, gateId);
      }
    }
    if (Boolean(region.relaySocketId) !== Boolean(relay))
      throw new Error(`Missing relay id or tile for ${region.id}`);
    if (region.relaySocketId && relay)
      add({
        id: region.relaySocketId,
        kind: "relay_socket",
        regionId: region.id,
        ...pos(relay),
      });
    if (beacon)
      add({
        id: data.worldObjects.finalBeaconId,
        kind: "beacon",
        regionId: region.id,
        ...pos(beacon),
      });
    for (const p of region.storyProps ?? []) {
      add({
        id: p.id,
        kind: "story_prop",
        regionId: region.id,
        ...pos({ x: p.tileX, y: p.tileY }),
        spriteKey: p.spriteKey,
        storyToast: p.toast,
        unlockNoteId: p.unlockNoteId,
        itemId: p.rewardItem?.itemId,
        yield: p.rewardItem?.count,
        pickupId: p.rewardItem?.pickupId,
      });
    }
    (barrels ?? []).forEach((b, idx) =>
      add({
        id: `${region.id}_barrel_${idx + 1}`,
        kind: "explosive_barrel",
        regionId: region.id,
        ...pos(b),
      }),
    );
    (mirrorLamps ?? []).forEach((m, idx) =>
      add({
        id: `${region.id}_lamp_${idx + 1}`,
        kind: "mirror_lamp",
        regionId: region.id,
        ...pos(m),
      }),
    );
    for (const s of [...edits.residents(region), ...region.nightSpawns]) {
      const t = layout.spawns[s.spawnId];
      if (!t) throw new Error(`Missing spawn tile for ${s.spawnId}`);
      if (spawns.has(s.spawnId))
        throw new Error(`Duplicate spawn id ${s.spawnId}`);
      spawns.set(s.spawnId, {
        spawnId: s.spawnId,
        regionId: region.id,
        ...pos(t),
      });
    }
  }
  for (const n of nodes) add(n);

  const world = {
    widthTiles: w,
    heightTiles: h,
    tileSize: size,
    tiles: g.tiles,
    regions: layout.regions.map(({ bounds }) => bounds),
    objects,
    objectList: [...objects.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    spawns,
    gateTiles,
    heroStart: pos(heroStart),
    campfire: pos(campfire),
  };
  return edits.applyWorldOverrides(world, overrides);
}

const worldsByData = new WeakMap<GameData, World>();
export function getWorld(data: GameData, ldtkMap?: LdtkProjectJson): World {
  if (ldtkMap) return buildWorldFromLdtk(ldtkMap, data);
  const cached = worldsByData.get(data);
  if (cached) return cached;
  const world = generateWorld(data);
  edits.syncResidentSpawns(data, world, diskOverrides);
  worldsByData.set(data, world);
  return world;
}
