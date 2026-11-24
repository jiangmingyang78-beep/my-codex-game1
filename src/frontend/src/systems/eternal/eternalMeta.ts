import type { MetaState } from "@/core/meta";

export interface EternalRecord {
  /** Survived seconds / kills of this run and the best values after this run. */
  sec: number;
  kills: number;
  bestSec: number;
  bestKills: number;
  newRecord: boolean;
}

/** Writes the best eternal results into the shared meta document; returns whether it changed. */
export function recordEternalBest(
  meta: MetaState,
  survivedSec: number,
  kills: number,
): { record: EternalRecord; changed: boolean } {
  const sec = Math.floor(survivedSec);
  const prevSec = meta.eternalBestSec ?? 0;
  const prevKills = meta.eternalBestKills ?? 0;
  const first =
    meta.eternalBestSec === undefined && meta.eternalBestKills === undefined;
  const newRecord = first || sec > prevSec || kills > prevKills;
  meta.eternalBestSec = Math.max(prevSec, sec);
  meta.eternalBestKills = Math.max(prevKills, kills);
  return {
    record: {
      sec,
      kills,
      bestSec: meta.eternalBestSec,
      bestKills: meta.eternalBestKills,
      newRecord,
    },
    changed: newRecord,
  };
}
