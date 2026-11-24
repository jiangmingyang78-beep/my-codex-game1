import { getEternalRuntime } from "@/systems/eternal/eternalRuntime";
import type { ResultView } from "../ui/store";
import type { RunSession } from "./RunSession";

function duration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  return `${Math.floor(total / 60)} 分 ${String(total % 60).padStart(2, "0")} 秒`;
}

/** 永恒试炼 end-of-run summary: survival time, kills and the personal best. */
export function buildEternalResultView(
  session: RunSession,
  cause: string,
): ResultView {
  const rt = getEternalRuntime(session.state);
  const record = session.eternalRecord;
  return {
    status: "dead",
    mode: "eternal",
    title: "永恒试炼结束",
    cause,
    epilogue: "黑雾吞没了最后一簇孤火，但你坚守的每一秒都被雪松记下。",
    stats: [
      { label: "存活时长", value: duration(rt?.combatElapsedSec ?? 0) },
      { label: "总击杀数", value: `${rt?.kills ?? 0}` },
      { label: "首领降临", value: `${rt?.bossWaveCount ?? 0} 次` },
      { label: "最佳存活", value: duration(record?.bestSec ?? 0) },
      { label: "最高击杀", value: `${record?.bestKills ?? 0}` },
    ],
    notes: [],
    eternal: { newRecord: record?.newRecord ?? false },
  };
}
