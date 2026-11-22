import type { RunState, StepInputState, Systems } from "@/core/types";
import { type MoveOut, moveWithCollision } from "./world/collision";

export const HERO_RADIUS = 5;
const scratch: MoveOut = { x: 0, y: 0 };

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

/**
 * Moves the hero at moveSpeedPxPerSec with wall sliding. Facing follows the last non-zero
 * movement direction. When `externalPosition` is given (Arcade owns the body) the core only
 * adopts that position and updates facing.
 */
export function moveHero(
  state: RunState,
  sys: Systems,
  input: Pick<StepInputState, "moveX" | "moveY">,
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
  if (len === 0) return;
  const speed = sys.data.balance.hero.moveSpeedPxPerSec * sec;
  moveWithCollision(
    sys.world,
    state.changesByObjectId,
    hero.x,
    hero.y,
    v.x * speed,
    v.y * speed,
    HERO_RADIUS,
    scratch,
  );
  hero.x = scratch.x;
  hero.y = scratch.y;
}
