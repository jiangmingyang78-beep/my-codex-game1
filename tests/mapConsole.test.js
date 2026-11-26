import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGameData } from "@/core/gameData";
import { generateWorld } from "@/systems/world/worldGen";
import {
  applyWorldOverrides,
  syncResidentSpawns,
} from "@/systems/world/worldOverrides";
import { adventureSource } from "../tools/map-viewer/adapters/adventureAdapter";
import {
  ConsoleStore,
  validateDraft,
} from "../tools/map-viewer/state/consoleStore";
import { emptyOverrides, files } from "../tools/map-viewer/state/documents";
import { it } from "./fixtures/it";

const clean = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => {
      if (file === "worldOverrides.json")
        return [file, structuredClone(emptyOverrides)];
      const directory =
        file === "survival-balance.json" ? "public/" : "src/data/";
      try {
        const content = await readFile(
          new URL(`../src/frontend/${directory}${file}`, import.meta.url),
          "utf8",
        );
        return [file, JSON.parse(content)];
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return [file, {}];
      }
    }),
  ),
);
const source = adventureSource();
const map = source();
const node = map.objects.find((object) => object.itemId === "ore");
const camp = map.spawns.find((spawn) => spawn.kind === "hero");
const resident = map.spawns.find((spawn) => spawn.kind === "resident");
assert.ok(node && camp && resident);
const campTile = { tx: camp.tx, ty: camp.ty };

function editedDraft() {
  const draft = structuredClone(clean);
  const edit = draft["worldOverrides.json"];
  edit.addedObjects.push({
    id: "verify_ore",
    itemId: "ore",
    yield: 3,
    ...campTile,
  });
  edit.editedObjects[node.id] = { yield: 5, renewable: true };
  edit.movedObjects[node.id] = campTile;
  edit.removedObjectIds.push(
    map.objects.find((object) => object.itemId === "wood").id,
  );
  edit.movedSpawns[resident.id] = { tx: node.tx, ty: node.ty };
  edit.editedSpawns[resident.id] = { enemyId: "ash_wolf" };
  edit.addedSpawns.push({
    id: "verify_spawn",
    enemyId: "frost_rat",
    ...campTile,
  });
  edit.removedSpawnIds.push(
    map.spawns.find(
      (spawn) => spawn.kind === "resident" && spawn.id !== resident.id,
    ).id,
  );
  return draft;
}

it("空白草稿有效，空覆写复用原地图", () => {
  const world = generateWorld(buildGameData(), undefined, emptyOverrides);
  assert.deepEqual(validateDraft(clean, clean, map), []);
  assert.equal(applyWorldOverrides(world, emptyOverrides), world);
});

it("覆写更新点位和对应常驻表，重复同步保持幂等", () => {
  const data = structuredClone(buildGameData());
  const world = generateWorld(data, undefined, emptyOverrides);
  const draft = editedDraft();
  const edit = draft["worldOverrides.json"];
  assert.deepEqual(validateDraft(draft, clean, map), []);
  const result = applyWorldOverrides(world, edit);
  const resolved = source(edit, draft);
  assert.equal(result.objects.get(node.id).yield, 5);
  assert.equal(
    result.objects.get("verify_ore").x,
    (campTile.tx + 0.5) * world.tileSize,
  );
  assert.equal(result.objects.has(edit.removedObjectIds[0]), false);
  assert.equal(result.objectList.length, result.objects.size);
  assert.equal(result.spawns.has(edit.removedSpawnIds[0]), false);
  assert.equal(
    resolved.spawns.find((spawn) => spawn.id === resident.id).enemyId,
    "ash_wolf",
  );
  syncResidentSpawns(data, result, edit);
  syncResidentSpawns(data, result, edit);
  const roster = data.regionList.flatMap((region) => region.residentSpawns);
  assert.equal(
    roster.filter((spawn) => spawn.spawnId === "verify_spawn").length,
    1,
  );
  assert.equal(
    roster.some((spawn) => spawn.spawnId === edit.removedSpawnIds[0]),
    false,
  );
  assert.ok(
    data.regions
      .get(node.regionId)
      .residentSpawns.some(
        (spawn) =>
          spawn.spawnId === resident.id && spawn.enemyId === "ash_wolf",
      ),
  );
  assert.deepEqual(generateWorld(data, undefined, emptyOverrides), world);
});

it("运行时裁剪越界点位，编辑器报告越界", () => {
  const world = generateWorld(buildGameData(), undefined, emptyOverrides);
  const draft = editedDraft();
  const edit = draft["worldOverrides.json"];
  edit.movedObjects[node.id] = { tx: -8, ty: 999999 };
  const clipped = applyWorldOverrides(world, edit).objects.get(node.id);
  assert.equal(clipped.x, world.tileSize / 2);
  assert.equal(clipped.y, (world.heightTiles - 0.5) * world.tileSize);
  assert.ok(
    validateDraft(draft, clean, map).some(
      (issue) => issue.file === "worldOverrides.json",
    ),
  );
});

it.each([
  {
    label: "阻挡格",
    change: (draft) => {
      draft["worldOverrides.json"].movedObjects[node.id] = { tx: 0, ty: 0 };
    },
  },
  {
    label: "引用的 ID 不存在",
    field: "enemyId",
    change: (draft) => {
      draft["worldOverrides.json"].addedSpawns[0].enemyId = "missing_enemy";
    },
  },
  {
    label: "引用的 ID 不存在",
    field: "itemId",
    change: (draft) => {
      draft["worldOverrides.json"].addedObjects[0].itemId = "missing_item";
    },
  },
  {
    label: "生命上限",
    change: (draft) => {
      draft["balance.json"].stats.hp.max = -1;
    },
  },
  {
    label: "0 到 1",
    change: (draft) => {
      draft["enemies.json"].enemies[0].drops[0].probability = 2;
    },
  },
  {
    label: "间隔必须",
    change: (draft) => {
      draft["balance.json"].hero.attackCooldownSec = 0;
    },
  },
])(
  ({ label, field }) => `拒绝无效草稿 · ${field ?? label}`,
  ({ label, field, change }) => {
    const draft = editedDraft();
    change(draft);
    assert.ok(
      validateDraft(draft, clean, map).some(
        (issue) =>
          issue.message.includes(label) &&
          (!field || issue.path.at(-1) === field),
      ),
    );
  },
);

it("命令历史保留最近 50 步，并可复原字段和导出预设", () => {
  const store = new ConsoleStore(clean, clean);
  const key = ["hero", "attackDamage"];
  const base = store.draft["balance.json"].hero.attackDamage;
  for (let i = 1; i <= 55; i++) store.field("balance.json", key, base + i);
  assert.equal(store.history.undoCount, 50);
  for (let i = 0; i < 50; i++) store.undo();
  assert.equal(store.draft["balance.json"].hero.attackDamage, base + 5);
  store.redo();
  store.reset("balance.json", key);
  assert.equal(store.changes().length, 0);
  assert.equal(store.history.redoCount, 0);
  assert.deepEqual(JSON.parse(store.preset()).files, store.draft);
});
