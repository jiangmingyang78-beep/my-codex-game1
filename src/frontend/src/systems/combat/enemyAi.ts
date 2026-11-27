import type { AttackMove, EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { HERO_RADIUS } from "../movement";
import { rules } from "../runtimeRules";
import { damageHero } from "../survival";
import { type MoveOut, moveWithCollision, solidAt } from "../world/collision";
import { ENEMY_RADIUS, inCone } from "./combatMath";
import { attackSeeds } from "./enemySeeds";

const AGGRO_TILES = 8;
const LEASH_TILES = 16;

const CONTACT_PX = ENEMY_RADIUS + HERO_RADIUS + 3;
const scratch: MoveOut = { x: 0, y: 0 };

/** Move being used now: single attack, or the boss's alternating move list. */
export function currentMove(def: EnemyDef, e: EnemyState): AttackMove {
  const a = def.attack;
  if (a.type === "alternating" && a.moves?.length)
    return a.moves[e.moveIndex % a.moves.length];
  return a as AttackMove;
}

function intervalFor(def: EnemyDef, e: EnemyState, move: AttackMove): number {
  const a = def.attack;
  if (a.enrage && e.hp / def.maxHp <= a.enrage.hpRatioAtOrBelow)
    return a.enrage.intervalSec;
  return a.intervalSec ?? move.intervalSec ?? 0;
}

function step(
  e: EnemyState,
  sys: Systems,
  state: RunState,
  dx: number,
  dy: number,
): void {
  moveWithCollision(
    sys.world,
    state.changesByObjectId,
    e.x,
    e.y,
    dx,
    dy,
    ENEMY_RADIUS,
    scratch,
  );
  e.x = scratch.x;
  e.y = scratch.y;
}

function startWindup(
  e: EnemyState,
  state: RunState,
  move: AttackMove,
  events: GameEvent[],
): void {
  const dx = state.hero.x - e.x;
  const dy = state.hero.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  e.dirX = dx / len; // direction is locked here so a sidestep during the telegraph dodges it
  e.dirY = dy / len;
  e.phase = "windup";
  e.phaseSec = move.windupSec;
  e.hitDone = false;
  events.push(
    makeEvent(EVT.windup, e.x, e.y, {
      id: e.id,
      enemyId: e.enemyId,
      attack: move.type,
      seconds: move.windupSec,
    }),
  );
}

function launchProjectile(
  e: EnemyState,
  def: EnemyDef,
  move: AttackMove,
  state: RunState,
  sys: Systems,
): void {
  if (state.projectiles.length >= sys.data.balance.limits.activeProjectiles)
    return;
  const speed = move.projectileSpeedPxPerSec ?? 100;
  state.projectiles.push({
    id: `proj_${state.idCounter++}`,
    x: e.x,
    y: e.y,
    vx: e.dirX * speed,
    vy: e.dirY * speed,
    lifeSec: move.projectileLifetimeSec ?? 2,
    damage: def.attackDamage,
  });
}

function strikeHero(
  e: EnemyState,
  def: EnemyDef,
  move: AttackMove,
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  if (
    damageHero(state, sys, def.attackDamage, events, def.id, {
      x: e.x,
      y: e.y,
    }) &&
    move.lightDamage
  ) {
    state.hero.light = Math.max(0, state.hero.light - move.lightDamage);
  }
  e.hitDone = true;
}

function updateAttack(
  e: EnemyState,
  def: EnemyDef,
  move: AttackMove,
  sec: number,
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  const tile = sys.data.tileSize;
  const { hero } = state;
  if (e.phaseSec <= 0 && !e.hitDone && move.type === "sweep") {
    if (
      inCone(
        e.x,
        e.y,
        e.dirX,
        e.dirY,
        hero.x,
        hero.y,
        (move.rangeTiles ?? 2) * tile,
        move.arcDegrees ?? 100,
        HERO_RADIUS,
      )
    ) {
      strikeHero(e, def, move, state, sys, events);
    }
    e.hitDone = true;
  }
  attackSeeds[move.type]?.update(e, sec, hero, {
    move,
    tileSize: tile,
    contactRadiusPx: CONTACT_PX,
    moveBy: (dx, dy) => step(e, sys, state, dx, dy),
    strikeHero: () => strikeHero(e, def, move, state, sys, events),
  });
}

export function updateLegacyEnemy(
  e: EnemyState,
  def: EnemyDef,
  sec: number,
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  const tile = sys.data.tileSize;
  const { hero } = state;
  const dist = Math.hypot(hero.x - e.x, hero.y - e.y);
  const move = currentMove(def, e);
  e.cooldownSec = Math.max(0, e.cooldownSec - sec);
  const aware = state.regionId === sys.world.spawns.get(e.spawnId)?.regionId;
  switch (e.phase) {
    case "idle":
      if (aware && dist <= (rules.perception?.aggroTiles ?? AGGRO_TILES) * tile)
        e.phase = "chase";
      return;
    case "chase": {
      if (
        e.nightRound === null &&
        (!aware || dist > (rules.perception?.leashTiles ?? LEASH_TILES) * tile)
      ) {
        e.phase = "idle";
        return;
      }
      if (e.cooldownSec <= 0 && dist <= move.triggerRangeTiles * tile) {
        startWindup(e, state, move, events);
        return;
      }
      if (dist > CONTACT_PX) {
        const v = (def.moveSpeedPxPerSec * sec) / dist;
        step(e, sys, state, (hero.x - e.x) * v, (hero.y - e.y) * v);
      }
      return;
    }
    case "windup":
      e.phaseSec -= sec;
      if (e.phaseSec > 0) return;
      e.phase = "attack";
      e.phaseSec =
        move.type === "projectile"
          ? 0
          : (move.travelSec ?? move.activeSec ?? 0.1);
      if (move.type === "projectile")
        launchProjectile(e, def, move, state, sys);
      return;
    case "attack":
      updateAttack(e, def, move, sec, state, sys, events);
      e.phaseSec -= sec;
      if (e.phaseSec <= 0) {
        e.phase = "recovery";
        e.phaseSec = move.recoverySec;
      }
      return;
    default:
      e.phaseSec -= sec;
      if (e.phaseSec <= 0) {
        e.cooldownSec = intervalFor(def, e, move);
        e.moveIndex++;
        e.phase = "chase";
      }
  }
}

export function updateProjectiles(
  state: RunState,
  sys: Systems,
  sec: number,
  events: GameEvent[],
): void {
  const tile = sys.data.tileSize;
  const list = state.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.lifeSec -= sec;
    p.x += p.vx * sec;
    p.y += p.vy * sec;
    const wall = solidAt(
      sys.world,
      state.changesByObjectId,
      Math.floor(p.x / tile),
      Math.floor(p.y / tile),
    );
    const hit =
      !wall &&
      Math.hypot(state.hero.x - p.x, state.hero.y - p.y) <= HERO_RADIUS + 3;
    if (hit)
      damageHero(state, sys, p.damage, events, "projectile", {
        x: p.x - p.vx,
        y: p.y - p.vy,
      });
    if (hit || wall || p.lifeSec <= 0) list.splice(i, 1);
  }
}
