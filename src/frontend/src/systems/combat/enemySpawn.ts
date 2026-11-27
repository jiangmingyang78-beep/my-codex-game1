import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { rules } from "../runtimeRules";
import { acquireEnemy, enemyPool, spawnPoint } from "./spawnPopulation";

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
      state.enemiesById[s.spawnId] = acquireEnemy(
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
  wave = 0,
): void {
  const region = sys.data.regions.get(state.regionId);
  if (!region) return;
  const round = state.day;
  const spawnedIds =
    state.nightRaid?.round === round ? state.nightRaid.spawnedIds : [];
  const raid = { regionId: region.id, round, spawnedIds: [...spawnedIds] };
  const slots = region.nightSpawns;
  const weight = rules.weights?.[region.id] ?? 1;
  const expected = slots.length * weight;
  // Fractional weights distribute extra slots deterministically across nights.
  const fraction = (round * 0.61803398875 + wave * 0.41421356237) % 1;
  const count = Math.min(
    Math.floor(expected) + (fraction < expected % 1 ? 1 : 0),
    sys.data.balance.limits.activeEnemies,
  );
  if ((rules.waves?.count ?? 1) <= 0) return;
  for (let i = 0; i < count; i++) {
    const s = slots[i % slots.length];
    if (aliveEnemyCount(state, sys) >= sys.data.balance.limits.activeEnemies)
      break;
    const point = sys.world.spawns.get(s.spawnId);
    const def = sys.data.enemies.get(s.enemyId);
    const suffix = wave || i >= slots.length ? `_w${wave}_${i}` : "";
    const id = `night${round}_${s.spawnId}${suffix}`;
    if (!point || !def || state.enemiesById[id]) continue;
    const at = spawnPoint(state, sys, def.id, point, Boolean(def.phases));
    if (!at) continue;
    state.enemiesById[id] = acquireEnemy(
      id,
      s.enemyId,
      s.spawnId,
      at.x,
      at.y,
      def.maxHp,
      round,
    );
    state.enemiesById[id].persistent = wave === 0 && i < slots.length;
    state.enemiesById[id].phase = "chase";
    raid.spawnedIds.push(id);
    events.push(
      makeEvent(EVT.enemySpawned, at.x, at.y, {
        id,
        enemyId: s.enemyId,
        night: round,
      }),
    );
  }
  state.nightRaid = raid;
}

/** Keep nearby raiders when the hero crosses into a region with more residents. */
export function trimNightRaid(state: RunState, sys: Systems): void {
  const excess =
    aliveEnemyCount(state, sys) - sys.data.balance.limits.activeEnemies;
  if (excess <= 0) return;
  const { x, y } = state.hero;
  const distance = (e: EnemyState) => Math.hypot(e.x - x, e.y - y);
  const raiders = Object.values(state.enemiesById)
    .filter(
      (e) =>
        !e.persistent &&
        !e.playerInteracted &&
        !e.taskLocked &&
        !e.boss &&
        e.nightRound === state.day,
    )
    .sort((a, b) => distance(b) - distance(a));
  for (const e of raiders.slice(0, excess)) {
    delete state.enemiesById[e.id];
    enemyPool.release(e);
  }
}

/** Dawn: surviving raid enemies leave; resident enemies and their HP stay. */
export function despawnNightRaid(state: RunState): void {
  for (const id in state.enemiesById) {
    const enemy = state.enemiesById[id];
    if (enemy.nightRound !== null) {
      delete state.enemiesById[id];
      enemyPool.release(enemy);
    }
  }
  state.nightRaid = null;
}
