import type { HeroDef, HudModel } from "@/core";
import { useSyncExternalStore } from "react";
import { type DiagnosticReport, breadcrumb } from "../diagnostics/report";
import { hasToastManager, toast } from "./toastBridge";

export type Screen = "title" | "playing" | "paused" | "craft" | "result";
export type ToastTone = "info" | "good" | "warn";

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface MaterialRow {
  itemId: string;
  name: string;
  need: number;
  have: number;
}

export type RecipeCategory = "equipment" | "supply" | "camp";

export interface RecipeRow {
  unlocked: boolean;
  unread: boolean;
  hint: string;
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  materials: MaterialRow[];
  /** Campfire level change for upgrade recipes, or null for other recipes. */
  levelChange: string | null;
  minCampLevel: number;
  /** Reason the Craft button is disabled, or null when craftable. */
  blockedReason: string | null;
  /** "Line is missing Xi; `ch but nope */
  shortfallText: string | null;
}

export interface CraftView {
  campLevel: number;
  maxCampLevel: number;
  rows: RecipeRow[];
  relayKits: number;
  unlitRelays: number;
}

export interface ResultView {
  status: "won" | "dead" | "storm_lost";
  /** "Thenna" for eternity ; alkowtz it list */
  mode?: "eternal";
  title: string;
  cause: string;
  epilogue: string;
  stats: { label: string; value: string }[];
  notes: string[];
  eternal?: { newRecord: boolean };
}

export interface TitleHero {
  definition: HeroDef;
  unlocked: boolean;
  unlockText: string;
}

export interface TitleView {
  crossModeUnlockCount: number;
  crossModeUnlockTotal: number;
  worldTagline: string;
  heroes: TitleHero[];
  selectedHeroId: string;
  hasSave: boolean;
  /** Eternal Mode personal bests (undefined until a run has been settled). */
  eternalBestSec?: number;
  eternalBestKills?: number;
  notice: string | null;
  notes: { id: string; title: string; body: string }[];
}

export interface Prompt {
  text: string;
  x: number;
  y: number;
}

export interface UiState {
  screen: Screen;
  hud: HudModel | null;
  objective: string;
  /** Interaction prompt with its screen position in CSS pixels. */
  prompt: Prompt | null;
  nearCamp: boolean;
  toasts: Toast[];
  muted: boolean;
  title: TitleView;
  craft: CraftView | null;
  result: ResultView | null;
  error: DiagnosticReport | null;
}

const initial: UiState = {
  screen: "title",
  hud: null,
  objective: "",
  prompt: null,
  nearCamp: false,
  toasts: [],
  muted: false,
  title: {
    crossModeUnlockCount: 0,
    crossModeUnlockTotal: 0,
    hasSave: false,
    notice: null,
    notes: [],
    heroes: [],
    selectedHeroId: "",
    worldTagline: "",
  },
  craft: null,
  result: null,
  error: null,
};

let state: UiState = initial;
let toastId = 0;
const listeners = new Set<() => void>();
const MAX_TOASTS = 4;
const TOAST_MS = 3200;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

export const uiStore = {
  get: (): UiState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  set(patch: Partial<UiState>): void {
    if (patch.screen && patch.screen !== state.screen)
      breadcrumb(`Interface ${state.screen} → ${patch.screen}`);
    state = { ...state, ...patch };
    emit();
  },
  /** Compatible with old version of the generic reminder signature: nar ToastManager is ready to go straight to the two-channel manager, otherwise it returns safely. */
  toast(text: string, tone: ToastTone = "info"): void {
    if (hasToastManager()) {
      toast.show(text, tone);
      return;
    }
    const id = ++toastId;
    const next = [...state.toasts, { id, text, tone }].slice(-MAX_TOASTS);
    state = { ...state, toasts: next };
    timers.set(
      id,
      setTimeout(() => uiStore.dismissToast(id), TOAST_MS),
    );
    emit();
  },
  dismissToast(id: number): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    if (!state.toasts.some((t) => t.id === id)) return;
    state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
    emit();
  },
  /** Back to a clean title state (used when the Phaser game is destroyed). */
  reset(): void {
    toast.clear();
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    state = { ...initial, muted: state.muted, title: state.title };
    emit();
  },
};

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(uiStore.subscribe, () => selector(uiStore.get()));
}
