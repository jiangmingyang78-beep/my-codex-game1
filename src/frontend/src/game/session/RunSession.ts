import {
  EVT,
  type GameEvent,
  type MetaState,
  type RunState,
  type StepRequest,
  type StorageLike,
  type Systems,
  applyRunEventsToMeta,
  buildHudModel,
  clearRun,
  createRun,
  getBrowserStorage,
  getSystems,
  loadMeta,
  loadRun,
  saveMeta,
  saveRun,
  step,
} from "@/core";
import { consumeItem, craft as craftRecipe } from "@/systems";
import { buildResultView } from "./resultView";

export type StartMode = "new" | "continue";

/** What a rule call produced, for the scene to present (toasts, sounds, particles). */
export interface SessionOutput {
  events: GameEvent[];
  /** Camp-note ids unlocked by these events. */
  unlockedNotes: string[];
  /** True when an autosave was written (not for the silent interval save). */
  autosaved: boolean;
}

const AUTOSAVE_EVENTS = new Set<string>([
  EVT.dusk,
  EVT.dawn,
  EVT.regionEntered,
  EVT.craftDone,
  EVT.campUpgraded,
  EVT.gateOpened,
  EVT.campLit,
  EVT.sealCollected,
]);

/** Owns one run: the core RunState, persistence, meta notes and run statistics. */
export class RunSession {
  readonly sys: Systems = getSystems();
  readonly storage: StorageLike | null = getBrowserStorage();
  readonly state: RunState;
  readonly meta: MetaState;
  /** Chinese notice from loading (corrupt save, storage unavailable), shown once in game. */
  readonly startNotice: string | null;
  enemiesDefeated = 0;
  lastCause: string | null = null;

  constructor(mode: StartMode) {
    const load = mode === "continue" ? loadRun(this.storage, this.sys) : null;
    this.state = createRun({ systems: this.sys }, load?.snapshot ?? undefined);
    this.startNotice = load?.notice ?? null;
    this.meta = loadMeta(this.storage);
  }

  get playing(): boolean {
    return this.state.status === "playing";
  }

  hud() {
    return buildHudModel(this.state, this.sys);
  }

  /** Advances game time. Callers never invoke this while paused, hidden or in a panel. */
  advance(
    sec: number,
    input: StepRequest["input"],
    commands: StepRequest["commands"],
  ): SessionOutput {
    const events = step(this.state, { sec, input, commands }, this.sys);
    return this.settle(events);
  }

  craft(recipeId: string): SessionOutput {
    return this.settle(craftRecipe(this.state, this.sys, recipeId).events);
  }

  consumeItem(itemId: string): SessionOutput {
    return this.settle(consumeItem(this.state, this.sys, itemId).events);
  }

  /** Manual or hidden-tab save. Returns false when storage is unavailable or the run has ended. */
  save(): boolean {
    if (!this.playing) return false;
    return saveRun(this.storage, this.state, this.sys).ok;
  }

  private settle(events: GameEvent[]): SessionOutput {
    let wantSave = false;
    let silentSave = false;
    for (const e of events) {
      if (
        e.type === EVT.hit &&
        e.payload.kind === "hurt" &&
        typeof e.payload.cause === "string"
      ) {
        this.lastCause = e.payload.cause;
      } else if (e.type === EVT.enemyDefeated) {
        this.enemiesDefeated++;
      } else if (AUTOSAVE_EVENTS.has(e.type)) {
        wantSave = true;
      } else if (e.type === EVT.saveDue) {
        silentSave = true;
      }
    }
    const unlockedNotes = applyRunEventsToMeta(this.meta, this.state, events);
    const ended = events.some((e) => e.type === EVT.runEnded);
    if (unlockedNotes.length > 0 || ended) saveMeta(this.storage, this.meta);
    let autosaved = false;
    if (ended) {
      clearRun(this.storage);
    } else if (wantSave || silentSave) {
      const ok = this.save();
      autosaved = ok && wantSave;
    }
    return { events, unlockedNotes, autosaved };
  }

  result() {
    return buildResultView(this);
  }
}
