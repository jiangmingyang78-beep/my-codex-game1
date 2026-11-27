import {
  despawnNightRaid,
  spawnNightRaid,
  spawnResidents,
} from "@/systems/EnemyManager";
import { stepCombat } from "@/systems/combat/combat";
import { trimNightRaid } from "@/systems/combat/enemySpawn";
import { recycleDistant } from "@/systems/combat/spawnPopulation";
import { consumeItem } from "@/systems/inventory";
import { heroMaxHp } from "@/systems/itemEffects";
import { moveHero } from "@/systems/movement";
import { rules } from "@/systems/runtimeRules";
import { tickHeroTimers, tickSurvival } from "@/systems/survival";
import { regionIdAt } from "@/systems/world/collision";
import { renewAtDawn, renewTimed } from "@/systems/world/dawn";
import { interact } from "@/systems/world/interact";
import { tickRegionEffects } from "@/systems/world/regionEffects";
import { clampStep, dayAt, phaseAt } from "./clock";
import { runCommands } from "./commands";
import { EVT, makeEvent } from "./events";
import { getHero } from "./gameData";
import { RUN_SCHEMA_VERSION, sanitizeRunState } from "./snapshot";
import { getSystems } from "./systems";
import type {
  GameEvent,
  RunConfig,
  RunState,
  StepRequest,
  Systems,
} from "./types";

function newRunId(seed: number): string {
  return `run-${seed.toString(36)}-${Date.now().toString(36)}`;
}

function freshState(sys: Systems, config: RunConfig): RunState {
  const { data } = sys;
  const { balance } = data;
  const hero = getHero(data, config.heroId);
  const inventory = { ...hero.startingInventory };
  const seed = (config.seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: config.runId ?? newRunId(seed),
    seed,
    rngState: seed,
    elapsedSec: 0,
    status: "playing",
    phase: "day",
    day: 1,
    regionId: balance.starting.regionId,
    heroId: hero.id,
    hero: {
      x: sys.world.heroStart.x,
      y: sys.world.heroStart.y,
      facingX: 0,
      facingY: 1,
      hp: Math.min(
        heroMaxHp(data, inventory, hero.id),
        balance.stats.hp.initial + (hero.traits.maxHpDelta ?? 0),
      ),
      hunger: balance.stats.hunger.initial,
      light: balance.stats.light.initial,
      attackCooldownSec: 0,
      attackAnimSec: 0,
      invulnerableSec: 0,
      hungerDamageSec: 0,
      darknessDamageSec: 0,
      inFire: true,
    },
    inventory,
    campLevel: balance.starting.campLevel,
    seals: [],
    collectedPickups: [],
    changesByObjectId: {},
    enemiesById: {},
    projectiles: [],
    groundLoot: {},
    buffs: {},
    nightRaid: null,
    autosaveSec: 0,
    idCounter: 0,
  };
}

/**
 * Creates a new run, or restores one from a saved snapshot (validated and deep copied).
 * Throws SnapshotError for an invalid snapshot; use core/save.loadRun for safe loading.
 */
export function createRun(
  config: RunConfig = {},
  snapshot?: unknown,
): RunState {
  const sys = config.systems ?? getSystems();
  const state =
    snapshot === undefined
      ? freshState(sys, config)
      : sanitizeRunState(JSON.parse(JSON.stringify(snapshot)), sys);
  spawnResidents(state, sys);
  if (state.phase === "day") despawnNightRaid(state);
  else trimNightRaid(state, sys);
  return state;
}

function phaseTransition(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  const next = phaseAt(state.elapsedSec, sys.data.balance);
  const day = dayAt(state.elapsedSec, sys.data.balance);
  if (next === state.phase) {
    state.day = day;
    return;
  }
  state.phase = next;
  state.day = day;
  if (next === "night") {
    spawnNightRaid(state, sys, events);
    events.push(makeEvent(EVT.dusk, null, null, { day }));
  } else {
    despawnNightRaid(state);
    state.hero.darknessDamageSec = 0;
    const renewed = renewAtDawn(state, sys);
    events.push(makeEvent(EVT.dawn, null, null, { day, renewed }));
  }
}

function checkEnd(state: RunState, sys: Systems, events: GameEvent[]): void {
  // Death wins over a simultaneous timeout.
  if (state.hero.hp <= 0) state.status = "dead";
  else if (state.elapsedSec >= sys.data.balance.clock.runLimitSec)
    state.status = "storm_lost";
  else return;
  events.push(
    makeEvent(EVT.runEnded, state.hero.x, state.hero.y, {
      status: state.status,
      runId: state.runId,
      day: state.day,
      elapsedSec: state.elapsedSec,
    }),
  );
}

/**
 * Advances the run by `request.sec` (clamped to clock.maxStepSec). Order: movement and
 * region, commands/interaction, combat, clock + survival, end conditions. Returns the
 * GameEvents produced this step; the state is mutated in place. Not running when status != playing.
 */
export function step(
  state: RunState,
  request: StepRequest,
  systems?: Systems,
): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.status !== "playing") return events;
  const sys = systems ?? getSystems();
  const sec = clampStep(request.sec, sys.data.balance);
  const input = request.input ?? {};
  const { hero } = state;

  tickHeroTimers(state, sec);
  moveHero(
    state,
    sys,
    {
      moveX: input.moveX ?? 0,
      moveY: input.moveY ?? 0,
      dashPressed: input.dashPressed === true,
    },
    sec,
    request.frame?.hero,
  );
  tickRegionEffects(state, sys, sec, events);

  const region = regionIdAt(sys.world, hero.x, hero.y);
  if (region && region !== state.regionId) {
    state.regionId = region;
    if (state.phase === "night") trimNightRaid(state, sys);
    events.push(
      makeEvent(EVT.regionEntered, hero.x, hero.y, {
        regionId: region,
        name: sys.data.regions.get(region)?.name ?? region,
      }),
    );
  }

  runCommands(state, sys, request.commands ?? [], events);
  if (state.status !== "playing") return events;
  if (input.interactPressed) events.push(...interact(state, sys).events);
  if (state.status !== "playing") return events;
  if (input.itemId)
    events.push(...consumeItem(state, sys, input.itemId).events);

  stepCombat(
    state,
    sys,
    { attackPressed: input.attackPressed === true },
    sec,
    events,
  );

  const previousSecond = Math.floor(state.elapsedSec);
  state.elapsedSec += sec;
  if (Math.floor(state.elapsedSec) !== previousSecond)
    recycleDistant(state, sys);
  const sameNight = state.phase === "night";
  phaseTransition(state, sys, events);
  if (sameNight && state.phase === "night" && (rules.waves?.count ?? 1) > 1) {
    const clock = sys.data.balance.clock;
    const age =
      (state.elapsedSec % (clock.daySec + clock.nightSec)) - clock.daySec;
    const interval = rules.waves?.intervalSec ?? 30;
    const wave = Math.floor(age / interval);
    if (
      wave > 0 &&
      wave < (rules.waves?.count ?? 1) &&
      wave > Math.floor((age - sec) / interval)
    )
      spawnNightRaid(state, sys, events, wave);
  }
  renewTimed(state, sys);
  tickSurvival(state, sys, sec, events);
  state.autosaveSec += sec;
  if (state.autosaveSec >= sys.data.balance.storage.autosaveIntervalSec) {
    state.autosaveSec = 0;
    events.push(makeEvent(EVT.saveDue, null, null, { reason: "interval" }));
  }
  checkEnd(state, sys, events);
  return events;
}
