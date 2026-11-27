import {
  EVT,
  type GameEvent,
  type HudModel,
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
  isHeroUnlocked,
  loadMeta,
  loadRun,
  saveMeta,
  saveRun,
  step,
} from "@/core";
import { consumeItem, craft as craftRecipe } from "@/systems";
import {
  initEternalRun,
  stepEternalDirector,
} from "@/systems/eternal/eternalDirector";
import { buildEternalHud } from "@/systems/eternal/eternalHud";
import {
  type EternalRecord,
  recordEternalBest,
} from "@/systems/eternal/eternalMeta";
import { getEternalRuntime } from "@/systems/eternal/eternalRuntime";
import { createEternalSystems } from "@/systems/eternal/eternalWorld";
import { buildResultView } from "./resultView";

export type StartMode = "new" | "continue" | "eternal";

/** What a rule call produced, for the scene to present (toasts, sounds, particles). */
export interface SessionOutput {
  events: GameEvent[];
  /** Camp-note ids unlocked by these events. */
  unlockedNotes: string[];
  unlockedHeroes: string[];
  unlockedCrossMode: string[];
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
  readonly sys: Systems;
  readonly storage: StorageLike | null = getBrowserStorage();
  readonly state: RunState;
  readonly meta: MetaState;
  /** Eternal Mode is a single-run mode: it never reads or writes the adventure save. */
  readonly eternal: boolean;
  /** Chinese notice from loading (corrupt save, storage unavailable), shown once in game. */
  readonly startNotice: string | null;
  enemiesDefeated = 0;
  lastCause: string | null = null;
  eternalRecord: EternalRecord | null = null;

  constructor(mode: StartMode, heroId?: string) {
    this.eternal = mode === "eternal";
    this.sys = this.eternal ? createEternalSystems() : getSystems();
    const load = mode === "continue" ? loadRun(this.storage, this.sys) : null;
    this.meta = loadMeta(this.storage);
    const selected =
      heroId && isHeroUnlocked(this.meta, heroId) ? heroId : undefined;
    this.state = createRun(
      { systems: this.sys, heroId: selected },
      load?.snapshot ?? undefined,
    );
    if (this.eternal) initEternalRun(this.state, this.sys);
    this.startNotice = load?.notice ?? null;
  }

  get playing(): boolean {
    return this.state.status === "playing";
  }

  hud(): HudModel {
    const hud = buildHudModel(this.state, this.sys);
    const eternal = this.eternal ? buildEternalHud(this.state, this.sys) : null;
    return eternal ? { ...hud, eternal } : hud;
  }

  /** Advances game time. Callers never invoke this while paused, hidden or in a panel. */
  advance(
    sec: number,
    input: StepRequest["input"],
    commands: StepRequest["commands"],
  ): SessionOutput {
    const events = step(this.state, { sec, input, commands }, this.sys);
    if (this.eternal) stepEternalDirector(this.state, this.sys, sec, events);
    if (
      import.meta.env.DEV &&
      (!Number.isFinite(this.state.hero.x) ||
        !Number.isFinite(this.state.hero.y))
    ) {
      throw new Error(
        `Invalid hero position: (${this.state.hero.x}, ${this.state.hero.y})`,
      );
    }
    return this.settle(events);
  }

  craft(recipeId: string): SessionOutput {
    return this.settle(craftRecipe(this.state, this.sys, recipeId).events);
  }

  consumeItem(itemId: string): SessionOutput {
    return this.settle(consumeItem(this.state, this.sys, itemId).events);
  }

  /** Manual or hidden-tab save. Returns false when storage is unavailable, the run has ended or it is Eternal Mode. */
  save(): boolean {
    if (!this.playing || this.eternal) return false;
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
    const { unlockedNotes, unlockedHeroes, unlockedCrossMode, changed } =
      applyRunEventsToMeta(this.meta, this.state, events);
    const ended = events.some((e) => e.type === EVT.runEnded);
    let metaChanged = changed;
    if (ended && this.eternal) metaChanged = this.settleEternal() || changed;
    if (metaChanged) saveMeta(this.storage, this.meta);
    let autosaved = false;
    if (ended) {
      if (!this.eternal) clearRun(this.storage);
    } else if (wantSave || silentSave || changed) {
      const ok = this.save();
      autosaved = ok && wantSave;
    }
    return {
      events,
      unlockedNotes,
      unlockedHeroes,
      unlockedCrossMode,
      autosaved,
    };
  }

  /** Records the Eternal result in the meta document (the only thing it ever persists). */
  private settleEternal(): boolean {
    const rt = getEternalRuntime(this.state);
    if (!rt) return false;
    const { record, changed } = recordEternalBest(
      this.meta,
      rt.combatElapsedSec,
      rt.kills,
    );
    this.eternalRecord = record;
    return changed;
  }

  result() {
    return buildResultView(this);
  }
}
