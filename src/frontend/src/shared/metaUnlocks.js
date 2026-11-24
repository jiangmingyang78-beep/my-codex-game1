import balance from "../data/balance.json";
import unlockDefs from "../data/metaUnlocks.json";

export const META_SCHEMA_VERSION = 1;
export const META_STORAGE_KEY = balance.storage.metaKey;
export const META_UNLOCK_DEFS = unlockDefs;

const definitions = new Map(META_UNLOCK_DEFS.map((def) => [def.id, def]));

export function getUnlockDef(id) {
  return definitions.get(id);
}

export function matchesCondition(condition, events) {
  if (condition.anyOf)
    return condition.anyOf.some((part) => matchesCondition(part, events));

  const { event, ...payload } = condition;
  return events.some(
    (entry) =>
      entry.type === event &&
      Object.entries(payload).every(
        ([key, value]) => entry.payload?.[key] === value,
      ),
  );
}

/** @param {string | null} raw @returns {Record<string, unknown> | null} */
export function parseMetaDocument(raw) {
  const meta = raw === null ? null : JSON.parse(raw);
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
}

export function supportsMetaDocument(meta) {
  return (
    meta != null &&
    (meta.schemaVersion === META_SCHEMA_VERSION ||
      meta.schemaVersion === undefined)
  );
}

export function crossModeUnlocksFromMeta(meta) {
  const result = new Set(
    Array.isArray(meta?.unlocks)
      ? meta.unlocks.filter((id) => definitions.has(id))
      : [],
  );
  const notes = Array.isArray(meta?.notes) ? meta.notes : [];
  if (notes.includes("first_ember_seal") || notes.includes("beacon_restored"))
    result.add("unlock_ember_brazier");
  if (notes.includes("beacon_restored")) result.add("unlock_summit_beacon");
  if (
    Array.isArray(meta?.progress?.defeatedBossIds) &&
    meta.progress.defeatedBossIds.includes("mill_overseer")
  )
    result.add("unlock_warden_blade");
  return result;
}

/** @param {import("../core/storage").StorageLike | null} [storage] */
export function readCrossModeUnlocks(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    const meta = parseMetaDocument(target?.getItem(META_STORAGE_KEY) ?? null);
    if (supportsMetaDocument(meta)) return crossModeUnlocksFromMeta(meta);
  } catch {
    // Missing, unavailable or malformed local storage starts with locked rewards.
  }
  return new Set();
}

/**
 * Adds one receipt to the current document while preserving other modes' progress.
 * @param {string} id
 * @param {import("../core/storage").StorageLike | null} [storage]
 */
export function grantCrossModeUnlock(id, storage) {
  if (!definitions.has(id)) return false;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    const meta = parseMetaDocument(target.getItem(META_STORAGE_KEY));
    if (meta && !supportsMetaDocument(meta)) return false;
    const unlocks = new Set(Array.isArray(meta?.unlocks) ? meta.unlocks : []);
    if (unlocks.has(id)) return true;
    unlocks.add(id);
    target.setItem(
      META_STORAGE_KEY,
      JSON.stringify({
        ...meta,
        schemaVersion: META_SCHEMA_VERSION,
        unlocks: [...unlocks],
      }),
    );
    return true;
  } catch {
    return false;
  }
}
