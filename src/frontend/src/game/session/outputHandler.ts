import { CAMP_NOTE_TEXT, EVT } from "@/core";
import { uiStore } from "../ui/store";
import type { Scenery } from "../world/Scenery";
import type { RunSession, SessionOutput } from "./RunSession";
import { presentEvents } from "./eventFeedback";

export interface OutputHooks {
  openCraft(): void;
  ended(): void;
  hurt(): void;
}

/** Presents one batch of rule output: toasts, sounds, particles and scene reactions. */
export function handleOutput(
  out: SessionOutput,
  session: RunSession,
  scenery: Scenery,
  hooks: OutputHooks,
): void {
  const { events } = out;
  if (events.length === 0) return;
  presentEvents(events, session.sys);
  scenery.emit(events);
  for (const e of events) {
    if (e.type === EVT.openCraft) hooks.openCraft();
    else if (e.type === EVT.runEnded) hooks.ended();
    else if (e.type === EVT.hit && e.payload.kind === "hurt") hooks.hurt();
  }
  if (out.autosaved) uiStore.toast("已自动存档", "info");
  for (const id of out.unlockedNotes) {
    uiStore.toast(`营地笔记：${CAMP_NOTE_TEXT[id]?.title ?? id}`, "good");
  }
}
