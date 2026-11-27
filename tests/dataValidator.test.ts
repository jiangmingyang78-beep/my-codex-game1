import assert from "node:assert/strict";
import { dataFiles, loadGameData } from "@/core/gameData";
import { validateGameData } from "@/core/dataValidator";
import { RUN_SCHEMA_VERSION } from "@/core/saveMigration";
import { loadRun } from "@/core/save";
import { createMemoryStorage } from "@/core/storage";
import { createSystems } from "@/core/systems";
import { createRun } from "@/core/run";
import { it } from "./fixtures/it";

it("真实目录可完整加载，旧怪物、奖励与模式可见性相容", () => {
  const data = loadGameData();
  assert.equal(data.enemies.size, 20);
  assert.equal(data.enemies.get("beacon_keeper")?.attack.type, "alternating");
  assert.deepEqual(
    data.encounters.get("ice_gorge_guards")?.members.map((m) => m.enemyId),
    ["ice_ram", "coal_shade"],
  );
  assert.equal(
    [...data.enemies.values()].filter((e) => e.scope === "shared").length,
    10,
  );
});

const cases: [string, (files: typeof dataFiles) => void][] = [
  [
    "items.json.items[0].name",
    (f) => Reflect.deleteProperty(f.items.items[0], "name"),
  ],
  [
    "items.json.items[1].id",
    (f) => {
      f.items.items[1].id = f.items.items[0].id;
    },
  ],
  [
    "items.json.items[0].maxStack",
    (f) => {
      f.items.items[0].maxStack = 1.5;
    },
  ],
  [
    "enemies.json.enemies[0].scope",
    (f) => {
      f.enemies.enemies[0].scope = "elsewhere";
    },
  ],
  [
    "enemies.json.enemies[0].attack.windupSec",
    (f) => {
      f.enemies.enemies[0].attack!.windupSec = 0;
    },
  ],
  [
    "enemies.json.enemies[0].drops[0].probability",
    (f) => {
      f.enemies.enemies[0].drops[0].probability = NaN;
    },
  ],
  [
    "enemies.json.encounterRewards[0].members[0].enemyId",
    (f) => {
      f.enemies.encounterRewards[0].members[0].enemyId = "missing";
    },
  ],
  [
    "regions.json.regions[0].residentSpawns[0].enemyId",
    (f) => {
      f.regions.regions[0].residentSpawns[0].enemyId = "missing";
    },
  ],
  [
    "regions.json.regions[0].entry.requiredPickupIds[0]",
    (f) => {
      f.regions.regions[0].entry.requiredPickupIds = ["missing"];
    },
  ],
  [
    "recipes.json.recipes[0].inputs.ore",
    (f) => {
      f.recipes.recipes[0].inputs.ore = -1;
    },
  ],
  [
    "recipes.json.recipes[0].inputs.missing",
    (f) => {
      Object.assign(f.recipes.recipes[0].inputs, { missing: 1 });
    },
  ],
  [
    "recipes.json.recipes[0].output.id",
    (f) => {
      f.recipes.recipes[0].output.id = "missing";
    },
  ],
  [
    "survivalCampProjects.json.projects.wellhead.cost.wood",
    (f) => {
      f.survivalCampProjects.projects.wellhead.cost.wood = Infinity;
    },
  ],
  [
    "survivalCampProjects.json.projects.wellhead.cost.missing",
    (f) => {
      Object.assign(f.survivalCampProjects.projects.wellhead.cost, {
        missing: 1,
      });
    },
  ],
  [
    "metaUnlocks.json[1].condition.enemyId",
    (f) => {
      f.metaUnlocks[1].condition.enemyId = "missing";
    },
  ],
  [
    "metaUnlocks.json[2].condition.anyOf[0].pickupId",
    (f) => {
      f.metaUnlocks[2].condition.anyOf![0].pickupId = "missing";
    },
  ],
  [
    "metaUnlocks.json[1].condition.plantId",
    (f) => {
      Object.assign(f.metaUnlocks[1].condition, { plantId: "missing" });
    },
  ],
  [
    "metaUnlocks.json[1].targetKey",
    (f) => {
      f.metaUnlocks[1].targetKey = "wood";
    },
  ],
  [
    "catalogDefinitions.json.plantIds[0]",
    (f) => {
      f.catalogDefinitions.plantIds[0] = "missing";
    },
  ],
  [
    "plants.json.plants[0].stageSec[0]",
    (f) => {
      f.plants.plants[0].stageSec[0] = 0;
    },
  ],
  [
    "weather.json.weathers[0].transitions.missing",
    (f) => {
      Object.assign(f.weather.weathers[0].transitions, { missing: 1 });
    },
  ],
  [
    "balance.json.clock.daySec",
    (f) => {
      f.balance.clock.daySec = 0;
    },
  ],
];
for (const [path, mutate] of cases)
  it("启动校验定位 " + path, () => {
    const files = structuredClone(dataFiles);
    mutate(files);
    assert.throws(
      () => validateGameData(files),
      (error) => error instanceof Error && error.message.startsWith(path + ":"),
    );
  });

for (const version of [1, 2, 3, 4])
  it(`v${version} 存档保留旧怪物 ID 与固定拾取，读入 v4`, () => {
    const sys = createSystems(),
      storage = createMemoryStorage();
    const state = createRun({ systems: sys, seed: 42, runId: "migration" });
    const enemy = Object.values(state.enemiesById)[0];
    enemy.enemyId = "coal_shade";
    enemy.hp = 2;
    const snapshot = {
      ...state,
      schemaVersion: version,
      seals: ["ice_gorge_ember_seal"],
    };
    if (version < 3) Reflect.deleteProperty(snapshot, "heroId");
    storage.setItem(
      sys.data.balance.storage.runKey,
      JSON.stringify({ schemaVersion: version, state: snapshot }),
    );
    const result = loadRun(storage, sys);
    assert.equal(result.status, "ok");
    assert.equal(RUN_SCHEMA_VERSION, 4);
    assert.equal(result.snapshot?.schemaVersion, 4);
    assert.equal(result.snapshot?.heroId, "lin_tinder");
    assert.equal(result.snapshot?.enemiesById[enemy.id].enemyId, "coal_shade");
    assert.ok(result.snapshot?.seals.includes("ice_gorge_ember_seal"));
  });

it("各阶段怪物攻击与特殊行为均可定位到具体字段", () => {
  const f = structuredClone(dataFiles);
  const i = f.enemies.enemies.findIndex((e) => e.seedType === "warden_phase");
  f.enemies.enemies[i].phases![0].overrides.attack.windupSec = NaN;
  assert.throws(
    () => validateGameData(f),
    new RegExp("phases\\[0\\]\\.overrides\\.attack\\.windupSec"),
  );
  const g = structuredClone(dataFiles);
  g.enemies.enemies[0].specialKey = "missing";
  assert.throws(
    () => validateGameData(g),
    /enemies\.json\.enemies\[0\]\.specialKey/,
  );
});
