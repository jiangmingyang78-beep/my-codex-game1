import assert from "node:assert/strict";
import {
  type LdtkProjectJson,
  buildWorldFromLdtk,
} from "@/systems/world/ldtkAdapter";
import { getWorld } from "@/systems/world/worldGen";
import { TILE } from "@/systems/world/worldTypes";
import { it } from "./fixtures/it";
import { getTestSystems } from "./fixtures/testFactories";

const { data, world: adventureWorld } = getTestSystems();
const ts = data.tileSize;
const w = 12;
const h = 8;
const tileCases = [
  [0, TILE.wall],
  [1, TILE.snow],
  [2, TILE.path],
  [3, TILE.tree],
  [4, TILE.wall],
  [5, TILE.floor],
  [6, TILE.door],
  [7, TILE.ice],
  [8, TILE.fireBase],
  [9, TILE.bog],
] as const;
const intGridCsv = new Array<number>(w * h).fill(1);
for (const [code] of tileCases) intGridCsv[code] = code;

function entity(
  identifier: string,
  x: number,
  y: number,
  fields: Record<string, unknown> = {},
  width = 1,
  height = 1,
) {
  return {
    __identifier: identifier,
    __grid: [x, y] as [number, number],
    px: [x * ts, y * ts] as [number, number],
    width: width * ts,
    height: height * ts,
    fieldInstances: Object.entries(fields).map(([key, value]) => ({
      __identifier: key,
      __value: value,
    })),
  };
}

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
            entity("HeroStart", 2, 2),
            entity("Campfire", 3, 2, { regionId: "camp" }),
            entity("Region", 1, 1, { regionId: "deep_woods" }, 10, 6),
            entity("Spawn", 8, 3, {
              regionId: "deep_woods",
              spawnId: "sp_test_1",
            }),
            entity(
              "Gate",
              5,
              1,
              { regionId: "deep_woods", gateId: "gate_test" },
              2,
            ),
            entity("RelaySocket", 4, 4, {
              regionId: "deep_woods",
              relayId: "relay_test",
            }),
            entity("ResourceNode", 6, 4, {
              objectId: "node_wood_1",
              itemId: "wood",
              yield: 2,
            }),
            entity("StoryProp", 2, 5, {
              objectId: "prop_basket",
              toast: "The herb breath of the remains has not yet dissipated.",
              unlockNoteId: "note_suheng_1",
            }),
            entity("ExplosiveBarrel", 7, 5, {
              regionId: "burnt_caravan",
              objectId: "barrel_test_1",
            }),
            entity("MirrorLamp", 9, 5, {
              regionId: "mirror_hall",
              objectId: "lamp_test_1",
            }),
          ],
        },
      ],
    },
  ],
};

const world = buildWorldFromLdtk(mockLdtk, data);

it.each(tileCases)(
  ([code]) => `The LTtk IntGadd map ${code}`,
  ([code, tile]) => assert.equal(world.tiles[code], tile),
);

it("Read map sizes, areas, birth point and camp fires", () => {
  assert.equal(world.widthTiles, w);
  assert.equal(world.heightTiles, h);
  assert.equal(world.tileSize, ts);
  assert.deepEqual(world.heroStart, { x: 2.5 * ts, y: 2.5 * ts });
  assert.deepEqual(world.campfire, { x: 3.5 * ts, y: 2.5 * ts });
  assert.equal(world.tiles[2 * w + 3], TILE.fireBase);
  assert.equal(
    world.objects.get(data.worldObjects.mainCampfireId)?.kind,
    "campfire",
  );
  assert.deepEqual(world.regions, [
    { id: "deep_woods", x0: 1, y0: 1, x1: 10, y1: 6 },
  ]);
  assert.deepEqual(world.spawns.get("sp_test_1"), {
    spawnId: "sp_test_1",
    regionId: "deep_woods",
    x: 8.5 * ts,
    y: 3.5 * ts,
  });
});

it.each([5, 6])(
  (x) => `Dogman's collision map x =${x}`,
  (x) => {
    assert.equal(world.objects.get("gate_test")?.kind, "gate");
    assert.equal(world.tiles[w + x], TILE.door);
    assert.equal(world.gateTiles.get(w + x), "gate_test");
  },
);

it("Read the fire basin, resource points and property properties", () => {
  assert.equal(world.objects.get("relay_test")?.kind, "relay_socket");
  assert.equal(world.tiles[4 * w + 4], TILE.fireBase);
  const node = world.objects.get("node_wood_1");
  assert.equal(node?.kind, "node");
  assert.equal(node?.itemId, "wood");
  assert.equal(node?.yield, 2);
  assert.equal(
    node?.renewable,
    data.dawnRenewal.renewableItemIds.includes("wood"),
  );
  const prop = world.objects.get("prop_basket");
  assert.equal(prop?.kind, "story_prop");
  assert.equal(prop?.storyToast, "The herb breath of the remains has not yet dissipated.");
  assert.equal(prop?.unlockNoteId, "note_suheng_1");
});

it.each([
  ["barrel_test_1", "explosive_barrel", "burnt_caravan"],
  ["lamp_test_1", "mirror_lamp", "mirror_hall"],
] as const)(
  ([id]) => `Imports world objects with a range ${id}`,
  ([id, kind, regionId]) => {
    assert.equal(world.objects.get(id)?.kind, kind);
    assert.equal(world.objects.get(id)?.regionId, regionId);
  },
);

it("Sort map objects steadily and allow for the coverage of built-in maps", () => {
  const ids = world.objectList.map((object) => object.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(getWorld(data, mockLdtk).widthTiles, w);
  assert.equal(adventureWorld.widthTiles, data.balance.world.widthTiles);
  assert.equal(adventureWorld.heightTiles, data.balance.world.heightTiles);
});

it("Deny missing the LDtk map of the lauin layer", () => {
  assert.throws(
    () =>
      buildWorldFromLdtk(
        {
          levels: [
            { identifier: "Bad", pxWid: 16, pxHei: 16, layerInstances: [] },
          ],
        },
        data,
      ),
    /Terrain/,
  );
});
