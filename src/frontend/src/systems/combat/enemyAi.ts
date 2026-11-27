import type { AttackMove, EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import type { Projectile } from "@/core/types";
import type { Point } from "@/entities/enemySeeds";
import { chillSpeed } from "../buffs";
import { chaseDisplacement } from "../movement";
import { HERO_RADIUS } from "./combatMath";
import { PLAYER, actor } from "./ecology";
import { projectilePool } from "./projectilePool";

import { type MoveOut, moveWithCollision, solidAt } from "../world/collision";
import { ENEMY_RADIUS, inCone } from "./combatMath";
import { attackSeeds } from "./enemySeeds";

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
    dx * chillSpeed(e, state.elapsedSec),
    dy * chillSpeed(e, state.elapsedSec),
    ENEMY_RADIUS,
    scratch,
  );
  e.x = scratch.x;
  e.y = scratch.y;
}

function startWindup(
  e: EnemyState,
  target: Point,
  move: AttackMove,
  events: GameEvent[],
): void {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
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
  const shot = projectilePool.acquire();
  shot.id = `proj_${state.idCounter++}`;
  shot.x = e.x;
  shot.y = e.y;
  shot.vx = e.dirX * speed;
  shot.vy = e.dirY * speed;
  shot.lifeSec = move.projectileLifetimeSec ?? 2;
  shot.targetId = e.targetId;
  shot.sourceId = e.id;
  shot.damage = def.attackDamage;
  state.projectiles.push(shot);
}

function updateAttack(
  e: EnemyState,
  def: EnemyDef,
  move: AttackMove,
  sec: number,
  state: RunState,
  sys: Systems,
  hero: Point,
  hit: (damage: number) => boolean,
): void {
  const tile = sys.data.tileSize;
  if (e.phaseSec <= sec && !e.hitDone && move.type === "sweep") {
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
      if (hit(def.attackDamage) && hero === state.hero && move.lightDamage)
        state.hero.light = Math.max(0, state.hero.light - move.lightDamage);
    }
    e.hitDone = true;
  }
  attackSeeds[move.type]?.update(e, sec, hero, {
    move,
    tileSize: tile,
    contactRadiusPx: CONTACT_PX,
    moveBy: (dx, dy) => step(e, sys, state, dx, dy),
    strikeHero: () => {
      if (hit(def.attackDamage) && hero === state.hero && move.lightDamage)
        state.hero.light = Math.max(0, state.hero.light - move.lightDamage);
      e.hitDone = true;
    },
  });
}

export function updateLegacyEnemy(
  e: EnemyState,
  def: EnemyDef,
  sec: number,
  state: RunState,
  sys: Systems,
  events: GameEvent[],
  hero: Point,
  hit: (damage: number) => boolean,
): void {
  const tile = sys.data.tileSize;
  const dist = Math.hypot(hero.x - e.x, hero.y - e.y);
  const move = currentMove(def, e);
  e.cooldownSec = Math.max(0, e.cooldownSec - sec);
  switch (e.phase) {
    case "chase": {
      if (e.cooldownSec <= 0 && dist <= move.triggerRangeTiles * tile) {
        startWindup(e, hero, move, events);
        return;
      }
      if (dist > CONTACT_PX) {
        const v = (def.moveSpeedPxPerSec * sec) / dist;
        const dx = (hero.x - e.x) * v;
        const dy = (hero.y - e.y) * v;
        if (hero === state.hero) {
          const path = chaseDisplacement(state, sys, e, dx, dy);
          step(e, sys, state, path.x, path.y);
        } else step(e, sys, state, dx, dy);
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
      updateAttack(e, def, move, sec, state, sys, hero, hit);
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
  strike: (p: Projectile, target: Point) => void,
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
    const target = actor(state, p.targetId ?? PLAYER);
    const hit =
      !wall &&
      target &&
      Math.hypot(target.x - p.x, target.y - p.y) <= HERO_RADIUS + 3;
    if (hit) strike(p, target);
    if (hit || wall || p.lifeSec <= 0) {
      const last = list.pop()!;
      if (last !== p) list[i] = last;
      projectilePool.release(p);
    }
  }
}
