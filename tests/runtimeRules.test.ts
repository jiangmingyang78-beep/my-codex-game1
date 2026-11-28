import assert from "node:assert/strict";
import { afterEach, describe } from "node:test";
import { step } from "@/core/run";
import { loadRun, saveRun } from "@/core/save";
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
