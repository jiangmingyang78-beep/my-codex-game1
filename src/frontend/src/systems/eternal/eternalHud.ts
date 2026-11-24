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
    clockText: `永恒试炼 · 存活 ${formatClock(rt.combatElapsedSec)} · 击杀 ${rt.kills}`,
    threatText: prep
      ? "黑雾正在聚拢"
      : `威胁 ${tier} 阶 · 怪物血量 ×${hpScale.toFixed(2)}`,
    objective: prep
      ? `准备阶段：自选装备 ${prepLeft}s`
      : `坚守余烬 · 首领倒计时 ${formatClock(bossIn)}`,
    options: loadoutOptions(state, sys),
    weaponQuota: quotas.weapon,
    gearQuota: quotas.gear,
  };
}
