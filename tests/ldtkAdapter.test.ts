import assert from "node:assert/strict";
import { loadGameData } from "@/core/gameData";
import {
  type LdtkProjectJson,
  buildWorldFromLdtk,
} from "@/systems/world/ldtkAdapter";
import { getWorld } from "@/systems/world/worldGen";
import { TILE } from "@/systems/world/worldTypes";

const data = loadGameData();
const ts = data.tileSize;
const w = 12;
const h = 8;

// Build a 12x8 IntGrid covering 0 (fallback wall) and 1..9 (TILE 0..8, including 9 -> TILE.bog).
const intGridCsv = new Array<number>(w * h).fill(1);
intGridCsv[0] = 0; // -> TILE.wall (3)
intGridCsv[1] = 1; // -> TILE.snow (0)
intGridCsv[2] = 2; // -> TILE.path (1)
intGridCsv[3] = 3; // -> TILE.tree (2)
intGridCsv[4] = 4; // -> TILE.wall (3)
intGridCsv[5] = 5; // -> TILE.floor (4)
intGridCsv[6] = 6; // -> TILE.door (5)
intGridCsv[7] = 7; // -> TILE.ice (6)
intGridCsv[8] = 8; // -> TILE.fireBase (7)
intGridCsv[9] = 9; // -> TILE.bog (8)

const mockLdtk: LdtkProjectJson = {
  levels: [
    {
      identifier: "TestLevel",
      pxWid: w * ts,
      pxHei: h * ts,
      layerInstances: [
        {
          __identifier: "Terrain",
          __type: "IntGrid",
          __cWid: w,
          __cHei: h,
          __gridSize: ts,
          intGridCsv,
        },
        {
          __identifier: "Entities",
          __type: "Entities",
          __cWid: w,
          __cHei: h,
          __gridSize: ts,
          entityInstances: [
            {
              __identifier: "HeroStart",
              __grid: [2, 2],
              px: [2 * ts, 2 * ts],
              width: ts,
              height: ts,
              fieldInstances: [],
            },
            {
              __identifier: "Campfire",
              __grid: [3, 2],
              px: [3 * ts, 2 * ts],
              width: ts,
              height: ts,
              fieldInstances: [{ __identifier: "regionId", __value: "camp" }],
            },
            {
              __identifier: "Region",
              __grid: [1, 1],
              px: [1 * ts, 1 * ts],
              width: 10 * ts,
              height: 6 * ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
              ],
            },
            {
              __identifier: "Spawn",
              __grid: [8, 3],
              px: [8 * ts, 3 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
                { __identifier: "spawnId", __value: "sp_test_1" },
              ],
            },
            {
              __identifier: "Gate",
              __grid: [5, 1],
              px: [5 * ts, 1 * ts],
              width: 2 * ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
                { __identifier: "gateId", __value: "gate_test" },
              ],
            },
            {
              __identifier: "RelaySocket",
              __grid: [4, 4],
              px: [4 * ts, 4 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
                { __identifier: "relayId", __value: "relay_test" },
              ],
            },
            {
              __identifier: "ResourceNode",
              __grid: [6, 4],
              px: [6 * ts, 4 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
                { __identifier: "objectId", __value: "node_wood_1" },
                { __identifier: "itemId", __value: "wood" },
                { __identifier: "yield", __value: 2 },
              ],
            },
            {
              __identifier: "StoryProp",
              __grid: [2, 5],
              px: [2 * ts, 5 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "deep_woods" },
                { __identifier: "objectId", __value: "prop_basket" },
                { __identifier: "toast", __value: "遗物中的草药气息尚未散去。" },
                { __identifier: "unlockNoteId", __value: "note_suheng_1" },
              ],
            },
            {
              __identifier: "ExplosiveBarrel",
              __grid: [7, 5],
              px: [7 * ts, 5 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "burnt_caravan" },
                { __identifier: "objectId", __value: "barrel_test_1" },
              ],
            },
            {
              __identifier: "MirrorLamp",
              __grid: [9, 5],
              px: [9 * ts, 5 * ts],
              width: ts,
              height: ts,
              fieldInstances: [
                { __identifier: "regionId", __value: "mirror_hall" },
                { __identifier: "objectId", __value: "lamp_test_1" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const world = buildWorldFromLdtk(mockLdtk, data);

// 1) Terrain IntGrid mapping (including 0 -> wall & 9 -> TILE.bog)
assert.equal(world.widthTiles, w);
assert.equal(world.heightTiles, h);
assert.equal(world.tileSize, ts);
assert.equal(world.tiles[0], TILE.wall);
assert.equal(world.tiles[1], TILE.snow);
assert.equal(world.tiles[2], TILE.path);
assert.equal(world.tiles[3], TILE.tree);
assert.equal(world.tiles[4], TILE.wall);
assert.equal(world.tiles[5], TILE.floor);
assert.equal(world.tiles[6], TILE.door);
assert.equal(world.tiles[7], TILE.ice);
assert.equal(world.tiles[8], TILE.fireBase);
assert.equal(world.tiles[9], TILE.bog);

// 2) HeroStart & Campfire
assert.deepEqual(world.heroStart, { x: 2.5 * ts, y: 2.5 * ts });
assert.deepEqual(world.campfire, { x: 3.5 * ts, y: 2.5 * ts });
assert.equal(world.tiles[2 * w + 3], TILE.fireBase);
assert.equal(
  world.objects.get(data.worldObjects.mainCampfireId)?.kind,
  "campfire",
);

// 3) Region
assert.deepEqual(world.regions, [
  { id: "deep_woods", x0: 1, y0: 1, x1: 10, y1: 6 },
]);

// 4) Spawn
assert.deepEqual(world.spawns.get("sp_test_1"), {
  spawnId: "sp_test_1",
  regionId: "deep_woods",
  x: 8.5 * ts,
  y: 3.5 * ts,
});

// 5) Gate (2x1 tiles)
const gateObj = world.objects.get("gate_test");
assert.equal(gateObj?.kind, "gate");
assert.equal(world.tiles[1 * w + 5], TILE.door);
assert.equal(world.tiles[1 * w + 6], TILE.door);
assert.equal(world.gateTiles.get(1 * w + 5), "gate_test");
assert.equal(world.gateTiles.get(1 * w + 6), "gate_test");

// 6) RelaySocket
const relayObj = world.objects.get("relay_test");
assert.equal(relayObj?.kind, "relay_socket");
assert.equal(world.tiles[4 * w + 4], TILE.fireBase);

// 7) ResourceNode, StoryProp, ExplosiveBarrel, MirrorLamp
const nodeObj = world.objects.get("node_wood_1");
assert.equal(nodeObj?.kind, "node");
assert.equal(nodeObj?.itemId, "wood");
assert.equal(nodeObj?.yield, 2);
assert.equal(
  nodeObj?.renewable,
  data.dawnRenewal.renewableItemIds.includes("wood"),
);

const propObj = world.objects.get("prop_basket");
assert.equal(propObj?.kind, "story_prop");
assert.equal(propObj?.storyToast, "遗物中的草药气息尚未散去。");
assert.equal(propObj?.unlockNoteId, "note_suheng_1");

const barrelObj = world.objects.get("barrel_test_1");
assert.equal(barrelObj?.kind, "explosive_barrel");
assert.equal(barrelObj?.regionId, "burnt_caravan");

const lampObj = world.objects.get("lamp_test_1");
assert.equal(lampObj?.kind, "mirror_lamp");
assert.equal(lampObj?.regionId, "mirror_hall");

// 8) Sorted objectList & getWorld fallback/override
const sortedIds = world.objectList.map((o) => o.id);
assert.deepEqual(
  sortedIds,
  [...sortedIds].sort((a, b) => (a < b ? -1 : 1)),
);
const switched = getWorld(data, mockLdtk);
assert.equal(switched.widthTiles, w);
const defaultWorld = getWorld(data);
assert.equal(defaultWorld.widthTiles, data.balance.world.widthTiles);
assert.equal(defaultWorld.heightTiles, data.balance.world.heightTiles);

// 9) Error validation for invalid LDtk inputs
assert.throws(
  () => buildWorldFromLdtk({ levels: [{ identifier: "Bad", pxWid: 16, pxHei: 16, layerInstances: [] }] }, data),
  /Terrain/,
);

console.log("LDTK_ADAPTER_UNIT_TEST_PASSED");
