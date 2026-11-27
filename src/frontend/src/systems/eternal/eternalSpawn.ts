import { EVT, makeEvent } from "@/core/events";
import { rollRun } from "@/core/rng";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { enemyPool, spawnPoint } from "../combat/spawnPopulation";
import { ETERNAL, type EternalRunRuntime } from "./eternalTypes";

interface PoolEntry {
  id: string;
  cost: number;
  fromSec: number;
}

const POOL: readonly PoolEntry[] = [
  { id: "frost_rat", cost: 1, fromSec: 0 },
  { id: "snow_weasel", cost: 2, fromSec: 0 },
  { id: "rotted_woodcutter", cost: 3, fromSec: 0 },
  { id: "mill_spider", cost: 3, fromSec: 60 },
  { id: "frost_crow", cost: 4, fromSec: 60 },
  { id: "ash_wolf", cost: 4, fromSec: 60 },
  { id: "cinder_husk", cost: 5, fromSec: 135 },
  { id: "ice_ram", cost: 5, fromSec: 135 },
  { id: "coal_shade", cost: 5, fromSec: 135 },
  { id: "bog_spitter", cost: 6, fromSec: 135 },
  { id: "shadow_lynx", cost: 6, fromSec: 210 },
  { id: "ember_wisp", cost: 6, fromSec: 210 },
  { id: "frozen_guard", cost: 8, fromSec: 210 },
];

/** Raised maxHp per enemy; EnemyState and the JSON definitions stay untouched. */
const scaledMaxHp = new WeakMap<EnemyState, number>();

/** Late-game health multiplier: +15% every 2 minutes after the 3 minute mark. */
export function eternalHpMultiplier(combatSec: number): number {
  if (combatSec < ETERNAL.hpScaleStartSec) return 1;
  const steps =
    Math.floor((combatSec - ETERNAL.hpScaleStartSec) / ETERNAL.hpScaleStepSec) +
    1;
  return 1 + ETERNAL.hpScaleStep * steps;
}

/** Scaled maximum HP of an eternal enemy, or undefined for ordinary enemies. */
export function eternalEnemyMaxHp(enemy: EnemyState): number | undefined {
  return scaledMaxHp.get(enemy);
}

export function eternalEnemyCount(state: RunState): number {
  return Object.keys(state.enemiesById).length;
}

function unlockedPool(sys: Systems, combatSec: number): PoolEntry[] {
  return POOL.filter(
    (e) => e.fromSec <= combatSec && sys.data.enemies.has(e.id),
  );
}

/** Spawns one chasing enemy (nightRound 1 keeps the shared AI from idling it). */
function spawnEnemy(
  state: RunState,
  sys: Systems,
  enemyId: string,
  combatSec: number,
  events: GameEvent[],
): boolean {
  const def = sys.data.enemies.get(enemyId);
  if (!def) return false;
  const isBoss =
    (ETERNAL.bossOrder as readonly string[]).includes(enemyId) ||
    Boolean(def.phases);
  const point = spawnPoint(state, sys, enemyId, undefined, isBoss);
  if (!point) return false;
  const id = `eternal_${state.idCounter++}`;
  const scaled = isBoss
    ? def.maxHp
    : Math.ceil(def.maxHp * eternalHpMultiplier(combatSec));
  const enemy = enemyPool.acquire({
    boss: isBoss,
    id,
    enemyId,
    spawnId: "eternal",
    homeX: point.x,
    homeY: point.y,
    x: point.x,
    y: point.y,
    hp: scaled,
    phase: "chase",
    phaseSec: 0,
    cooldownSec: 0.6,
    dirX: 0,
    dirY: 1,
    moveIndex: 0,
    hitDone: false,
    nightRound: 1,
  });
  scaledMaxHp.delete(enemy);
  state.enemiesById[id] = enemy;
  if (scaled !== def.maxHp) scaledMaxHp.set(enemy, scaled);
  events.push(
    makeEvent(EVT.enemySpawned, point.x, point.y, { id, enemyId, night: 1 }),
  );
  return true;
}

function pickWeighted(
  state: RunState,
  options: PoolEntry[],
  minutes: number,
): PoolEntry {
  const weights = options.map((o) => 1 + o.cost * minutes * 0.4);
  let roll = rollRun(state) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll < 0) return options[i];
  }
  return options[options.length - 1];
}

/** Spends credits on 1-3 enemies from the unlocked pool, respecting the on-screen cap. */
export function spawnEternalWave(
  state: RunState,
  sys: Systems,
  rt: EternalRunRuntime,
  events: GameEvent[],
): void {
  const pool = unlockedPool(sys, rt.combatElapsedSec);
  const wanted = 1 + Math.floor(rollRun(state) * 3);
  const minutes = rt.combatElapsedSec / 60;
  for (let n = 0; n < wanted; n++) {
    if (eternalEnemyCount(state) >= ETERNAL.enemyCap) return;
    const affordable = pool.filter((e) => e.cost <= rt.credits);
    if (affordable.length === 0) return;
    const pick = pickWeighted(state, affordable, minutes);
    if (spawnEnemy(state, sys, pick.id, rt.combatElapsedSec, events))
      rt.credits -= pick.cost;
  }
}

/** Forces the next boss in the rotation onto the clearing edge; returns its display name. */
export function spawnEternalBoss(
  state: RunState,
  sys: Systems,
  rt: EternalRunRuntime,
  events: GameEvent[],
): string | null {
  const order = ETERNAL.bossOrder;
  const bossId = order[rt.bossWaveCount % order.length];
  const spawned = spawnEnemy(state, sys, bossId, rt.combatElapsedSec, events);
  return spawned ? (sys.data.enemies.get(bossId)?.name ?? bossId) : null;
}
