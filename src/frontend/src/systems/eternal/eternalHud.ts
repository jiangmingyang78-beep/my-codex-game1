import type { RunState, Systems } from "@/core/types";
import { loadoutOptions, loadoutQuotas } from "./eternalLoadout";
import { getEternalRuntime } from "./eternalRuntime";
import { eternalHpMultiplier } from "./eternalSpawn";
import type { EternalHud } from "./eternalTypes";

export function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Read-only HUD/panel model of the eternal run; null for ordinary runs. */
export function buildEternalHud(
  state: RunState,
  sys: Systems,
): EternalHud | null {
  const rt = getEternalRuntime(state);
  if (!rt) return null;
  const prep = rt.phase === "prep";
  const prepLeft = Math.ceil(rt.prepRemainingSec);
  const bossIn = Math.max(0, rt.nextBossSec - rt.combatElapsedSec);
  const quotas = loadoutQuotas(state, sys);
  const tier = Math.floor(rt.combatElapsedSec / 60) + 1;
  const hpScale = eternalHpMultiplier(rt.combatElapsedSec);
  return {
    phase: rt.phase,
    prepRemainingSec: prepLeft,
    combatSec: rt.combatElapsedSec,
    kills: rt.kills,
    bossInSec: bossIn,
    bossWave: rt.bossWaveCount,
    loadoutMode: rt.loadoutMode,
    pendingPicks: rt.pendingPicks,
    clockText: `Eternal trial... survival ${formatClock(rt.combatElapsedSec)}  ·  Sniping ${rt.kills}`,
    threatText: prep
      ? "The black fog is gathering"
      : `Threat ${tier} The blood of the monster is ×${hpScale.toFixed(2)}`,
    objective: prep
      ? `Preparation phase: Self-selected equipment ${prepLeft}s`
      : `Hold on to the rest of the body... the chief's countdown ${formatClock(bossIn)}`,
    options: loadoutOptions(state, sys),
    weaponQuota: quotas.weapon,
    gearQuota: quotas.gear,
  };
}
