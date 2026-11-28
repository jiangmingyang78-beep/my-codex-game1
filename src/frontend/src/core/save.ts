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
  /** Player notice when something went wrong, or null otherwise. */
  notice: string | null;
}

type StorageFailure = "storage_unavailable" | "storage_error";

export interface SaveResult {
  ok: boolean;
  reason?: StorageFailure | "run_ended" | "future_version" | "stale_tab";
}

type ReadFailure =
  | StorageFailure
  | "empty"
  | "invalid_save"
  | "version_mismatch"
  | "future_version";

export type ExportResult = string | { ok: false; reason: ReadFailure };
export type ImportResult = SaveResult | { ok: false; reason: string };

const MAX_IMPORT_BYTES = 512 * 1024;

function keys() {
  const { storage } = loadGameData().balance;
  return { run: storage.runKey, backup: storage.runBackupKey };
}

type ParseEnvelope =
  | { ok: true; state: Record<string, unknown>; savedAt?: number }
  | { ok: false; reason: string };

function parseEnvelope(raw: string): ParseEnvelope {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt_json" };
  }
  if (!isRecord(envelope)) return { ok: false, reason: "invalid_root" };
  const savedAt =
    typeof envelope.savedAt === "number" && Number.isFinite(envelope.savedAt)
      ? envelope.savedAt
      : undefined;
  try {
    const envelopeVersion = readRunVersion(envelope.schemaVersion);
    if (!Object.hasOwn(envelope, "state"))
      return { ok: true, state: envelope, savedAt };
    if (!isRecord(envelope.state)) return { ok: false, reason: "invalid_root" };
    const version = readRunVersion(
      envelope.state.schemaVersion ?? envelope.schemaVersion,
    );
    if (envelope.schemaVersion !== undefined && envelopeVersion !== version)
      return { ok: false, reason: "version_mismatch" };
    return {
      ok: true,
      state: { ...envelope.state, schemaVersion: version },
      savedAt,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof SnapshotError ? error.reason : "invalid_root",
    };
  }
}

function parseSnapshot(
  state: unknown,
  systems: Systems,
): { ok: true; snapshot: RunState } | { ok: false; reason: string } {
  try {
    return { ok: true, snapshot: sanitizeRunState(state, systems) };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof SnapshotError ? error.reason : "invalid_snapshot",
    };
  }
}

function isFutureSlot(raw: string | null): boolean {
  if (raw === null) return false;
  const parsed = parseEnvelope(raw);
  return !parsed.ok && parsed.reason === "future_version";
}

function encodeRun(state: RunState, savedAt: number): string {
  return JSON.stringify(
    { schemaVersion: RUN_SCHEMA_VERSION, savedAt, state },
    (_key, value) => (value instanceof Set ? [...value] : value),
  );
}

function readSlots(
  storage: StorageLike | null,
  systems: Systems,
): ReadFailure | { snapshot: RunState; savedAt: number; fromBackup: boolean } {
  if (!storage) return "storage_unavailable";
  const { run, backup } = keys();
  let rawPrimary: string | null;
  let rawBackup: string | null;
  try {
    rawPrimary = storage.getItem(run);
    rawBackup = storage.getItem(backup);
  } catch {
    return "storage_error";
  }
  if (rawPrimary === null && rawBackup === null) return "empty";
  let reason = "invalid_save";
  for (const [raw, fromBackup] of [
    [rawPrimary, false],
    [rawBackup, true],
  ] as const) {
    if (raw === null) continue;
    const envelope = parseEnvelope(raw);
    if (!envelope.ok) {
      if (envelope.reason === "future_version") return "future_version";
      if (!fromBackup) reason = envelope.reason;
      continue;
    }
    const parsed = parseSnapshot(envelope.state, systems);
    if (parsed.ok) {
      return {
        snapshot: parsed.snapshot,
        savedAt: envelope.savedAt ?? 0,
        fromBackup,
      };
    }
    if (parsed.reason === "future_version") return "future_version";
    if (!fromBackup) reason = parsed.reason;
  }
  return reason === "version_mismatch" ? reason : "invalid_save";
}

/** Reads the run save, falling back to the last working backup. */
export function loadRun(
  storage: StorageLike | null,
  systems: Systems = getSystems(),
): LoadResult {
  const result = readSlots(storage, systems);
  if (typeof result !== "string") {
    return {
      status: result.fromBackup ? "recovered_backup" : "ok",
      snapshot: result.snapshot,
      notice: result.fromBackup
        ? "The save was damaged. The last working backup was restored."
        : null,
    };
  }
  if (result === "empty")
    return { status: "empty", snapshot: null, notice: null };
  if (result === "storage_unavailable" || result === "storage_error") {
    return {
      status: "unavailable",
      snapshot: null,
      notice:
        result === "storage_unavailable"
          ? "Local storage is unavailable. Your progress will not be saved."
          : "Could not read local storage. Your progress will not be saved.",
    };
  }
  const notice =
    result === "future_version"
      ? "This save is from a newer version of the game. The original save was kept."
      : result === "version_mismatch"
        ? "The save version is incompatible. A new run has started."
        : "The save is damaged. A new run has started.";
  return { status: "fallback_new", snapshot: null, notice };
}

/** Exports the validated slot with its original timestamp, or 0 for an undated save. */
export function exportRunSave(
  storage: StorageLike | null,
  systems: Systems = getSystems(),
): ExportResult {
  const result = readSlots(storage, systems);
  return typeof result === "string"
    ? { ok: false, reason: result }
    : encodeRun(result.snapshot, result.savedAt);
}

/** Validates a portable save before touching storage. */
export function importRunSave(
  storage: StorageLike | null,
  rawJson: string,
  systems: Systems = getSystems(),
): ImportResult {
  if (
    rawJson.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(rawJson).length > MAX_IMPORT_BYTES
  )
    return { ok: false, reason: "too_large" };

  const envelope = parseEnvelope(rawJson);
  if (!envelope.ok) return envelope;
  const parsed = parseSnapshot(envelope.state, systems);
  if (!parsed.ok) return parsed;
  return saveRun(storage, parsed.snapshot, systems);
}

/**
 * Backs up the last valid primary before replacing it. Pass the last observed
 * timestamp to reject a newer primary written by another tab.
 */
export function saveRun(
  storage: StorageLike | null,
  state: RunState,
  systems: Systems = getSystems(),
  expectedSavedAt?: number,
): SaveResult {
  if (!storage) return { ok: false, reason: "storage_unavailable" };
  const { run, backup } = keys();
  try {
    const previous = storage.getItem(run);
    const current = previous !== null ? parseEnvelope(previous) : null;
    if (current && !current.ok && current.reason === "future_version")
      return { ok: false, reason: "future_version" };

    const lastSavedAt = current?.ok ? current.savedAt : undefined;
    if (
      expectedSavedAt !== undefined &&
      lastSavedAt !== undefined &&
      lastSavedAt > expectedSavedAt
    )
      return { ok: false, reason: "stale_tab" };

    const encoded = encodeRun(
      state,
      Math.max(Date.now(), (lastSavedAt ?? -1) + 1),
    );
    if (
      previous !== null &&
      current?.ok &&
      !isFutureSlot(storage.getItem(backup)) &&
      parseSnapshot(current.state, systems).ok
    ) {
      storage.setItem(backup, previous);
    }
    storage.setItem(run, encoded);
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
