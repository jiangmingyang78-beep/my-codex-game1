import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "../../src/frontend/node_modules/vite/dist/node/index.js";

const configFile = fileURLToPath(new URL("./vite.config.mjs", import.meta.url));
const server = await createServer({
  configFile,
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
});
try {
  const load = (name) => server.ssrLoadModule(name);
  const { emptyOverrides, files } = await load("/state/documents.ts");
  const { ConsoleStore, validateDraft } = await load("/state/consoleStore.ts");
  const { applyWorldOverrides, syncResidentSpawns } = await load("@/systems/world/worldOverrides");
  const { generateWorld } = await load("@/systems/world/worldGen");
  const data = (await load("@/core/gameData")).loadGameData();
  const source = (await load("/adapters/adventureAdapter.ts")).adventureSource();
  const map = source(),
    world = generateWorld(data, undefined, emptyOverrides);
  assert.equal(applyWorldOverrides(world, emptyOverrides), world);

  const docs = {};
  for (const file of files) {
    const path = file === "survival-balance.json" ? "public/" : "src/data/";
    try {
      docs[file] = JSON.parse(await readFile(new URL("../../src/frontend/" + path + file, import.meta.url), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      docs[file] = {};
    }
  }
  const clean = structuredClone(docs);
  clean["worldOverrides.json"] = structuredClone(emptyOverrides);
  const validate = (draft) => validateDraft(draft, clean, map);
  assert.deepEqual(validate(clean), []);

  const node = map.objects.find((p) => p.itemId === "ore");
  const camp = map.spawns.find((p) => p.kind === "hero");
  const spawn = map.spawns.find((p) => p.kind === "resident");
  const tile = { tx: camp.tx, ty: camp.ty };
  const draft = structuredClone(clean),
    o = draft["worldOverrides.json"];
  o.addedObjects.push({ id: "verify_ore", itemId: "ore", yield: 3, ...tile });
  o.editedObjects[node.id] = { yield: 5, renewable: true };
  o.movedObjects[node.id] = tile;
  o.removedObjectIds.push(map.objects.find((p) => p.itemId === "wood").id);
  o.movedSpawns[spawn.id] = { tx: node.tx, ty: node.ty };
  o.editedSpawns[spawn.id] = { enemyId: "ash_wolf" };
  o.addedSpawns.push({ id: "verify_spawn", enemyId: "frost_rat", ...tile });
  o.removedSpawnIds.push(map.spawns.find((p) => p.kind === "resident" && p.id !== spawn.id).id);
  assert.deepEqual(validate(draft), []);
  const result = applyWorldOverrides(world, o),
    resolved = source(o, draft);
  assert.equal(result.objects.get(node.id).yield, 5);
  assert.equal(result.objects.get("verify_ore").x, (tile.tx + 0.5) * world.tileSize);
  assert.equal(result.objects.has(o.removedObjectIds[0]), false);
  assert.equal(result.objectList.length, result.objects.size);
  assert.equal(result.spawns.has(o.removedSpawnIds[0]), false);
  assert.equal(resolved.spawns.find((p) => p.id === spawn.id).enemyId, "ash_wolf");
  syncResidentSpawns(data, result, o);
  syncResidentSpawns(data, result, o);
  const roster = data.regionList.flatMap((r) => r.residentSpawns);
  assert.equal(roster.filter((p) => p.spawnId === "verify_spawn").length, 1);
  assert.equal(
    roster.some((p) => p.spawnId === o.removedSpawnIds[0]),
    false,
  );
  const targetRegion = data.regions.get(node.regionId);
  assert(targetRegion.residentSpawns.some((p) => p.spawnId === spawn.id && p.enemyId === "ash_wolf"));
  assert.deepEqual(generateWorld(data, undefined, emptyOverrides), world);
  o.movedObjects[node.id] = { tx: -8, ty: 999999 };
  const clipped = applyWorldOverrides(world, o).objects.get(node.id);
  assert.equal(clipped.x, world.tileSize / 2);
  assert.equal(clipped.y, (world.heightTiles - 0.5) * world.tileSize);
  assert(validate(draft).some((i) => i.file === "worldOverrides.json"));
  o.movedObjects[node.id] = { tx: 0, ty: 0 };
  assert(validate(draft).some((i) => i.message.includes("阻挡格")));
  o.addedSpawns[0].enemyId = "missing_enemy";
  o.addedObjects[0].itemId = "missing_item";
  draft["balance.json"].stats.hp.max = -1;
  draft["enemies.json"].enemies[0].drops[0].probability = 2;
  draft["balance.json"].hero.attackCooldownSec = 0;
  for (const text of ["ID 不存在", "生命上限", "0 到 1", "间隔必须"])
    assert(validate(draft).some((i) => i.message.includes(text)));

  const s = new ConsoleStore(clean, clean),
    key = ["hero", "attackDamage"];
  const base = s.draft["balance.json"].hero.attackDamage;
  for (let i = 1; i <= 55; i++) s.field("balance.json", key, base + i);
  assert.equal(s.history.undoCount, 50);
  for (let i = 0; i < 50; i++) s.undo();
  assert.equal(s.draft["balance.json"].hero.attackDamage, base + 5);
  s.redo();
  s.reset("balance.json", key);
  assert.equal(s.changes().length, 0);
  assert.equal(s.history.redoCount, 0);
  assert.deepEqual(JSON.parse(s.preset()).files, s.draft);
  console.log("通过：空覆写、点位增删改/裁剪、常驻表、外键及阻挡格校验、50 步命令栈、字段复原与预设。");
} finally {
  await server.close();
}
