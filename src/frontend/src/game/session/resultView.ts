import { CAMP_NOTE_TEXT } from "@/core";
import { BEACON_SEAL_IDS, countBeaconSeals } from "@/systems/world/beacon";
import type { ResultView } from "../ui/store";
import type { RunSession } from "./RunSession";
import { buildEternalResultView } from "./eternalResult";

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} 分 ${String(s).padStart(2, "0")} 秒`;
}

function causeText(session: RunSession): string {
  const { state, sys } = session;
  if (state.status === "won") return "";
  if (state.status === "storm_lost") {
    const minutes = Math.round(sys.data.balance.clock.runLimitSec / 60);
    return `${minutes} 分钟过去了，烽台仍未点燃，风暴吞没了余烬林。`;
  }
  const cause = session.lastCause;
  if (cause === "hunger") return "饥饿难耐，你倒在了雪地里。";
  if (cause === "darkness") return "火炬熄灭，你被黑暗吞没了。";
  if (cause === "projectile") return "被远处飞来的丝弹击倒了。";
  const enemy = cause ? sys.data.enemies.get(cause) : undefined;
  if (enemy) return `被${enemy.name}击倒了。`;
  return "你倒在了雪夜里。";
}

/** Chinese end-of-run summary for the result screen. */
export function buildResultView(session: RunSession): ResultView {
  const { state, sys } = session;
  if (session.eternal)
    return buildEternalResultView(session, causeText(session));
  const status = state.status === "playing" ? "dead" : state.status;
  const { title, epilogue } = sys.data.lore.endings[status];
  return {
    status,
    title,
    epilogue,
    cause: causeText(session),
    stats: [
      { label: "存活时间", value: formatDuration(state.elapsedSec) },
      { label: "到达天数", value: `第 ${state.day} 天` },
      { label: "营火等级", value: `Lv.${state.campLevel}` },
      {
        label: "炉印",
        value: `${countBeaconSeals(state)} / ${BEACON_SEAL_IDS.length}`,
      },
      { label: "本次击败", value: `${session.enemiesDefeated}` },
    ],
    notes: session.meta.notes.map((id) => CAMP_NOTE_TEXT[id]?.title ?? id),
  };
}
