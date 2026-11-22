import { loadGameData } from "./gameData";
import {
  RUN_SCHEMA_VERSION,
  SnapshotError,
  sanitizeRunState,
} from "./snapshot";
import type { StorageLike } from "./storage";
import { getSystems } from "./systems";
import type { RunState, Systems } from "./types";

export type LoadStatus =
  | "empty"
  | "ok"
  | "recovered_backup"
  | "fallback_new"
  | "unavailable";

export interface LoadResult {
  status: LoadStatus;
  /** Validated state to continue from; null means start a new game. */
  snapshot: RunState | null;
  /** Chinese notice for the player when something went wrong; null otherwise. */
  notice: string | null;
}

export interface SaveResult {
  ok: boolean;
  reason?: "storage_unavailable" | "storage_error" | "run_ended";
}

interface Envelope {
  schemaVersion: number;
  savedAt: number;
  state: RunState;
}

function keys() {
  const { storage } = loadGameData().balance;
  return { run: storage.runKey, backup: storage.runBackupKey };
}

function parse(raw: string, sys: Systems): RunState {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new SnapshotError("corrupt_json");
  }
  if (typeof envelope !== "object" || envelope === null)
    throw new SnapshotError("corrupt_json");
  const e = envelope as Partial<Envelope>;
  if (e.schemaVersion !== RUN_SCHEMA_VERSION)
    throw new SnapshotError("version_mismatch");
  return sanitizeRunState(e.state, sys);
}

/**
 * Reads the run save. Tries the primary key, then the last-good backup. Corrupt or
 * version-mismatched data (both slots) falls back to a new game with a notice.
 */
export function loadRun(
  storage: StorageLike | null,
  systems: Systems = getSystems(),
): LoadResult {
  if (!storage) {
    return {
      status: "unavailable",
      snapshot: null,
      notice: "无法访问本地存储，进度不会被保存。",
    };
  }
  const { run, backup } = keys();
  let rawPrimary: string | null;
  let rawBackup: string | null;
  try {
    rawPrimary = storage.getItem(run);
    rawBackup = storage.getItem(backup);
  } catch {
    return {
      status: "unavailable",
      snapshot: null,
      notice: "无法读取本地存储，进度不会被保存。",
    };
  }
  if (rawPrimary === null && rawBackup === null)
    return { status: "empty", snapshot: null, notice: null };
  let reason = "corrupt_json";
  for (const [raw, fromBackup] of [
    [rawPrimary, false],
    [rawBackup, true],
  ] as const) {
    if (raw === null) continue;
    try {
      const snapshot = parse(raw, systems);
      return {
        status: fromBackup ? "recovered_backup" : "ok",
        snapshot,
        notice: fromBackup ? "存档已损坏，已恢复到上一次成功的备份。" : null,
      };
    } catch (error) {
      if (!fromBackup && error instanceof SnapshotError) reason = error.reason;
    }
  }
  const notice =
    reason === "version_mismatch"
      ? "存档版本不兼容，已为你开始新的一局。"
      : "存档已损坏，已为你开始新的一局。";
  return { status: "fallback_new", snapshot: null, notice };
}

/**
 * Writes the run state. The previous valid primary slot is copied to the backup slot first,
 * so a failed or interrupted write never destroys the last good save.
 */
export function saveRun(
  storage: StorageLike | null,
  state: RunState,
  systems: Systems = getSystems(),
): SaveResult {
  if (!storage) return { ok: false, reason: "storage_unavailable" };
  const { run, backup } = keys();
  try {
    const previous = storage.getItem(run);
    if (previous !== null) {
      try {
        parse(previous, systems);
        storage.setItem(backup, previous);
      } catch {
        // Keep the older backup when the current primary is already unreadable.
      }
    }
    const envelope: Envelope = {
      schemaVersion: RUN_SCHEMA_VERSION,
      savedAt: Date.now(),
      state,
    };
    storage.setItem(run, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage_error" };
  }
}

/** Deletes both run slots (new game / after run end). Meta notes are untouched. */
export function clearRun(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    const { run, backup } = keys();
    storage.removeItem(run);
    storage.removeItem(backup);
    return true;
  } catch {
    return false;
  }
}
