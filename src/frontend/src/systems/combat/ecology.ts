import type { EnemyDef, Faction } from "@/core/dataTypes";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { rules } from "../runtimeRules";

import { runContext } from "../world/runContext";
export const PLAYER = "player";
const hostile: Record<Faction, readonly Faction[]> = {
  beast: ["shadow"],
  shadow: ["beast"],
  construct: [],
  neutral: [],
};

export function factionOf(def: EnemyDef): Faction {
  if (def.faction) return def.faction;
  if (/shade|shadow|wisp|husk/.test(def.id)) return "shadow";
  if (/guard|warden|keeper|mill_|woodcutter|shield/.test(def.id))
    return "construct";
  return def.id === "ice_ram" ? "neutral" : "beast";
}

export function actor(state: RunState, id?: string) {
  if (id === PLAYER) return state.hero;
  return id ? state.enemiesById[id] : undefined;
}

const perception = (sys: Systems) =>
  (rules.perception?.aggroTiles ?? 8) * sys.data.tileSize;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

// One frozen coordinate sample per living actor. Reuse slots across sensing passes.
class Neighborhood {
  at = Number.NaN;
  private groups = new Map<
    Faction,
    { count: number; slots: { enemy: EnemyState; x: number; y: number }[] }
  >();
  refresh(state: RunState, sys: Systems) {
    if (this.at === state.elapsedSec) return;
    this.at = state.elapsedSec;
    for (const group of this.groups.values()) group.count = 0;
    for (const id in state.enemiesById) {
      const enemy = state.enemiesById[id];
      const def = sys.data.enemies.get(enemy.enemyId);
      if (!def || enemy.hp <= 0) continue;
      const faction = factionOf(def);
      let group = this.groups.get(faction);
      if (!group) {
        group = { count: 0, slots: [] };
        this.groups.set(faction, group);
      }
      const index = group.count++;
      if (!group.slots[index]) group.slots[index] = { enemy, x: 0, y: 0 };
      const slot = group.slots[index];
      slot.enemy = enemy;
      slot.x = enemy.x;
      slot.y = enemy.y;
    }
  }
  visit(
    center: EnemyState,
    factions: readonly Faction[],
    radius: number,
    accept: (enemy: EnemyState, d: number) => number,
  ) {
    let limit = radius;
    for (const faction of factions) {
      const group = this.groups.get(faction);
      if (!group) continue;
      for (let i = 0; i < group.count; i++) {
        const slot = group.slots[i];
        const dx = slot.x - center.x;
        const dy = slot.y - center.y;
        if (slot.enemy.hp <= 0 || dx * dx + dy * dy > limit * limit) continue;
        limit = accept(slot.enemy, Math.hypot(dx, dy));
      }
    }
  }
}
const neighborhoods = new WeakMap<RunState, Neighborhood>();
function neighborhood(state: RunState, sys: Systems) {
  let grid = neighborhoods.get(state);
  if (!grid) {
    grid = new Neighborhood();
    neighborhoods.set(state, grid);
  }
  grid.refresh(state, sys);
  return grid;
}

export function provoke(
  state: RunState,
  sys: Systems,
  e: EnemyState,
  source: string,
) {
  const alert = (ally: EnemyState) => {
    ally.threatId = source;
    ally.threatUntil = state.elapsedSec + 5;
    ally.nextSense = 0;
  };
  alert(e);
  const def = sys.data.enemies.get(e.enemyId);
  if (def && factionOf(def) === "neutral") {
    const radius = perception(sys);
    neighborhood(state, sys).visit(e, ["neutral"], radius, (ally) => {
      if (ally.enemyId === e.enemyId && ally.id !== source) alert(ally);
      return radius;
    });
  }
}

export function selectTarget(
  state: RunState,
  sys: Systems,
  e: EnemyState,
  def: EnemyDef,
) {
  const region =
    e.nightRound === null
      ? sys.world.spawns.get(e.spawnId)?.regionId
      : undefined;
  const heroOutside = region !== undefined && region !== state.regionId;
  if (heroOutside && e.targetId === PLAYER) {
    e.targetId = undefined;
    e.phase = "idle";
    e.nextSense = 0;
  }
  const committed =
    e.phase === "windup" || e.phase === "attack" || e.phase === "recovery";
  if (committed) return actor(state, e.targetId ?? PLAYER);
  if (state.elapsedSec < (e.nextSense ?? 0)) return actor(state, e.targetId);
  e.nextSense = state.elapsedSec + 0.2;
  const previous = e.targetId;
  e.targetId = undefined;
  const radius = perception(sys);
  const home = { x: e.homeX, y: e.homeY };
  const territory =
    (def.territoryRadius ?? rules.perception?.leashTiles ?? 16) *
    sys.data.tileSize;
  if (e.nightRound === null && distance(home, e) > territory) return;
  const attacker = actor(state, e.threatId);
  if (
    attacker &&
    (e.threatUntil ?? 0) > state.elapsedSec &&
    distance(e, attacker) <= radius
  ) {
    e.targetId = e.threatId;
    return attacker;
  }
  const context = runContext(state, sys);
  const faction = factionOf(def);
  if (
    faction === "neutral" ||
    (def.activeWindow &&
      def.activeWindow !== "any" &&
      def.activeWindow !== state.phase)
  )
    return;
  if (hostile[faction].length) {
    neighborhood(state, sys).visit(e, hostile[faction], radius, (other, d) => {
      if (!context.senses(e, other))
        return e.targetId ? distance(e, actor(state, e.targetId)!) : radius;
      e.targetId = other.id;
      return d;
    });
  }
  if (e.targetId) return actor(state, e.targetId);
  const pursuing = e.phase !== "idle" && (!previous || previous === PLAYER);
  const reach = pursuing
    ? (rules.perception?.leashTiles ?? 16) * sys.data.tileSize
    : radius;
  // Raids arrive with an assigned objective. Only new creature targets require a spatial query.
  const heroDistance = distance(e, state.hero);
  const heroInvades =
    !heroOutside &&
    (e.nightRound !== null || distance(home, state.hero) <= territory) &&
    heroDistance <= reach &&
    (previous === PLAYER || context.senses(e, state.hero));
  if (heroInvades) e.targetId = PLAYER;
  if (def.territoryRadius !== undefined && e.nightRound === null) {
    let limit = heroInvades ? Math.min(radius, heroDistance) : radius;
    const visitors = (Object.keys(hostile) as Faction[]).filter(
      (f) => f !== faction && !hostile[faction].includes(f),
    );
    neighborhood(state, sys).visit(e, visitors, limit, (other, d) => {
      if (distance(home, other) <= territory && context.senses(e, other)) {
        e.targetId = other.id;
        limit = d;
      }
      return limit;
    });
  }
  return actor(state, e.targetId);
}
