import { clampStep } from "@/core/clock";
import { EVT, makeEvent } from "@/core/events";
import { rollRun } from "@/core/rng";
import type { GameEvent, RunState, Systems } from "@/core/types";
import { heroMaxHp } from "../itemEffects";
import { grantStartingSupplies, lockLoadoutForCombat } from "./eternalLoadout";
import { createEternalRuntime, getEternalRuntime } from "./eternalRuntime";
import {
  eternalEnemyCount,
  spawnEternalBoss,
  spawnEternalWave,
} from "./eternalSpawn";
import { ETERNAL, type EternalRunRuntime } from "./eternalTypes";

const MAX_GROUND_LOOT = 40;

export { getEternalRuntime, isEternalRun } from "./eternalRuntime";

/** Attaches a fresh director to the run and hands out the starting supplies. */
export function initEternalRun(state: RunState, sys: Systems): void {
  createEternalRuntime(state);
  suppressQuestDrops(state, sys);
  grantStartingSupplies(state, sys);
  refillHero(state, sys);
}

/** Prevents adventure-only quest seals/beacon hearts from dropping onto the arena floor. */
function suppressQuestDrops(state: RunState, sys: Systems): void {
  for (const enemy of sys.data.enemies.values()) {
    for (const drop of enemy.drops) {
      if (
        drop.pickupId &&
        sys.data.items.get(drop.itemId)?.type === "quest" &&
        !state.collectedPickups.includes(drop.pickupId)
      ) {
        state.collectedPickups.push(drop.pickupId);
      }
    }
  }
}

/** "立即开战": the next step ends the preparation. */
export function skipEternalPrep(state: RunState): void {
  const rt = getEternalRuntime(state);
  if (rt?.phase === "prep") rt.prepRemainingSec = 0;
}

function notice(
  events: GameEvent[],
  message: string,
  tone: "good" | "warn",
): void {
  events.push(makeEvent(EVT.notice, null, null, { message, tone }));
}

function refillHero(state: RunState, sys: Systems): void {
  const { hero } = state;
  const { stats } = sys.data.balance;
  hero.hp = heroMaxHp(sys.data, state.inventory, state.heroId);
  hero.hunger = stats.hunger.max;
  hero.light = stats.light.max;
  hero.hungerDamageSec = 0;
  hero.darknessDamageSec = 0;
}

function dropSupply(state: RunState, x: number, y: number): void {
  const total = ETERNAL.supplyDrops.reduce((sum, d) => sum + d.weight, 0);
  let roll = rollRun(state) * total;
  let itemId: string = ETERNAL.supplyDrops[0].itemId;
  for (const drop of ETERNAL.supplyDrops) {
    roll -= drop.weight;
    if (roll < 0) {
      itemId = drop.itemId;
      break;
    }
  }
  const ids = Object.keys(state.groundLoot);
  if (ids.length >= MAX_GROUND_LOOT) delete state.groundLoot[ids[0]];
  const id = `loot_${state.idCounter++}`;
  state.groundLoot[id] = {
    id,
    itemId,
    count: 1,
    x,
    y,
    pickupId: null,
    refusedNotified: false,
  };
}

/** Counts kills from this frame's events and rolls the 28% sustain drop at each kill. */
function countKills(
  state: RunState,
  rt: EternalRunRuntime,
  events: readonly GameEvent[],
): void {
  for (const e of events) {
    if (e.type !== EVT.enemyDefeated) continue;
    rt.kills++;
    if (
      e.x !== null &&
      e.y !== null &&
      rollRun(state) < ETERNAL.supplyDropChance
    )
      dropSupply(state, e.x, e.y);
  }
}

function spawnInterval(combatSec: number): number {
  return Math.max(1, 1 + 1.4 * Math.exp(-combatSec / 240));
}

function creditRate(combatSec: number): number {
  const minutes = combatSec / 60;
  return 0.85 + minutes * 0.45 + minutes ** 1.35 * 0.15;
}

function beginCombat(
  state: RunState,
  sys: Systems,
  rt: EternalRunRuntime,
  events: GameEvent[],
): void {
  lockLoadoutForCombat(state, sys);
  rt.phase = "combat";
  rt.prepRemainingSec = 0;
  notice(events, "黑雾合拢，永恒试炼开始！", "warn");
}

function stepCombat(
  state: RunState,
  sys: Systems,
  rt: EternalRunRuntime,
  dt: number,
  events: GameEvent[],
): void {
  rt.combatElapsedSec += dt;
  const t = rt.combatElapsedSec;
  rt.credits = Math.min(ETERNAL.maxCredits, rt.credits + creditRate(t) * dt);
  if (rt.loadoutMode === "standard" && t >= rt.nextSupplySec) {
    rt.nextSupplySec += ETERNAL.supplyIntervalSec;
    rt.pendingPicks++;
    notice(events, "补给抵达：可补选 1 件装备", "good");
  }
  if (t >= rt.nextBossSec) {
    rt.nextBossSec += ETERNAL.bossIntervalSec;
    const name = spawnEternalBoss(state, sys, rt, events);
    rt.bossWaveCount++;
    if (name) notice(events, `首领降临：${name}`, "warn");
  }
  rt.spawnTimerSec -= dt;
  if (rt.spawnTimerSec > 0) return;
  rt.spawnTimerSec = spawnInterval(t);
  if (eternalEnemyCount(state) < ETERNAL.enemyCap)
    spawnEternalWave(state, sys, rt, events);
}

/**
 * Eternal Mode director, called after the shared step each frame. Prep: countdown with a full
 * hero. Combat: credit-based spawns that quicken and strengthen over time, boss waves, kills.
 */
export function stepEternalDirector(
  state: RunState,
  sys: Systems,
  sec: number,
  events: GameEvent[],
): void {
  const rt = getEternalRuntime(state);
  if (!rt || state.status !== "playing") return;
  const dt = clampStep(sec, sys.data.balance);
  countKills(state, rt, events);
  if (rt.phase === "prep") {
    refillHero(state, sys);
    rt.prepRemainingSec = Math.max(0, rt.prepRemainingSec - dt);
    if (rt.prepRemainingSec <= 0) beginCombat(state, sys, rt, events);
    return;
  }
  stepCombat(state, sys, rt, dt, events);
}
