import {
  META_SCHEMA_VERSION,
  META_STORAGE_KEY,
  META_UNLOCK_DEFS,
  crossModeUnlocksFromMeta,
  matchesCondition,
  parseMetaDocument,
  supportsMetaDocument,
} from "@/shared/metaUnlocks.js";
import type { HeroUnlock } from "./dataTypes";
import { EVT } from "./events";
import { loadGameData } from "./gameData";
import { isRecord } from "./saveMigration";
import type { StorageLike } from "./storage";
import type { GameEvent, RunState } from "./types";

export { META_SCHEMA_VERSION };
const MAX_SETTLED = 20;
const CONSUMABLE_TYPES = new Set(["food", "medicine", "consumable"]);

export interface MetaState {
  schemaVersion: number;
  notes: string[];
  settledRunIds: string[];
  unlockedHeroes: string[];
  unlocks: string[];
  progress: {
    totalKills: number;
    totalConsumablesCrafted: number;
    defeatedBossIds: string[];
  };
  /** Eternal Mode best results (optional, absent in older documents). */
  eternalBestSec?: number;
  eternalBestKills?: number;
}

export function emptyMeta(): MetaState {
  return {
    schemaVersion: META_SCHEMA_VERSION,
    notes: [],
    settledRunIds: [],
    unlockedHeroes: [loadGameData().defaultHeroId],
    unlocks: [],
    progress: {
      totalKills: 0,
      totalConsumablesCrafted: 0,
      defeatedBossIds: [],
    },
  };
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === "string")),
  ];
}

function readTotal(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export function loadMeta(storage: StorageLike | null): MetaState {
  const data = loadGameData();
  const meta = emptyMeta();
  try {
    const v: unknown = parseMetaDocument(
      storage?.getItem(META_STORAGE_KEY) ?? null,
    );
    if (!isRecord(v) || !supportsMetaDocument(v)) return meta;
    meta.unlocks = readIds([
      ...readIds(v.unlocks),
      ...crossModeUnlocksFromMeta(v),
    ]);
    meta.notes = readIds(v.notes).filter((id) =>
      Object.hasOwn(data.lore.campNotes, id),
    );
    meta.settledRunIds = readIds(v.settledRunIds).slice(-MAX_SETTLED);
    for (const id of readIds(v.unlockedHeroes)) {
      if (data.heroes.has(id) && !meta.unlockedHeroes.includes(id))
        meta.unlockedHeroes.push(id);
    }
    if (isRecord(v.progress)) {
      meta.progress = {
        totalKills: readTotal(v.progress.totalKills),
        totalConsumablesCrafted: readTotal(v.progress.totalConsumablesCrafted),
        defeatedBossIds: readIds(v.progress.defeatedBossIds).filter((id) =>
          data.enemies.has(id),
        ),
      };
    }
    unlockEligibleHeroes(meta);
    if (typeof v.eternalBestSec === "number")
      meta.eternalBestSec = readTotal(v.eternalBestSec);
    if (typeof v.eternalBestKills === "number")
      meta.eternalBestKills = readTotal(v.eternalBestKills);
  } catch {
    return emptyMeta();
  }
  return meta;
}

export function saveMeta(
  storage: StorageLike | null,
  meta: MetaState,
): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(META_STORAGE_KEY);
    let previous: ReturnType<typeof parseMetaDocument> = null;
    try {
      previous = parseMetaDocument(raw);
    } catch {
      // A valid new snapshot replaces malformed local metadata.
    }
    if (previous && !supportsMetaDocument(previous)) return false;
    const unlocks = readIds([...readIds(previous?.unlocks), ...meta.unlocks]);
    storage.setItem(
      META_STORAGE_KEY,
      JSON.stringify({ ...previous, ...meta, unlocks }),
    );
    meta.unlocks = unlocks;
    return true;
  } catch {
    return false;
  }
}

export function isHeroUnlocked(meta: MetaState, heroId: string): boolean {
  return (
    loadGameData().heroes.has(heroId) && meta.unlockedHeroes.includes(heroId)
  );
}

function meetsUnlock(meta: MetaState, unlock: HeroUnlock): boolean {
  switch (unlock.type) {
    case "default":
      return true;
    case "boss_defeated":
      return meta.progress.defeatedBossIds.includes(unlock.enemyId);
    case "consumables_crafted":
      return meta.progress.totalConsumablesCrafted >= unlock.count;
    case "kills":
      return meta.progress.totalKills >= unlock.count;
    case "camp_notes":
      return meta.notes.length >= unlock.count;
  }
}

function unlockEligibleHeroes(meta: MetaState): string[] {
  const unlocked: string[] = [];
  for (const hero of loadGameData().heroes.values()) {
    if (isHeroUnlocked(meta, hero.id) || !meetsUnlock(meta, hero.unlock))
      continue;
    meta.unlockedHeroes.push(hero.id);
    unlocked.push(hero.id);
  }
  return unlocked;
}

const TRIGGERS: Record<string, (events: readonly GameEvent[]) => boolean> = {
  first_seal_collected: (events) =>
    events.some((e) => e.type === EVT.sealCollected),
  ember_dust_collected: (events) =>
    events.some(
      (e) => e.type === EVT.itemPicked && e.payload.itemId === "ember_dust",
    ),
  run_won: (events) =>
    events.some((e) => e.type === EVT.runEnded && e.payload.status === "won"),
};

export function applyRunEventsToMeta(
  meta: MetaState,
  run: RunState,
  events: readonly GameEvent[],
): {
  unlockedNotes: string[];
  unlockedHeroes: string[];
  unlockedCrossMode: string[];
  changed: boolean;
} {
  const unlockedNotes: string[] = [];
  const unlockedCrossMode: string[] = [];
  const ended = events.some((e) => e.type === EVT.runEnded);
  if (meta.settledRunIds.includes(run.runId))
    return {
      unlockedNotes,
      unlockedHeroes: [],
      unlockedCrossMode,
      changed: false,
    };

  const data = loadGameData();
  let changed = ended;
  for (const e of events) {
    if (e.type === EVT.enemyDefeated) {
      meta.progress.totalKills++;
      const id = e.payload.enemyId;
      if (
        typeof id === "string" &&
        (id === "beacon_keeper" ||
          data.enemies.get(id)?.seedType === "warden_phase") &&
        !meta.progress.defeatedBossIds.includes(id)
      ) {
        meta.progress.defeatedBossIds.push(id);
      }
      changed = true;
    } else if (
      e.type === EVT.craftDone &&
      typeof e.payload.recipeId === "string"
    ) {
      const output = data.recipes.get(e.payload.recipeId)?.output;
      const item =
        output?.type === "item" ? data.items.get(output.id) : undefined;
      if (item && CONSUMABLE_TYPES.has(item.type)) {
        meta.progress.totalConsumablesCrafted++;
        changed = true;
      }
    }
  }

  for (const note of data.balance.meta.notes) {
    if (meta.notes.includes(note.id) || !TRIGGERS[note.trigger]?.(events))
      continue;
    meta.notes.push(note.id);
    unlockedNotes.push(note.id);
  }
  if (ended) {
    meta.settledRunIds.push(run.runId);
    if (meta.settledRunIds.length > MAX_SETTLED) meta.settledRunIds.shift();
  }
  const unlockedHeroes = unlockEligibleHeroes(meta);
  for (const rule of META_UNLOCK_DEFS) {
    if (
      rule.sourceMode !== "adventure" ||
      meta.unlocks.includes(rule.id) ||
      !matchesCondition(rule.condition, events)
    )
      continue;
    meta.unlocks.push(rule.id);
    unlockedCrossMode.push(rule.id);
  }
  return {
    unlockedNotes,
    unlockedHeroes,
    unlockedCrossMode,
    changed:
      changed ||
      unlockedNotes.length > 0 ||
      unlockedHeroes.length > 0 ||
      unlockedCrossMode.length > 0,
  };
}
