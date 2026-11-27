import type { EnemyDef } from "@/core/dataTypes";
import type { EnemyState } from "@/core/types";
import type { LightGrid } from "../world/lightGrid";

/** A close target at the rim can bait a committed, normally telegraphed lunge. */
export function skirtLight(
  e: EnemyState,
  def: EnemyDef,
  target: { x: number; y: number },
  light: LightGrid,
  dt: number,
  tile: number,
  move: (e: EnemyState, dx: number, dy: number) => void,
) {
  const threshold = def.fearLightThreshold;
  if (
    threshold === undefined ||
    !["idle", "chase", "SKIRT_LIGHT"].includes(e.phase)
  )
    return false;
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const level = (x: number, y: number) => light.getLightLevel(x, y).block;
  const inside = level(e.x, e.y) >= threshold;
  const trigger =
    (def.attack.triggerTiles ?? def.attack.triggerRangeTiles ?? 0) * tile;
  const lunges = def.attack.type === "lunge" || def.attack.type === "charge";
  const travel =
    lunges && length <= trigger ? (def.attack.distanceTiles ?? 1) * tile : tile;
  let blocked = false;
  for (
    let ahead = Math.min(tile / 2, length);
    ahead <= Math.min(travel, length) + tile / 2;
    ahead += tile / 2
  ) {
    const sample = Math.min(ahead, length, travel);
    if (level(e.x + ux * sample, e.y + uy * sample) >= threshold) {
      blocked = true;
      break;
    }
  }
  if (!inside && !blocked && !e.retreating) {
    if (e.phase === "SKIRT_LIGHT") e.phase = "chase";
    return false;
  }
  if (e.phase !== "SKIRT_LIGHT") {
    e.phase = "SKIRT_LIGHT";
    e.phaseSec = 1.2;
  }
  e.phaseSec = Math.max(0, e.phaseSec - dt);
  if (
    !inside &&
    !e.retreating &&
    e.phaseSec <= 0 &&
    lunges &&
    length <=
      Math.min(trigger, (def.attack.distanceTiles ?? 1) * tile + tile / 2)
  ) {
    e.phase = "chase";
    e.retreating = true;
    return false;
  }
  const speed = def.moveSpeedPxPerSec * dt;
  // Follow the cooler tangent; if engulfed, sample the gradient away from the fire.
  const choices =
    inside || e.retreating
      ? [
          [-ux, -uy],
          [-uy, ux],
          [uy, -ux],
          [ux, uy],
        ]
      : [
          [-uy, ux],
          [uy, -ux],
          [-ux, -uy],
        ];
  let best = Number.POSITIVE_INFINITY;
  let chosen: number[] | undefined;
  for (const dir of choices) {
    const [x, y] = dir;
    const probe = level(e.x + x * tile, e.y + y * tile);
    if (
      (inside || level(e.x + x * speed, e.y + y * speed) < threshold) &&
      probe < best
    ) {
      best = probe;
      chosen = dir;
      if (!inside && !e.retreating && probe < threshold) break;
    }
  }
  if (chosen) move(e, chosen[0] * speed, chosen[1] * speed);
  if (e.retreating && !inside && e.phaseSec <= 0) {
    e.retreating = false;
    e.phaseSec = 1.2;
  }
  return true;
}
