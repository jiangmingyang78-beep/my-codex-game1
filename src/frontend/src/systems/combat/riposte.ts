import { EVT, makeEvent } from "@/core/events";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { HERO_RADIUS, refundDashCooldown } from "../movement";
import { type MoveOut, moveWithCollision } from "../world/collision";
import { ENEMY_RADIUS, angleBetweenDeg, inCone } from "./combatMath";
import { currentMove } from "./enemyAi";

export type RiposteTrigger = "telegraph_dash" | "dash_iframe" | "buckler_block";

export interface RiposteArmedPayload {
  trigger: RiposteTrigger;
  durationSec: number;
}

export interface RiposteStrikePayload {
  hitCount: number;
  damage: number;
  dirX: number;
  dirY: number;
  rangePx: number;
  lightRestored: number;
}

export interface RiposteSnapshot {
  armed: boolean;
  armedSec: number;
  icdSec: number;
  triggerKind: RiposteTrigger | null;
}

export interface ConsumedRiposte {
  triggerKind: RiposteTrigger | null;
  sourceX: number | null;
  sourceY: number | null;
}

export const RIPOSTE_CONFIG = {
  windowSec: 1.4,
  icdSec: 0.9,
  telegraphCommitSec: 0.25,
  lungeTiles: 1.6,
  thrustInvulnSec: 0.16,
  rangeBonusTiles: 0.85,
  arcDegrees: 52,
  damageMult: 1.75,
  knockbackSpeed: 210,
  knockbackSec: 0.18,
  lightOnHit: 5,
  dashCooldownRefundSec: 0.45,
} as const;

interface KnockbackEntry {
  vx: number;
  vy: number;
  sec: number;
}

interface RiposteRuntime {
  armedSec: number;
  icdSec: number;
  triggerKind: RiposteTrigger | null;
  sourceX: number | null;
  sourceY: number | null;
  knockback: Map<string, KnockbackEntry>;
}

/** In-memory only: riposte state is never persisted in RunState. */
const runtimes = new WeakMap<RunState, RiposteRuntime>();
const scratch: MoveOut = { x: 0, y: 0 };

function runtimeFor(state: RunState): RiposteRuntime {
  let rt = runtimes.get(state);
  if (!rt) {
    rt = {
      armedSec: 0,
      icdSec: 0,
      triggerKind: null,
      sourceX: null,
      sourceY: null,
      knockback: new Map(),
    };
    runtimes.set(state, rt);
  }
  return rt;
}

/** Read-only snapshot for presentation and HUD layers. */
export function getRiposteState(state: RunState): RiposteSnapshot {
  const rt = runtimes.get(state);
  if (!rt) {
    return { armed: false, armedSec: 0, icdSec: 0, triggerKind: null };
  }
  return {
    armed: rt.armedSec > 0,
    armedSec: rt.armedSec,
    icdSec: rt.icdSec,
    triggerKind: rt.armedSec > 0 ? rt.triggerKind : null,
  };
}

/** Advances riposte window/ICD timers and optional knockback movement. */
export function tickRiposte(state: RunState, sec: number, sys?: Systems): void {
  const rt = runtimes.get(state);
  if (!rt) return;
  rt.armedSec = Math.max(0, rt.armedSec - sec);
  if (rt.armedSec <= 0) {
    rt.triggerKind = null;
    rt.sourceX = null;
    rt.sourceY = null;
  }
  rt.icdSec = Math.max(0, rt.icdSec - sec);
  if (!sys || rt.knockback.size === 0) return;

  for (const [id, kb] of rt.knockback) {
    const e = state.enemiesById[id];
    if (!e || e.hp <= 0) {
      rt.knockback.delete(id);
      continue;
    }
    const dt = Math.min(sec, kb.sec);
    moveWithCollision(
      sys.world,
      state.changesByObjectId,
      e.x,
      e.y,
      kb.vx * dt,
      kb.vy * dt,
      ENEMY_RADIUS,
      scratch,
    );
    e.x = scratch.x;
    e.y = scratch.y;
    kb.sec -= dt;
    if (kb.sec <= 0) rt.knockback.delete(id);
  }
}

/** Arms Ember Riposte on a mitigated hit or committed telegraph dash if off ICD. */
export function tryArmRiposteOnMitigate(
  state: RunState,
  triggerKind: RiposteTrigger,
  events: GameEvent[],
  source?: { x: number; y: number },
): boolean {
  const rt = runtimeFor(state);
  if (rt.icdSec > 0) return false;
  rt.armedSec = RIPOSTE_CONFIG.windowSec;
  rt.icdSec = RIPOSTE_CONFIG.icdSec;
  rt.triggerKind = triggerKind;
  rt.sourceX = source ? source.x : null;
  rt.sourceY = source ? source.y : null;
  state.hero.attackCooldownSec = 0;
  const payload: RiposteArmedPayload = {
    trigger: triggerKind,
    durationSec: RIPOSTE_CONFIG.windowSec,
  };
  events.push(
    makeEvent(
      EVT.COMBAT_RIPOSTE_ARMED,
      state.hero.x,
      state.hero.y,
      payload as unknown as Record<string, unknown>,
    ),
  );
  return true;
}

function inSegment(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  lenPx: number,
  halfW: number,
  px: number,
  py: number,
): boolean {
  const dlen = Math.hypot(dx, dy);
  if (dlen === 0 || lenPx <= 0) return false;
  const ux = dx / dlen;
  const uy = dy / dlen;
  const proj = (px - ox) * ux + (py - oy) * uy;
  const t = Math.max(0, Math.min(lenPx, proj));
  const cx = ox + ux * t;
  const cy = oy + uy * t;
  return Math.hypot(px - cx, py - cy) <= halfW;
}

/** Checks whether a dash start occurred inside a committed enemy attack telegraph. */
export function tryArmRiposteOnDash(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): boolean {
  const tile = sys.data.tileSize;
  const { hero } = state;
  for (const id in state.enemiesById) {
    const e = state.enemiesById[id];
    if (
      e.hp <= 0 ||
      e.phase !== "windup" ||
      e.phaseSec > RIPOSTE_CONFIG.telegraphCommitSec
    ) {
      continue;
    }
    const def = getEnemy(sys.data, e.enemyId);
    const move = currentMove(def, e);
    let inDanger = false;
    if (move.type === "sweep") {
      inDanger = inCone(
        e.x,
        e.y,
        e.dirX,
        e.dirY,
        hero.x,
        hero.y,
        (move.rangeTiles ?? 2) * tile,
        move.arcDegrees ?? 100,
        HERO_RADIUS,
      );
    } else if (move.type === "charge" || move.type === "lunge") {
      const lenPx =
        (move.distanceTiles ?? move.rangeTiles ?? move.triggerRangeTiles) *
        tile;
      inDanger = inSegment(
        e.x,
        e.y,
        e.dirX,
        e.dirY,
        lenPx,
        ENEMY_RADIUS + HERO_RADIUS + 3,
        hero.x,
        hero.y,
      );
    } else if (move.type === "projectile") {
      const lenPx =
        (move.projectileSpeedPxPerSec ?? 100) *
        (move.projectileLifetimeSec ?? 2);
      inDanger = inSegment(
        e.x,
        e.y,
        e.dirX,
        e.dirY,
        lenPx,
        HERO_RADIUS + 3 + 4,
        hero.x,
        hero.y,
      );
    }
    if (inDanger) {
      return tryArmRiposteOnMitigate(state, "telegraph_dash", events, {
        x: e.x,
        y: e.y,
      });
    }
  }
  return false;
}

/** Consumes an active riposte charge if available, returning its metadata or null. */
export function consumeRiposte(state: RunState): ConsumedRiposte | null {
  const rt = runtimes.get(state);
  if (!rt || rt.armedSec <= 0) return null;
  const meta: ConsumedRiposte = {
    triggerKind: rt.triggerKind,
    sourceX: rt.sourceX,
    sourceY: rt.sourceY,
  };
  rt.armedSec = 0;
  rt.triggerKind = null;
  rt.sourceX = null;
  rt.sourceY = null;
  return meta;
}

/** Executes the stepped riposte lunge and grants thrust invulnerability. */
export function lungeForRiposte(
  state: RunState,
  sys: Systems,
  meta: ConsumedRiposte,
): void {
  const { hero } = state;
  const fl = Math.hypot(hero.facingX, hero.facingY) || 1;
  let dx = hero.facingX / fl;
  let dy = hero.facingY / fl;
  if (meta.sourceX !== null && meta.sourceY !== null) {
    const tx = meta.sourceX - hero.x;
    const ty = meta.sourceY - hero.y;
    const tlen = Math.hypot(tx, ty);
    if (tlen > 0 && angleBetweenDeg(dx, dy, tx, ty) <= 75) {
      dx = tx / tlen;
      dy = ty / tlen;
    }
  }
  hero.facingX = dx;
  hero.facingY = dy;
  const steps = 3;
  const stepDist = (RIPOSTE_CONFIG.lungeTiles * sys.data.tileSize) / steps;
  for (let i = 0; i < steps; i++) {
    const prevX = hero.x;
    const prevY = hero.y;
    moveWithCollision(
      sys.world,
      state.changesByObjectId,
      hero.x,
      hero.y,
      dx * stepDist,
      dy * stepDist,
      HERO_RADIUS,
      scratch,
    );
    hero.x = scratch.x;
    hero.y = scratch.y;
    if (Math.hypot(hero.x - prevX, hero.y - prevY) < stepDist * 0.5) break;
  }
  hero.invulnerableSec = Math.max(
    hero.invulnerableSec,
    RIPOSTE_CONFIG.thrustInvulnSec,
  );
}

/** Applies knockback, light restore, dash cooldown refund and emits the strike event. */
export function finishRiposteStrike(
  state: RunState,
  sys: Systems,
  targets: EnemyState[],
  damage: number,
  rangePx: number,
  events: GameEvent[],
): void {
  const rt = runtimeFor(state);
  const { hero } = state;
  for (const e of targets) {
    const live = state.enemiesById[e.id];
    if (!live || live.hp <= 0) continue;
    const kx = live.x - hero.x;
    const ky = live.y - hero.y;
    const klen = Math.hypot(kx, ky);
    const ux = klen > 0 ? kx / klen : hero.facingX;
    const uy = klen > 0 ? ky / klen : hero.facingY;
    rt.knockback.set(live.id, {
      vx: ux * RIPOSTE_CONFIG.knockbackSpeed,
      vy: uy * RIPOSTE_CONFIG.knockbackSpeed,
      sec: RIPOSTE_CONFIG.knockbackSec,
    });
  }
  let lightRestored = 0;
  if (targets.length >= 1) {
    const before = hero.light;
    hero.light = Math.min(
      sys.data.balance.stats.light.max,
      hero.light + RIPOSTE_CONFIG.lightOnHit,
    );
    lightRestored = hero.light - before;
    refundDashCooldown(state, RIPOSTE_CONFIG.dashCooldownRefundSec);
  }
  const payload: RiposteStrikePayload = {
    hitCount: targets.length,
    damage,
    dirX: hero.facingX,
    dirY: hero.facingY,
    rangePx,
    lightRestored,
  };
  events.push(
    makeEvent(
      EVT.COMBAT_RIPOSTE_STRIKE,
      hero.x,
      hero.y,
      payload as unknown as Record<string, unknown>,
    ),
  );
}
