import { loadGameData } from "./gameData";
import {
  RUN_SCHEMA_VERSION,
  SnapshotError,
  isRecord,
  readRunVersion,
} from "./saveMigration";
import { sanitizeRunState } from "./snapshot";
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
  reason?:
    | "storage_unavailable"
    | "storage_error"
    | "run_ended"
    | "future_version";
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

function unwrap(raw: string): Record<string, unknown> {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new SnapshotError("corrupt_json");
  }
  if (!isRecord(envelope)) throw new SnapshotError("corrupt_json");
  const envelopeVersion = readRunVersion(envelope.schemaVersion);
  if (!Object.hasOwn(envelope, "state")) return envelope;
  const state = envelope.state;
  if (!isRecord(state)) throw new SnapshotError("invalid_root");
  const version = readRunVersion(state.schemaVersion ?? envelope.schemaVersion);
  if (envelope.schemaVersion !== undefined && envelopeVersion !== version)
    throw new SnapshotError("version_mismatch");
  return { ...state, schemaVersion: version };
}

function futureSave(error: unknown): boolean {
  return error instanceof SnapshotError && error.reason === "future_version";
}

function isFutureSlot(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    unwrap(raw);
    return false;
  } catch (error) {
    return futureSave(error);
  }
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
      const snapshot = sanitizeRunState(unwrap(raw), systems);
      return {
        status: fromBackup ? "recovered_backup" : "ok",
        snapshot,
        notice: fromBackup ? "存档已损坏，已恢复到上一次成功的备份。" : null,
      };
    } catch (error) {
      if (futureSave(error)) {
        return {
          status: "fallback_new",
          snapshot: null,
          notice: "此存档来自更新的游戏版本，已保留原档。",
        };
      }
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
    if (isFutureSlot(previous)) return { ok: false, reason: "future_version" };
    if (previous !== null && !isFutureSlot(storage.getItem(backup))) {
      let valid = false;
      try {
        sanitizeRunState(unwrap(previous), systems);
        valid = true;
      } catch {
        // Keep the older backup when the current primary is already unreadable.
      }
      if (valid) storage.setItem(backup, previous);
    }
    const envelope: Envelope = {
      schemaVersion: RUN_SCHEMA_VERSION,
      savedAt: Date.now(),
      state,
    };
    storage.setItem(
      run,
      JSON.stringify(envelope, (_key, value) =>
        value instanceof Set ? [...value] : value,
      ),
    );
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
    const protectedRun = isFutureSlot(storage.getItem(run));
    const protectedBackup = isFutureSlot(storage.getItem(backup));
    if (!protectedRun) storage.removeItem(run);
    if (!protectedBackup) storage.removeItem(backup);
    return !protectedRun && !protectedBackup;
  } catch {
    return false;
  }
}

/** Survival worlds have independent slots. Both directions use the same JSON-safe representation. */
export function encounterProgressForSave(
  value: unknown,
): import("../systems/survival/landmarks").EncounterProgress {
  const data = isRecord(value) ? value : {};
  const ids = (list: unknown): string[] =>
    Array.isArray(list)
      ? [
          ...new Set(
            list.filter(
              (v): v is string =>
                typeof v === "string" &&
                /^[a-z][a-z0-9_]*@-?\d+,-?\d+$/.test(v),
            ),
          ),
        ]
      : [];
  const discovered = ids(data.discovered);
  return {
    discovered,
    spent: ids(data.spent).filter((id) => discovered.includes(id)),
  };
}
