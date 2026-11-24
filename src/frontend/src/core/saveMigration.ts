export const RUN_SCHEMA_VERSION = 3;

export class SnapshotError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

type SnapshotRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is SnapshotRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRunVersion(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new SnapshotError("version_mismatch");
  if (value > RUN_SCHEMA_VERSION) throw new SnapshotError("future_version");
  return value;
}

function migrateV1(raw: SnapshotRecord): SnapshotRecord {
  const collected = Array.isArray(raw.collectedPickups)
    ? [...raw.collectedPickups]
    : [];
  if (isRecord(raw.changesByObjectId)) {
    for (const [id, change] of Object.entries(raw.changesByObjectId)) {
      if (isRecord(change) && change.loot === "picked") collected.push(id);
    }
  }
  return {
    ...raw,
    schemaVersion: 2,
    collectedPickups: collected,
  };
}

function migrateV2(raw: SnapshotRecord): SnapshotRecord {
  return { ...raw, schemaVersion: 3, heroId: "lin_tinder" };
}

const migrations: Partial<
  Record<number, (raw: SnapshotRecord) => SnapshotRecord>
> = {
  1: migrateV1,
  2: migrateV2,
};

/** Upgrade the persisted shape before validating it against current gameplay data. */
export function migrateRunSnapshot(raw: SnapshotRecord): SnapshotRecord {
  let snapshot = raw;
  for (
    let version = readRunVersion(raw.schemaVersion);
    version < RUN_SCHEMA_VERSION;
    version++
  ) {
    const migrate = migrations[version];
    if (!migrate) throw new SnapshotError("version_mismatch");
    snapshot = migrate(snapshot);
  }
  return snapshot;
}
