import { loadGameData } from "./gameData";
import type { StorageLike } from "./storage";
import type { GameEvent, RunState } from "./types";

export const META_SCHEMA_VERSION = 1;
const MAX_SETTLED = 20;

/** Out-of-run progress stored separately from the run save. */
export interface MetaState {
  schemaVersion: number;
  notes: string[];
  settledRunIds: string[];
}

export function emptyMeta(): MetaState {
  return { schemaVersion: META_SCHEMA_VERSION, notes: [], settledRunIds: [] };
}

export function loadMeta(storage: StorageLike | null): MetaState {
  if (!storage) return emptyMeta();
  try {
    const raw = storage.getItem(loadGameData().balance.storage.metaKey);
    if (raw === null) return emptyMeta();
    const v = JSON.parse(raw) as Partial<MetaState>;
    if (v.schemaVersion !== META_SCHEMA_VERSION || !Array.isArray(v.notes))
      return emptyMeta();
    const known = new Set(loadGameData().balance.meta.notes.map((n) => n.id));
    return {
      schemaVersion: META_SCHEMA_VERSION,
      notes: v.notes.filter(
        (n): n is string => typeof n === "string" && known.has(n),
      ),
      settledRunIds: Array.isArray(v.settledRunIds)
        ? v.settledRunIds.filter((n): n is string => typeof n === "string")
        : [],
    };
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(
  storage: StorageLike | null,
  meta: MetaState,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      loadGameData().balance.storage.metaKey,
      JSON.stringify(meta),
    );
    return true;
  } catch {
    return false;
  }
}

const TRIGGERS: Record<string, (events: readonly GameEvent[]) => boolean> = {
  first_seal_collected: (events) =>
    events.some((e) => e.type === "seal.collected"),
  run_won: (events) =>
    events.some((e) => e.type === "run.ended" && e.payload.status === "won"),
};

/**
 * Applies run events to the meta state and returns the newly unlocked note ids.
 * Notes unlock at most once; a run.ended event is settled once per runId (idempotent on reload).
 */
export function applyRunEventsToMeta(
  meta: MetaState,
  run: RunState,
  events: readonly GameEvent[],
): string[] {
  const unlocked: string[] = [];
  const ended = events.some((e) => e.type === "run.ended");
  const effective =
    ended && meta.settledRunIds.includes(run.runId)
      ? events.filter((e) => e.type !== "run.ended")
      : events;
  for (const note of loadGameData().balance.meta.notes) {
    if (meta.notes.includes(note.id) || !TRIGGERS[note.trigger]?.(effective))
      continue;
    meta.notes.push(note.id);
    unlocked.push(note.id);
  }
  if (ended && !meta.settledRunIds.includes(run.runId)) {
    meta.settledRunIds.push(run.runId);
    if (meta.settledRunIds.length > MAX_SETTLED) meta.settledRunIds.shift();
  }
  return unlocked;
}
