import { EVT, makeEvent } from "@/core/events";
import { getHero } from "@/core/gameData";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { hitEnemy } from "../EnemyManager";
import { countOf } from "../inventory";
import { ownedStatBonus } from "../itemEffects";
import { detonateResinBarrel } from "../world/regionEffects";
import { ENEMY_RADIUS, inCone } from "./combatMath";
import {
  RIPOSTE_CONFIG,
  consumeRiposte,
  finishRiposteStrike,
  lungeForRiposte,
} from "./riposte";

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
  w.damage +=
    ownedStatBonus(sys.data, state.inventory, "attackDamage") +
    (getHero(sys.data, state.heroId).traits.attackDamageDelta ?? 0);
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
  const riposte = consumeRiposte(state);
  if (riposte) lungeForRiposte(state, sys, riposte);
  events.push(
    makeEvent(EVT.swing, hero.x, hero.y, {
      dx: hero.facingX,
      dy: hero.facingY,
    }),
  );
  const range =
    (w.rangeTiles + (riposte ? RIPOSTE_CONFIG.rangeBonusTiles : 0)) *
    sys.data.tileSize;
  const arc = riposte ? RIPOSTE_CONFIG.arcDegrees : w.arcDegrees;
  const damage = riposte
    ? Math.ceil(w.damage * RIPOSTE_CONFIG.damageMult)
    : w.damage;
  const targets: EnemyState[] = [];
  for (const id in state.enemiesById) {
    const e = state.enemiesById[id];
    if (
      e.hp > 0 &&
      inCone(
        hero.x,
        hero.y,
        hero.facingX,
        hero.facingY,
        e.x,
        e.y,
        range,
        arc,
        ENEMY_RADIUS,
      )
    )
      targets.push(e);
  }
  for (const e of targets) hitEnemy(state, sys, e, damage, events);
  for (const o of sys.world.objectList) {
    if (
      o.kind === "explosive_barrel" &&
      !state.changesByObjectId[o.id]?.opened &&
      inCone(
        hero.x,
        hero.y,
        hero.facingX,
        hero.facingY,
        o.x,
        o.y,
        range,
        arc,
        ENEMY_RADIUS,
      )
    ) {
      detonateResinBarrel(state, sys, o.id, events);
    }
  }
  if (riposte) finishRiposteStrike(state, sys, targets, damage, range, events);
  return true;
}
