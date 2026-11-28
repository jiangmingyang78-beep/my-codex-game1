import type Phaser from "phaser";
import { TEX } from "../textures/registerTextures";
import type { ToastManager } from "./ToastManager";

type QueuedCall = (
  manager: ToastManager,
  textures: Phaser.Textures.TextureManager,
) => void;

let activeManager: ToastManager | null = null;
let activeTextures: Phaser.Textures.TextureManager | null = null;
const pending: QueuedCall[] = [];

/** Priority matches the existing program-based texture (take point texture - > ground fall texture) which returns when not available to / / / triggers a silent retreat. / / / / ///. */
export function resolveItemIconKey(
  itemId: string,
  textures: Phaser.Textures.TextureManager | null,
): string | null {
  if (!textures || !itemId) return null;
  const candidates = [TEX.node(itemId), TEX.lootByItem(itemId)];
  for (const key of candidates) {
    if (textures.exists(key) && textures.get(key).key !== "__MISSING") {
      return key;
    }
  }
  return null;
}

/** ToastManager, which binds the current active scene, and swipes the hints that are stored during the start-up of the scene. */
export function attachToastManager(
  manager: ToastManager,
  textures: Phaser.Textures.TextureManager,
): void {
  activeManager = manager;
  activeTextures = textures;
  while (pending.length > 0) {
    const fn = pending.shift();
    if (fn) fn(manager, textures);
  }
}

/** The scene was removed from the chain when it was destroyed to prevent cross-site references. */
export function detachToastManager(manager: ToastManager): void {
  if (activeManager !== manager) return;
  activeManager = null;
  activeTextures = null;
}

/** Determines whether the harr side of ToastManager is mounted. */
export function hasToastManager(): boolean {
  return activeManager !== null;
}

export function getToastBounds(): DOMRect[] {
  return activeManager?.getVisibleBounds() ?? [];
}

function dispatch(fn: QueuedCall): void {
  if (activeManager && activeTextures) {
    fn(activeManager, activeTextures);
    return;
  }
  pending.push(fn);
  if (pending.length > 16) pending.shift();
}

/** A light-point door for the same scene, session events and React command level. */
export const toast = {
  loot(
    itemId: string,
    label: string,
    delta = 1,
    iconKey?: string | null,
  ): void {
    dispatch((mgr, textures) => {
      const resolved =
        iconKey !== undefined ? iconKey : resolveItemIconKey(itemId, textures);
      mgr.loot(itemId, label, delta, resolved);
    });
  },
  warn(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.warn(label, key);
    });
  },
  error(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.error(label, key);
    });
  },
  info(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.info(label, key);
    });
  },
  gain(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.gain(label, key);
    });
  },
  /** Compatibility with old versions of common signatures (tern, ts). */
  show(label: string, tone: "info" | "good" | "warn" | "error" = "info"): void {
    dispatch((mgr) => {
      mgr.show(label, tone);
    });
  },
  clear(): void {
    pending.length = 0;
    activeManager?.clear();
  },
};
