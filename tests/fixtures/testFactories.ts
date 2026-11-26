import { getEnemy } from "@/core/gameData";
import { createRun } from "@/core/run";
import { createSystems } from "@/core/systems";
import type {
  EnemyState,
  HeroState,
  RunState,
  StepInputState,
  Systems,
} from "@/core/types";
import { createEternalSystems } from "@/systems/eternal/eternalWorld";

export { createMemoryStorage } from "@/core/storage";

type RunOverrides = Partial<Omit<RunState, "hero">> & {
  hero?: Partial<HeroState>;
  systems?: Systems;
};

let adventure: Systems | undefined;
let eternal: Systems | undefined;

/** The shared definitions and map are read-only. Each test gets its own run. */
export function getTestSystems(): Systems {
  adventure ??= createSystems();
  return adventure;
}

export function getTestEternalSystems(): Systems {
  eternal ??= createEternalSystems();
  return eternal;
}

export function createTestRun(overrides: RunOverrides = {}): RunState {
  const {
    systems = getTestSystems(),
    seed = 12345,
    runId = "test-run",
    heroId,
    hero,
    ...statePatch
  } = overrides;
  const state = createRun({ systems, seed, runId, heroId });
  Object.assign(state, structuredClone(statePatch));
  Object.assign(state.hero, hero);
  return state;
}

export function addTestEnemy(
  state: RunState,
  sys: Systems,
  enemyId: string,
  patch: Partial<Omit<EnemyState, "enemyId">> = {},
): EnemyState {
  let index = Object.keys(state.enemiesById).length;
  while (Object.hasOwn(state.enemiesById, `test-enemy-${index}`)) index++;
  const id = patch.id ?? `test-enemy-${index}`;
  const existing = state.enemiesById[id];
  const spawnId = patch.spawnId ?? existing?.spawnId ?? id;
  const position = sys.world.spawns.get(spawnId) ?? state.hero;
  const x = patch.x ?? existing?.x ?? position.x;
  const y = patch.y ?? existing?.y ?? position.y;
  const enemy: EnemyState = {
    homeX: x,
    homeY: y,
    x,
    y,
    hp: getEnemy(sys.data, enemyId).maxHp,
    phase: "idle",
    phaseSec: 0,
    cooldownSec: 0,
    dirX: 0,
    dirY: 1,
    moveIndex: 0,
    hitDone: false,
    nightRound: null,
    ...existing,
    ...patch,
    id,
    enemyId,
    spawnId,
  };
  state.enemiesById[id] = enemy;
  return enemy;
}

export function makeStepInput(
  patch: Partial<StepInputState> = {},
): StepInputState {
  return {
    moveX: 0,
    moveY: 0,
    attackPressed: false,
    interactPressed: false,
    itemId: null,
    pausePressed: false,
    dashPressed: false,
    ...patch,
  };
}
