import { SnapshotError, isRecord } from "./saveMigration";

export type Rec = Record<string, unknown>;

export function num(
  v: unknown,
  field: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new SnapshotError(`invalid_${field}`);
  return v;
}
export function int(
  v: unknown,
  field: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const n = num(v, field, min, max);
  if (!Number.isInteger(n)) throw new SnapshotError(`invalid_${field}`);
  return n;
}
export function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0)
    throw new SnapshotError(`invalid_${field}`);
  return v;
}
export function rec(v: unknown, field: string): Rec {
  if (!isRecord(v)) throw new SnapshotError(`invalid_${field}`);
  return v;
}
