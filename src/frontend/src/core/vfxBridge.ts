import type { GameData } from "./dataTypes";
import { EVT } from "./events";
import type { GameEvent } from "./types";

/** Shape accepted by createEffects(...).emit(). x and y are always finite. */
export interface VfxEvent {
  type:
    | "combat.hit"
    | "resource.collected"
    | "camp.lit"
    | "camp.ember"
    | "element.steam";
  x: number;
  y: number;
  payload: Record<string, unknown>;
}

export function elementMark(e: GameEvent) {
  if (e.type !== "element.changed" || e.x === null || e.y === null) return null;
  const surface = e.payload.surface;
  if (
    surface !== "burning" &&
    surface !== "scorched" &&
    surface !== "frost" &&
    surface !== "melted" &&
    surface !== "clear"
  )
    return null;
  return { x: e.x, y: e.y, surface };
}
const FORWARDED = new Set([
  "element.steam",
  "combat.hit",
  "resource.collected",
  "camp.lit",
  "camp.ember",
]);

const SPECIAL_HITS: Record<string, VfxEvent["payload"]> = {
  "enemy.telegraph": { kind: "guard", color: "#ff9a70" },
  [EVT.enemyAoeDetonated]: { kind: "boss", color: "#ff7968" },
  [EVT.enemyPhaseChanged]: { kind: "boss", color: "#bba4ff" },
  [EVT.blocked]: { kind: "guard", color: "#a6d6ee" },
};

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
  if (Object.hasOwn(SPECIAL_HITS, event.type))
    return {
      type: EVT.hit,
      x,
      y,
      payload: { ...event.payload, ...SPECIAL_HITS[event.type] },
    };
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
