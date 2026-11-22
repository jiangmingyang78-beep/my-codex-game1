import type { EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { countOf } from "../inventory";
import { ENEMY_RADIUS, inCone } from "./combatMath";
import { defeatEnemy } from "./loot";

export interface Weapon {
  damage: number;
  rangeTiles: number;
  arcDegrees: number;
  cooldownSec: number;
}

/** Base hero stats overridden by owned equipment (iron spear: damage 2, range 1.75). */
export function currentWeapon(state: RunState, sys: Systems): Weapon {
  const h = sys.data.balance.hero;
  const w: Weapon = {
    damage: h.attackDamage,
    rangeTiles: h.attackRangeTiles,
    arcDegrees: h.attackArcDegrees,
    cooldownSec: h.attackCooldownSec,
  };
  for (const item of sys.data.itemList) {
    if (countOf(state.inventory, item.id) <= 0) continue;
    for (const e of item.effects) {
      if (e.trigger === "owned" && e.type === "set_combat_stat") {
        if (e.stat === "attackDamage") w.damage = e.value;
        else w.rangeTiles = e.value;
      }
    }
  }
  return w;
}

/**
 * Swings in the facing direction when off cooldown. Every enemy inside the 100 degree cone
 * and weapon range takes damage; lethal hits go through defeatEnemy (loot, rewards).
 */
export function heroAttack(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): boolean {
  const { hero } = state;
  if (hero.attackCooldownSec > 0) return false;
  const w = currentWeapon(state, sys);
  hero.attackCooldownSec = w.cooldownSec;
  hero.attackAnimSec = 0.18;
  events.push(
    makeEvent(EVT.swing, hero.x, hero.y, {
      dx: hero.facingX,
      dy: hero.facingY,
    }),
  );
  const range = w.rangeTiles * sys.data.tileSize;
  const targets: EnemyState[] = [];
  for (const id in state.enemiesById) {
    const e = state.enemiesById[id];
    if (
      inCone(
        hero.x,
        hero.y,
        hero.facingX,
        hero.facingY,
        e.x,
        e.y,
        range,
        w.arcDegrees,
        ENEMY_RADIUS,
      )
    )
      targets.push(e);
  }
  for (const e of targets) {
    const def: EnemyDef | undefined = sys.data.enemies.get(e.enemyId);
    if (!def) continue;
    e.hp -= w.damage;
    const dist = Math.max(1, Math.hypot(e.x - hero.x, e.y - hero.y));
    const dx = (e.x - hero.x) / dist;
    const dy = (e.y - hero.y) / dist;
    const kill = e.hp <= 0;
    const kind = kill
      ? def.id === "beacon_keeper"
        ? "boss"
        : "finisher"
      : "strike";
    events.push(
      makeEvent(EVT.hit, e.x, e.y, {
        kind,
        dx,
        dy,
        targetId: e.id,
        damage: w.damage,
      }),
    );
    if (kill) defeatEnemy(state, sys, e, events);
  }
  return true;
}
