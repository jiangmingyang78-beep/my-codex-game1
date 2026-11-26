import { CAMP_NOTE_TEXT, EVT, getHero } from "@/core";
import { getUnlockDef } from "@/shared/metaUnlocks.js";
import { toast } from "../ui/toastBridge";
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
  if (out.autosaved) toast.info("已自动存档", "sys:autosave");
  for (const id of out.unlockedNotes) {
    toast.gain(`营地笔记：${CAMP_NOTE_TEXT[id]?.title ?? id}`, `note:${id}`);
  }
  for (const id of out.unlockedHeroes) {
    const hero = getHero(session.sys.data, id);
    toast.gain(`英雄解锁：${hero.name} · ${hero.epithet}`, `hero:${id}`);
  }
  for (const id of out.unlockedCrossMode) {
    const rule = getUnlockDef(id);
    if (rule) {
      toast.gain(`跨模式解锁：生存模式已开放「${rule.title}」`, `cross:${id}`);
    }
  }
}
