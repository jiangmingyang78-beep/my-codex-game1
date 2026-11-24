import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";

function createEnemy(
  id: string,
  enemyId: string,
  spawnId: string,
  x: number,
  y: number,
  hp: number,
  nightRound: number | null,
): EnemyState {
  return {
    id,
    enemyId,
    spawnId,
    homeX: x,
    homeY: y,
    x,
    y,
    hp,
    phase: "idle",
    phaseSec: 0,
    cooldownSec: 0,
    dirX: 0,
    dirY: 1,
    moveIndex: 0,
    hitDone: false,
    nightRound,
  };
}

/** Resident (guard) enemies for every implemented region that are not recorded as defeated. */
export function spawnResidents(state: RunState, sys: Systems): void {
  for (const region of sys.data.regionList) {
    for (const s of region.residentSpawns) {
      const point = sys.world.spawns.get(s.spawnId);
      const def = sys.data.enemies.get(s.enemyId);
      if (
        !point ||
        !def ||
        state.changesByObjectId[s.spawnId]?.defeated ||
        state.enemiesById[s.spawnId]
      )
        continue;
      state.enemiesById[s.spawnId] = createEnemy(
        s.spawnId,
        s.enemyId,
        s.spawnId,
        point.x,
        point.y,
        def.maxHp,
        null,
      );
    }
  }
}

function aliveEnemyCount(state: RunState, sys: Systems): number {
  let n = 0;
  for (const e of Object.values(state.enemiesById))
    if (
      e.nightRound !== null ||
      sys.world.spawns.get(e.spawnId)?.regionId === state.regionId
    )
      n++;
  return n;
}

/**
 * Nightfall: spawns the current region's nightSpawns at their fixed entrance points,
 * limited by limits.activeEnemies. Instance ids derive from round + spawn id.
 */
export function spawnNightRaid(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  const region = sys.data.regions.get(state.regionId);
  if (!region) return;
  const round = state.day;
  const raid = { regionId: region.id, round, spawnedIds: [] as string[] };
  for (const s of region.nightSpawns) {
    if (aliveEnemyCount(state, sys) >= sys.data.balance.limits.activeEnemies)
      break;
    const point = sys.world.spawns.get(s.spawnId);
    const def = sys.data.enemies.get(s.enemyId);
    const id = `night${round}_${s.spawnId}`;
    if (!point || !def || state.enemiesById[id]) continue;
    state.enemiesById[id] = createEnemy(
      id,
      s.enemyId,
      s.spawnId,
      point.x,
      point.y,
      def.maxHp,
      round,
    );
    state.enemiesById[id].phase = "chase";
    raid.spawnedIds.push(id);
    events.push(
      makeEvent(EVT.enemySpawned, point.x, point.y, {
        id,
        enemyId: s.enemyId,
        night: round,
      }),
    );
  }
  state.nightRaid = raid;
}

/** Dawn: surviving raid enemies leave; resident enemies and their HP stay. */
export function despawnNightRaid(state: RunState): void {
  for (const id in state.enemiesById) {
    if (state.enemiesById[id].nightRound !== null) delete state.enemiesById[id];
  }
  state.nightRaid = null;
}
