import { CAMP_NOTE_TEXT } from "@/core";
import { BEACON_SEAL_IDS, countBeaconSeals } from "@/systems/world/beacon";
import type { ResultView } from "../ui/store";
import type { RunSession } from "./RunSession";
import { buildEternalResultView } from "./eternalResult";

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} m ${String(s).padStart(2, "0")} s`;
}

function causeText(session: RunSession): string {
  const { state, sys } = session;
  if (state.status === "won") return "";
  if (state.status === "storm_lost") {
    const minutes = Math.round(sys.data.balance.clock.runLimitSec / 60);
    return `${minutes} minutes passed without lighting the beacon. The storm swallowed Emberwood.`;
  }
  const cause = session.lastCause;
  if (cause === "hunger")
    return "Hunger overcame you, and you collapsed in the snow.";
  if (cause === "darkness")
    return "Your torch went out and the darkness swallowed you.";
  if (cause === "projectile")
    return "A silk projectile knocked you down from afar.";
  const enemy = cause ? sys.data.enemies.get(cause) : undefined;
  if (enemy) return `You were defeated by ${enemy.name}.`;
  return "You fell in the snow.";
}

/** End-of-run summary for the result screen. */
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
      { label: "Time survived", value: formatDuration(state.elapsedSec) },
      { label: "Days reached", value: `Day ${state.day}` },
      { label: "Campfire level", value: `Lv.${state.campLevel}` },
      {
        label: "Ember Seals",
        value: `${countBeaconSeals(state)} / ${BEACON_SEAL_IDS.length}`,
      },
      { label: "Enemies defeated", value: `${session.enemiesDefeated}` },
    ],
    notes: session.meta.notes.map((id) => CAMP_NOTE_TEXT[id]?.title ?? id),
  };
}
