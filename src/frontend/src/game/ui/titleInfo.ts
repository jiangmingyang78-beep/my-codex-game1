import {
  CAMP_NOTE_TEXT,
  getBrowserStorage,
  getSystems,
  loadMeta,
  loadRun,
} from "@/core";
import { uiStore } from "./store";

/** Reads the save and camp notes once so the menu can enable Continue (works without Phaser). */
export function refreshTitleInfo(): void {
  try {
    const storage = getBrowserStorage();
    const load = loadRun(storage, getSystems());
    const notes = loadMeta(storage).notes.map((id) => ({
      id,
      ...(CAMP_NOTE_TEXT[id] ?? { title: id, body: "" }),
    }));
    uiStore.set({
      title: { hasSave: load.snapshot !== null, notice: load.notice, notes },
    });
  } catch (error) {
    console.error(error);
  }
}
