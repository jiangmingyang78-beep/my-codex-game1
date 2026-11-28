import { getEternalRuntime } from "@/systems/eternal/eternalRuntime";
import type { ResultView } from "../ui/store";
import type { RunSession } from "./RunSession";

function duration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  return `${Math.floor(total / 60)} m ${String(total % 60).padStart(2, "0")} s`;
}

/** Summarizes survival time, kills, and records for an Eternal run. */
export function buildEternalResultView(
  session: RunSession,
  cause: string,
): ResultView {
  const rt = getEternalRuntime(session.state);
  const record = session.eternalRecord;
  return {
    status: "dead",
    mode: "eternal",
    title: "The Eternal Trial Ends",
    cause,
    epilogue:
      "Fog swallowed the last lonely fire. The pines remember every second you held your ground.",
    stats: [
      { label: "Time survived", value: duration(rt?.combatElapsedSec ?? 0) },
      { label: "Enemies defeated", value: `${rt?.kills ?? 0}` },
      {
        label: "Boss waves",
        value: `${rt?.bossWaveCount ?? 0} times`,
      },
      { label: "Best survival", value: duration(record?.bestSec ?? 0) },
      { label: "Most kills", value: `${record?.bestKills ?? 0}` },
    ],
    notes: [],
    eternal: { newRecord: record?.newRecord ?? false },
  };
}
