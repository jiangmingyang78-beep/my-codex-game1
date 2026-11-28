import assert from "node:assert/strict";
import { afterEach, describe } from "node:test";
import { step } from "@/core/run";
import { exportRunSave, importRunSave, loadRun, saveRun } from "@/core/save";
import { RUN_SCHEMA_VERSION } from "@/core/saveMigration";
import type { EnemyState, RunState } from "@/core/types";
import { updateEnemies } from "@/systems/EnemyManager";
import { getDashCooldownState, moveHero } from "@/systems/movement";
import { rules } from "@/systems/runtimeRules";
import { recordHarvest, renewAtDawn, renewTimed } from "@/systems/world/dawn";
import type { WorldObject } from "@/systems/world/worldTypes";
import { it } from "./fixtures/it";
import {
  addTestEnemy,
  createMemoryStorage,
  createTestRun,
  getTestSystems,
  makeStepInput,
} from "./fixtures/testFactories";

const sys = getTestSystems();
const tileSize = sys.data.tileSize;
const initialRules = structuredClone(rules);

describe("Portable run saves", () => {
  const { runKey, runBackupKey } = sys.data.balance.storage;

  it("round-trips a validated JSON envelope and backs up the destination", () => {
    const origin = createMemoryStorage();
    const run = createTestRun({ systems: sys, elapsedSec: 184 });
    assert.deepEqual(saveRun(origin, run, sys), { ok: true });
    const json = exportRunSave(origin, sys);
    assert.ok(typeof json === "string");
    const envelope = JSON.parse(json);
    assert.equal(envelope.schemaVersion, RUN_SCHEMA_VERSION);
    assert.equal(envelope.savedAt, JSON.parse(origin.getItem(runKey)!).savedAt);
    assert.equal(envelope.state.elapsedSec, 184);

    const target = createMemoryStorage();
    assert.deepEqual(saveRun(target, createTestRun({ systems: sys }), sys), {
      ok: true,
    });
    const oldPrimary = target.getItem(runKey);
    assert.deepEqual(importRunSave(target, json, sys), { ok: true });
    assert.equal(target.getItem(runBackupKey), oldPrimary);
    assert.equal(loadRun(target, sys).snapshot?.elapsedSec, 184);
    assert.ok(
      JSON.parse(target.getItem(runKey)!).savedAt >
        JSON.parse(oldPrimary!).savedAt,
    );
  });

  it("rejects bad JSON, invalid roots, and future versions before accessing either slot", () => {
    const storage = createMemoryStorage();
    const run = createTestRun({ systems: sys });
    assert.ok(saveRun(storage, run, sys).ok);
    assert.ok(saveRun(storage, run, sys).ok);
    const primary = storage.getItem(runKey);
    const backup = storage.getItem(runBackupKey);
    const attempts: string[] = [];
    const observed = {
      ...storage,
      getItem(key: string) {
        attempts.push(key);
        return storage.getItem(key);
      },
      setItem(key: string, value: string) {
        attempts.push(key);
        storage.setItem(key, value);
      },
    };
    const cases = [
      ["{", "corrupt_json"],
      ["[]", "invalid_root"],
      ['{"state":null}', "invalid_root"],
      ['{"state":{}}', "invalid_status"],
      [
        JSON.stringify({ schemaVersion: RUN_SCHEMA_VERSION + 1, state: {} }),
        "future_version",
      ],
      [
        JSON.stringify({
          schemaVersion: RUN_SCHEMA_VERSION,
          state: { schemaVersion: 1 },
        }),
        "version_mismatch",
      ],
      [JSON.stringify("界".repeat(180_000)), "too_large"],
    ];
    for (const [json, reason] of cases) {
      assert.deepEqual(importRunSave(observed, json, sys), {
        ok: false,
        reason,
      });
    }
    assert.deepEqual(attempts, []);
    assert.equal(storage.getItem(runKey), primary);
    assert.equal(storage.getItem(runBackupKey), backup);
  });

  it("returns structured export failures and protects newer local slots", () => {
    assert.deepEqual(exportRunSave(null, sys), {
      ok: false,
      reason: "storage_unavailable",
    });
    assert.deepEqual(exportRunSave(createMemoryStorage(), sys), {
      ok: false,
      reason: "empty",
    });

    const future = JSON.stringify({
      schemaVersion: RUN_SCHEMA_VERSION + 1,
      state: {},
    });
    const source = createMemoryStorage();
    assert.ok(saveRun(source, createTestRun({ systems: sys }), sys).ok);
    const backup = source.getItem(runKey)!;
    const target = createMemoryStorage({
      [runKey]: future,
      [runBackupKey]: backup,
    });
    assert.deepEqual(exportRunSave(target, sys), {
      ok: false,
      reason: "future_version",
    });
    assert.deepEqual(importRunSave(target, backup, sys), {
      ok: false,
      reason: "future_version",
    });
    assert.equal(target.getItem(runKey), future);
    assert.equal(target.getItem(runBackupKey), backup);

    const backedUp = createMemoryStorage({
      [runKey]: backup,
      [runBackupKey]: future,
    });
    assert.deepEqual(importRunSave(backedUp, backup, sys), { ok: true });
    assert.equal(backedUp.getItem(runBackupKey), future);
  });

  it("rejects a stale tab without touching either slot after a same-millisecond save", (t) => {
    t.mock.method(Date, "now", () => 1_000);
    const storage = createMemoryStorage();
    const run = createTestRun({ systems: sys });
    assert.deepEqual(saveRun(storage, run, sys), { ok: true });
    const first = storage.getItem(runKey)!;
    const { savedAt } = JSON.parse(first);
    assert.equal(savedAt, 1_000);

    run.elapsedSec = 185;
    assert.deepEqual(saveRun(storage, run, sys, savedAt), { ok: true });
    const newer = storage.getItem(runKey)!;
    assert.equal(JSON.parse(newer).savedAt, 1_001);
    assert.equal(storage.getItem(runBackupKey), first);
    run.elapsedSec = 100;
    assert.deepEqual(saveRun(storage, run, sys, savedAt), {
      ok: false,
      reason: "stale_tab",
    });
    assert.equal(storage.getItem(runKey), newer);
    assert.equal(storage.getItem(runBackupKey), first);

    assert.deepEqual(saveRun(storage, run, sys), { ok: true });
    assert.equal(loadRun(storage, sys).snapshot?.elapsedSec, 100);
  });

  it("keeps valid progress when the new primary write fails", () => {
    const storage = createMemoryStorage();
    const state = createTestRun({ systems: sys, elapsedSec: 184 });
    assert.ok(saveRun(storage, state, sys).ok);
    const oldPrimary = storage.getItem(runKey)!;
    const writes: string[] = [];
    const failing = {
      ...storage,
      setItem(key: string, value: string) {
        writes.push(key);
        if (key === runKey) throw new Error("quota");
        storage.setItem(key, value);
      },
    };
    assert.deepEqual(importRunSave(failing, oldPrimary, sys), {
      ok: false,
      reason: "storage_error",
    });
    assert.deepEqual(writes, [runBackupKey, runKey]);
    assert.equal(storage.getItem(runKey), oldPrimary);
    assert.equal(storage.getItem(runBackupKey), oldPrimary);
  });
});

function setRules(config: typeof rules): void {
  for (const key of Object.keys(rules) as (keyof typeof rules)[]) {
    delete rules[key];
  }
  Object.assign(rules, config);
}

function startRun(
  config: typeof rules = {},
  overrides?: Parameters<typeof createTestRun>[0],
) {
  setRules(config);
  return createTestRun({ seed: 1, ...overrides });
}

function raids(config: typeof rules = {}): number[] {
  const state = startRun(config, {
    elapsedSec: sys.data.balance.clock.daySec - 0.025,
  });
  return Array.from({ length: 8 }, () => {
    step(state, { sec: 0.05 }, sys);
    return Object.values(state.enemiesById).filter(
      (enemy) => enemy.nightRound !== null,
    ).length;
  });
}

function harvest(state: RunState, node: WorldObject): void {
  state.changesByObjectId[node.id] = {
    ...state.changesByObjectId[node.id],
    gathered: true,
  };
  recordHarvest(state, node);
}

describe("The map controller runs the time rule", () => {
  afterEach(() => setRules(initialRules));

  it.each([
    { label: "Default", config: {}, expected: [1.88, 1.6] },
    {
      label: "Cover distance with cooling",
      config: { dash: { distanceTiles: 3, cooldownSec: 2 } },
      expected: [3, 2],
    },
  ])(
    ({ label }) => `Step fast  ·  ${label}`,
    ({ config, expected }) => {
      const state = startRun(config);
      const x = state.hero.x;
      for (let i = 0; i < 4; i++) {
        moveHero(
          state,
          sys,
          makeStepInput({ moveX: 1, dashPressed: i === 0 }),
          0.04,
        );
      }
      assert.deepEqual(
        [
          Number(((state.hero.x - x) / tileSize).toFixed(2)),
          getDashCooldownState(state, sys).maxSec,
        ],
        expected,
      );
    },
  );

  const perceptionCases = [
    {
      label: "Defaults outside the enemy range",
      config: {},
      distance: 10,
      phase: "idle",
      expected: "idle",
    },
    {
      label: "Expanding the range of the enemy",
      config: { perception: { aggroTiles: 11 } },
      distance: 10,
      phase: "idle",
      expected: "chase",
    },
    {
      label: "Default to be out of combat range",
      config: {},
      distance: 13,
      phase: "chase",
      expected: "chase",
    },
    {
      label: "To narrow the line",
      config: { perception: { leashTiles: 12 } },
      distance: 13,
      phase: "chase",
      expected: "idle",
    },
  ] satisfies {
    label: string;
    config: typeof rules;
    distance: number;
    phase: EnemyState["phase"];
    expected: EnemyState["phase"];
  }[];

  it.each(
    ["snow_weasel", "mill_spider"].flatMap((enemyId) =>
      perceptionCases.map((row) => ({ ...row, enemyId })),
    ),
  )(
    ({ enemyId, label }) => `${enemyId} · ${label}`,
    ({ enemyId, config, distance, phase, expected }) => {
      const state = startRun(config);
      const resident = Object.values(state.enemiesById).find(
        (enemy) => enemy.enemyId === enemyId,
      );
      assert.ok(resident, `Lack of permanent presence of the enemy ${enemyId}`);
      const enemy = addTestEnemy(state, sys, enemyId, {
        id: resident.id,
        phase,
      });
      state.enemiesById = { [enemy.id]: enemy };
      const point = sys.world.spawns.get(enemy.spawnId);
      assert.ok(point, `Missing brush points ${enemy.spawnId}`);
      state.regionId = point.regionId;
      Object.assign(state.hero, {
        x: enemy.x + distance * tileSize,
        y: enemy.y,
      });
      // Isolate radius overrides from the mill wall between the fixture actors.
      const world={...sys.world,tiles:new Uint8Array(sys.world.tiles.length)};
      updateEnemies(state, {...sys,world}, 0.01, []);
      assert.equal(enemy.phase, expected);
    },
  );

  it.each([
    { label: "Default weight", config: {}, expected: 2 },
    {
      label: "The region has a semi-regional weight",
      config: { weights: { camp_edge: 0.5 } },
      expected: 1,
    },
  ])(
    ({ label }) => `Night raids  ·  ${label}`,
    ({ config, expected }) => {
      assert.equal(raids(config).at(-1), expected);
    },
  );

  it("Shortening the interval between night strikes can trigger wave two ahead of time", () => {
    const fast = raids({ waves: { count: 2, intervalSec: 0.1 } });
    const slow = raids({ waves: { count: 2, intervalSec: 0.25 } });
    assert.equal(fast.at(-1), 4);
    assert.ok(fast.indexOf(4) < slow.indexOf(4));
  });

  const node = sys.world.objectList.find((object) => object.renewable);
  assert.ok(node);

  it("The default material can be re-newed several times at dawn", () => {
    const state = startRun();
    for (let i = 0; i < 2; i++) {
      harvest(state, node);
      assert.equal(renewAtDawn(state, sys), 1);
    }
  });

  it("Single point updates take precedence over global rules and continue after reading files", () => {
    const state = startRun({ resources: { renewalLimit: 2, cooldownSec: 10 } });
    const tuned = { ...node, renewalLimit: 1, respawnCooldownSec: 2 };
    const timedSys = { ...sys, world: { ...sys.world, objectList: [tuned] } };
    harvest(state, tuned);
    state.elapsedSec = 1;
    renewTimed(state, timedSys);
    assert.ok(state.changesByObjectId[node.id].gathered);

    const storage = createMemoryStorage();
    assert.equal(saveRun(storage, state, sys).ok, true);
    const { snapshot } = loadRun(storage, sys);
    assert.ok(snapshot);
    snapshot.elapsedSec = 2;
    renewTimed(snapshot, timedSys);
    assert.equal(snapshot.changesByObjectId[node.id].renewals, 1);
    harvest(snapshot, tuned);
    snapshot.elapsedSec = 4;
    renewTimed(snapshot, timedSys);
    assert.ok(snapshot.changesByObjectId[node.id].gathered);
  });

  it("The dawn does not skip the global cooling", () => {
    const state = startRun({ resources: { renewalLimit: 2, cooldownSec: 10 } });
    harvest(state, node);
    state.elapsedSec = 9;
    renewAtDawn(state, sys);
    assert.ok(state.changesByObjectId[node.id].gathered);
    state.elapsedSec = 10;
    renewTimed(state, sys);
    assert.equal(state.changesByObjectId[node.id].renewals, 1);
  });
});
