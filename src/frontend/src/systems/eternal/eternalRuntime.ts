import type { RunState } from "@/core/types";
import { ETERNAL, type EternalRunRuntime } from "./eternalTypes";

/** Runtime registry: a RunState without an entry is an ordinary adventure run. */
const runtimes = new WeakMap<RunState, EternalRunRuntime>();

export function createEternalRuntime(state: RunState): EternalRunRuntime {
  const runtime: EternalRunRuntime = {
    phase: "prep",
    prepRemainingSec: ETERNAL.prepSec,
    loadoutMode: "standard",
    combatElapsedSec: 0,
    kills: 0,
    credits: 2,
    spawnTimerSec: 1.5,
    nextBossSec: ETERNAL.firstBossSec,
    bossWaveCount: 0,
    nextSupplySec: ETERNAL.supplyIntervalSec,
    pendingPicks: 0,
  };
  runtimes.set(state, runtime);
  return runtime;
}

export function getEternalRuntime(state: RunState): EternalRunRuntime | null {
  return runtimes.get(state) ?? null;
}

export function isEternalRun(state: RunState): boolean {
  return runtimes.has(state);
}
