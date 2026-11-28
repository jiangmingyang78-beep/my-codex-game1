import { summarizeRunSnapshot } from "@/core/snapshot";
import { breadcrumb, captureDiagnostic } from "../diagnostics/report";
import { uiStore } from "../ui/store";
import { RunSession, type StartMode } from "./RunSession";

/** A run created by the React UI that the Phaser game scene has not attached to yet. */
let pending: RunSession | null = null;
const SCENE_ATTACH_TIMEOUT_MS = 5000;
let attachTimer: ReturnType<typeof setTimeout> | null = null;

export function hasPendingRun(): boolean {
  return pending !== null;
}

/** Hands the pending run to the game scene (once). */
export function takePendingRun(): RunSession | null {
  const run = pending;
  discardPendingRun();
  return run;
}

export function discardPendingRun(): void {
  if (attachTimer !== null) clearTimeout(attachTimer);
  attachTimer = null;
  pending = null;
}

/** Prepares the run. GameScene shows the gameplay UI once its input and rendering are ready. */
export function beginRun(mode: StartMode): void {
  if (pending || uiStore.get().screen !== "title" || uiStore.get().error)
    return;
  try {
    breadcrumb(`Start the game ${mode}`);
    const { title } = uiStore.get();
    const selected = title.heroes.find(
      ({ definition }) => definition.id === title.selectedHeroId,
    );
    if (mode !== "continue" && selected && !selected.unlocked) return;
    pending = new RunSession(mode, selected?.definition.id);
    uiStore.set({ screen: "playing" });
    attachTimer = setTimeout(() => {
      reportFailure(
        "The game image is not started. Please return to the title and try again.",
      );
    }, SCENE_ATTACH_TIMEOUT_MS);
  } catch (error) {
    console.error(error);
    reportFailure(
      "Can not start game. Please return the title and try again.",
      error,
    );
  }
}

/** Shows the error screen with a return-to-title button. */
export function reportFailure(message: string, error?: unknown): void {
  const report = captureDiagnostic(
    message,
    error,
    pending ? summarizeRunSnapshot(pending.state, pending.eternal) : undefined,
  );
  discardPendingRun();
  uiStore.set({ error: report, prompt: null, craft: null });
}

/** Drops any run and shows the title menu again. */
export function returnToTitle(): void {
  discardPendingRun();
  uiStore.set({
    screen: "title",
    hud: null,
    prompt: null,
    nearCamp: false,
    craft: null,
    result: null,
    toasts: [],
    error: null,
  });
}
