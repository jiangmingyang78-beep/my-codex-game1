export const ENEMY_RADIUS = 6;

/** Angle in degrees between a direction vector (dirX, dirY) and the vector (tx, ty). */
export function angleBetweenDeg(
  dirX: number,
  dirY: number,
  tx: number,
  ty: number,
): number {
  const dl = Math.hypot(dirX, dirY);
  const tl = Math.hypot(tx, ty);
  if (dl === 0 || tl === 0) return 0;
  const cos = (dirX * tx + dirY * ty) / (dl * tl);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** True when target (tx, ty) lies inside a cone from (ox, oy) facing (dirX, dirY). */
export function inCone(
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  tx: number,
  ty: number,
  rangePx: number,
  arcDegrees: number,
  targetRadius: number,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > rangePx + targetRadius) return false;
  if (dist <= targetRadius) return true;
  return angleBetweenDeg(dirX, dirY, dx, dy) <= arcDegrees / 2;
}

/** Safe unit vector normalization; returns fallback direction on zero-length inputs. */
export function safeUnit(
  dx: number,
  dy: number,
  fallbackX = 1,
  fallbackY = 0,
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  return len > 1e-6
    ? { x: dx / len, y: dy / len }
    : { x: fallbackX, y: fallbackY };
}

/** Clamped [0, 1] ratio that safely returns 0 when max <= 0. */
export function ratio01(value: number, max: number): number {
  return max > 1e-6 ? Math.max(0, Math.min(1, value / max)) : 0;
}
