import { cycleSec, dayAt, phaseAt } from "@/core/clock";
import { EVT, makeEvent } from "@/core/events";
import type { GameEvent, RunState, Systems } from "@/core/types";
import { ENEMY_RADIUS } from "@/systems/combat/combatMath";
import {
  acquireEnemy,
  releasePopulation,
} from "@/systems/combat/spawnPopulation";
import { heroMaxHp } from "@/systems/itemEffects";
import { resetDashCooldown } from "@/systems/movement";
import {
  damageHero,
  resetBucklerCooldown,
  tickSurvival,
} from "@/systems/survival";
import { blockedAt } from "@/systems/world/collision";
import type { SessionOutput } from "../session/RunSession";
import type { DevCommands } from "../ui/commands";

const godModeByState = new WeakMap<RunState, boolean>();

const DEV_SUPPLIES: Readonly<Record<string, number>> = {
  bandage: 5,
  herb_salve: 5,
  roast_meat: 5,
  warm_stew: 3,
  resin_torch: 3,
  ingot: 10,
  wood: 20,
  stone: 20,
  charcoal: 10,
};

export function isDevGodMode(state: RunState): boolean {
  if (!import.meta.env.DEV) return false;
  return godModeByState.get(state) ?? false;
}

export function toggleDevGodMode(state: RunState): boolean {
  if (!import.meta.env.DEV) return false;
  const next = !(godModeByState.get(state) ?? false);
  godModeByState.set(state, next);
  return next;
}

export function devGrantAllGear(state: RunState, sys: Systems): void {
  if (!import.meta.env.DEV) return;
  for (const item of sys.data.itemList) {
    if (item.type === "equipment") state.inventory[item.id] = 1;
  }
  for (const [id, count] of Object.entries(DEV_SUPPLIES)) {
    const def = sys.data.items.get(id);
    if (!def) continue;
    state.inventory[id] = Math.min(
      def.maxStack,
      (state.inventory[id] ?? 0) + count,
    );
  }
  state.hero.hp = heroMaxHp(sys.data, state.inventory, state.heroId);
}

function findSpawnPoint(
  state: RunState,
  sys: Systems,
): { x: number; y: number } {
  const tileSize = sys.data.tileSize;
  const distances = [5.2, 4.5, 6];
  for (const tiles of distances) {
    const r = tiles * tileSize;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI * 2) / 16;
      const x = state.hero.x + Math.cos(angle) * r;
      const y = state.hero.y + Math.sin(angle) * r;
      if (!blockedAt(sys.world, state.changesByObjectId, x, y, ENEMY_RADIUS)) {
        return { x, y };
      }
    }
  }
  return { x: state.hero.x, y: state.hero.y };
}

function findLegalSpawnId(sys: Systems, enemyId: string): string {
  for (const region of sys.data.regionList) {
    const match = [...region.residentSpawns, ...region.nightSpawns].find(
      (s) => s.enemyId === enemyId && sys.world.spawns.has(s.spawnId),
    );
    if (match) return match.spawnId;
  }
  return sys.world.spawns.keys().next().value ?? "camp_edge_weasel";
}

export function devSpawnEnemy(
  state: RunState,
  sys: Systems,
  enemyId: string,
): boolean {
  if (!import.meta.env.DEV) return false;
  const def = sys.data.enemies.get(enemyId);
  if (!def) return false;
  const pos = findSpawnPoint(state, sys);
  const id = `dev_${enemyId}_${state.idCounter++}`;
  const enemy = acquireEnemy(
    id,
    def.id,
    findLegalSpawnId(sys, def.id),
    pos.x,
    pos.y,
    def.maxHp,
    1,
  );
  enemy.phase = "chase";
  state.enemiesById[id] = enemy;
  return true;
}

export function devClearEnemies(state: RunState): void {
  if (!import.meta.env.DEV) return;
  releasePopulation(state);
}

export function devRestoreAndReset(state: RunState, sys: Systems): void {
  if (!import.meta.env.DEV) return;
  const { stats } = sys.data.balance;
  state.hero.hp = heroMaxHp(sys.data, state.inventory, state.heroId);
  state.hero.hunger = stats.hunger.max;
  state.hero.light = stats.light.max;
  state.hero.invulnerableSec = 0;
  state.hero.attackCooldownSec = 0;
  state.hero.hungerDamageSec = 0;
  state.hero.darknessDamageSec = 0;
  resetBucklerCooldown(state);
  resetDashCooldown(state);
}

export function devSimulateHit(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): boolean {
  if (!import.meta.env.DEV) return false;
  const applied = damageHero(state, sys, 2, events, "dev_dummy", {
    x: state.hero.x + state.hero.facingX * 24,
    y: state.hero.y + state.hero.facingY * 24,
  });
  if (!applied && isDevGodMode(state)) {
    events.push(
      makeEvent(EVT.notice, state.hero.x, state.hero.y, {
        message:
          "Invincible patterns have been activated and immune simulations have been hit",
      }),
    );
  }
  return applied;
}

export function devTogglePhase(state: RunState, sys: Systems): void {
  if (!import.meta.env.DEV) return;
  const { balance } = sys.data;
  const cycle = cycleSec(balance);
  const dayStart = Math.floor(state.elapsedSec / cycle) * cycle;
  let nextElapsed =
    state.phase === "day" ? dayStart + balance.clock.daySec : dayStart + cycle;
  if (nextElapsed >= balance.clock.runLimitSec) {
    nextElapsed = state.phase === "day" ? balance.clock.daySec : 0;
  }
  state.elapsedSec = nextElapsed;
  state.phase = phaseAt(nextElapsed, balance);
  state.day = dayAt(nextElapsed, balance);
  if (state.phase === "day") state.hero.darknessDamageSec = 0;
  tickSurvival(state, sys, 0, []);
}

export function createDevCommands(
  state: RunState,
  sys: Systems,
  presentOut: (out: SessionOutput) => void,
  refreshView: () => void,
): DevCommands {
  const sync = (events: GameEvent[] = []) => {
    if (events.length > 0) {
      presentOut({
        events,
        unlockedNotes: [],
        unlockedHeroes: [],
        unlockedCrossMode: [],
        autosaved: false,
      });
    }
    refreshView();
  };
  return {
    listEnemies: () =>
      [...sys.data.enemies.values()].map((e) => ({ id: e.id, name: e.name })),
    isGodMode: () => isDevGodMode(state),
    grantAllGear: () => {
      devGrantAllGear(state, sys);
      sync();
    },
    restoreAndReset: () => {
      devRestoreAndReset(state, sys);
      sync();
    },
    simulateHit: () => {
      const events: GameEvent[] = [];
      devSimulateHit(state, sys, events);
      sync(events);
    },
    togglePhase: () => {
      devTogglePhase(state, sys);
      sync();
    },
    toggleGodMode: () => {
      const on = toggleDevGodMode(state);
      sync();
      return on;
    },
    spawnEnemy: (enemyId: string) => {
      const ok = devSpawnEnemy(state, sys, enemyId);
      sync();
      return ok;
    },
    clearEnemies: () => {
      devClearEnemies(state);
      sync();
    },
  };
}
