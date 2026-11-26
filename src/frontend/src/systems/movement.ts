import { getHero } from "@/core/gameData";
import type { RunState, StepInputState, Systems } from "@/core/types";
import { heroMoveSpeedMultiplier, ownedStatBonus } from "./itemEffects";
import { rules } from "./runtimeRules";
import { type MoveOut, moveWithCollision } from "./world/collision";
import { evaluateRegionModifiers } from "./world/regionEffects";

export const HERO_RADIUS = 5;
const scratch: MoveOut = { x: 0, y: 0 };
const slideByRun = new WeakMap<RunState, { vx: number; vy: number }>();

/**
 * Unit-length (or shorter analog) movement vector. Diagonals are normalized so
 * moving diagonally is not faster than moving straight.
 */
export function normalizeMove(
  moveX: number,
  moveY: number,
  out: MoveOut,
): MoveOut {
  const x = Number.isFinite(moveX) ? moveX : 0;
  const y = Number.isFinite(moveY) ? moveY : 0;
  const len = Math.hypot(x, y);
  if (len > 1) {
    out.x = x / len;
    out.y = y / len;
  } else {
    out.x = x;
    out.y = y;
  }
  return out;
}

const dirScratch: MoveOut = { x: 0, y: 0 };

interface DashState {
  activeSec: number;
  invulnSec: number;
  cooldownSec: number;
  dx: number;
  dy: number;
}

/** In-memory only: dash state is never persisted in RunState. */
const dashes = new WeakMap<RunState, DashState>();
const DASH = {
  hungerCost: 3,
  speedMult: 2.35,
  activeSec: 0.16,
  invulnSec: 0.2,
  cooldownSec: 1.6,
};

function dashCooldownMaxSec(state: RunState, sys: Systems): number {
  return Math.max(
    0.6,
    (rules.dash?.cooldownSec ?? DASH.cooldownSec) -
      ownedStatBonus(sys.data, state.inventory, "dashCooldownReductionSec"),
  );
}

export function getDashCooldownState(
  state: RunState,
  sys: Systems,
): { remainingSec: number; maxSec: number } {
  return {
    remainingSec: dashes.get(state)?.cooldownSec ?? 0,
    maxSec: dashCooldownMaxSec(state, sys),
  };
}

/** Resets dash cooldown and active timers (used by DEV toolbar). */
export function resetDashCooldown(state: RunState): void {
  const dash = dashes.get(state);
  if (dash) dash.cooldownSec = 0;
}

/** True while the Shift dash i-frames are active. */
export function isHeroDashInvulnerable(state: RunState): boolean {
  return (dashes.get(state)?.invulnSec ?? 0) > 0;
}

/** True while the Shift dash burst movement posture is active. */
export function isHeroDashActive(state: RunState): boolean {
  return (dashes.get(state)?.activeSec ?? 0) > 0;
}

function dashFor(state: RunState, sec: number): DashState {
  let dash = dashes.get(state);
  if (!dash) {
    dash = { activeSec: 0, invulnSec: 0, cooldownSec: 0, dx: 0, dy: 0 };
    dashes.set(state, dash);
  }
  dash.invulnSec = Math.max(0, dash.invulnSec - sec);
  dash.cooldownSec = Math.max(0, dash.cooldownSec - sec);
  return dash;
}

function startDash(
  state: RunState,
  sys: Systems,
  dash: DashState,
  dx: number,
  dy: number,
) {
  const { hero } = state;
  if (dash.cooldownSec > 0 || hero.hunger < DASH.hungerCost) return;
  hero.hunger -= DASH.hungerCost;
  Object.assign(dash, {
    activeSec: DASH.activeSec,
    invulnSec: DASH.invulnSec,
    cooldownSec: dashCooldownMaxSec(state, sys),
    dx,
    dy,
  });
}

/**
 * Moves the hero at moveSpeedPxPerSec with wall sliding. Facing follows the last non-zero
 * movement direction. When `externalPosition` is given (Arcade owns the body) the core only
 * adopts that position and updates facing.
 */
export function moveHero(
  state: RunState,
  sys: Systems,
  input: Pick<StepInputState, "moveX" | "moveY"> & { dashPressed?: boolean },
  sec: number,
  externalPosition?: { x: number; y: number },
): void {
  const { hero } = state;
  const v = normalizeMove(input.moveX, input.moveY, dirScratch);
  const len = Math.hypot(v.x, v.y);
  if (len > 0) {
    hero.facingX = v.x / len;
    hero.facingY = v.y / len;
  }
  if (
    externalPosition &&
    Number.isFinite(externalPosition.x) &&
    Number.isFinite(externalPosition.y)
  ) {
    hero.x = externalPosition.x;
    hero.y = externalPosition.y;
    return;
  }
  const dash = dashFor(state, sec);
  if (input.dashPressed) {
    const fx = len > 0 ? v.x / len : hero.facingX;
    const fy = len > 0 ? v.y / len : hero.facingY;
    startDash(state, sys, dash, fx, fy);
  }
  const dashing = dash.activeSec > 0;
  const { data } = sys;
  const mods = evaluateRegionModifiers(state, sys);
  const base =
    data.balance.hero.moveSpeedPxPerSec *
    (getHero(data, state.heroId).traits.moveSpeedMult ?? 1) *
    heroMoveSpeedMultiplier(data, state.inventory) *
    mods.speedMult;

  let slide = slideByRun.get(state);
  if (!slide) {
    slide = { vx: 0, vy: 0 };
    slideByRun.set(state, slide);
  }

  let vx: number;
  let vy: number;
  let stepSec = sec;
  if (dashing) {
    stepSec = Math.min(sec, dash.activeSec);
    dash.activeSec -= stepSec;
    const distance = rules.dash?.distanceTiles;
    const speed =
      distance === undefined
        ? base * DASH.speedMult
        : (distance * data.tileSize) / DASH.activeSec;
    vx = dash.dx * speed;
    vy = dash.dy * speed;
    // A longer burst should not also multiply the speed of the ice coast.
    const coastSpeed = Math.min(speed, base * DASH.speedMult);
    slide.vx = dash.dx * coastSpeed;
    slide.vy = dash.dy * coastSpeed;
  } else {
    vx = v.x * base;
    vy = v.y * base;
    if (mods.slipperyDrag !== null) {
      const blend = 1 - Math.exp(-mods.slipperyDrag * sec);
      slide.vx += (vx - slide.vx) * blend;
      slide.vy += (vy - slide.vy) * blend;
      vx = slide.vx;
      vy = slide.vy;
    } else {
      slide.vx = vx;
      slide.vy = vy;
    }
  }

  if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return;
  moveWithCollision(
    sys.world,
    state.changesByObjectId,
    hero.x,
    hero.y,
    vx * stepSec,
    vy * stepSec,
    HERO_RADIUS,
    scratch,
  );
  hero.x = scratch.x;
  hero.y = scratch.y;
}
