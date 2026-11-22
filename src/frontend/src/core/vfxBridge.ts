import type { GameData } from "./dataTypes";
import type { GameEvent } from "./types";

/** Shape accepted by createEffects(...).emit(). x and y are always finite. */
export interface VfxEvent {
  type: "combat.hit" | "resource.collected" | "camp.lit" | "camp.ember";
  x: number;
  y: number;
  payload: Record<string, unknown>;
}

const FORWARDED = new Set([
  "combat.hit",
  "resource.collected",
  "camp.lit",
  "camp.ember",
]);

/**
 * Maps a GameEvent to the VFX emit input. Returns null for events the VFX layer does not
 * draw and for events without a finite position (VFX throws on non-finite coordinates).
 * `camp.upgraded` is shown as a camp ignition burst.
 */
export function toVfxEvent(event: GameEvent): VfxEvent | null {
  const { x, y } = event;
  if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y))
    return null;
  if (event.type === "camp.upgraded")
    return { type: "camp.lit", x, y, payload: { count: 12 } };
  if (!FORWARDED.has(event.type)) return null;
  return { type: event.type as VfxEvent["type"], x, y, payload: event.payload };
}

/**
 * Particle budget for the VFX layer. Uses limits.maxParticles, or
 * limits.reducedMotionMaxParticles when reduced motion is on.
 */
export function particleBudget(data: GameData, reducedMotion: boolean): number {
  const { limits } = data.balance;
  return reducedMotion
    ? Math.min(limits.reducedMotionMaxParticles, limits.maxParticles)
    : limits.maxParticles;
}
