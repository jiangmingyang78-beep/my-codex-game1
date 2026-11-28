import { type HudModel, type RunState, type Systems, itemName } from "@/core";
import { nearestInteractable } from "@/systems";
import type Phaser from "phaser";
import { objectiveLine } from "../session/objective";
import { type Prompt, uiStore } from "./store";

function promptText(
  kind: string,
  itemId: string | undefined,
  id: string,
  state: RunState,
  sys: Systems,
): string | null {
  switch (kind) {
    case "campfire":
      return "E Campfire: craft and upgrade";
    case "node":
      return `E Collect${itemName(sys.data, itemId ?? "")}`;
    case "gate":
      return state.changesByObjectId[id]?.opened ? null : "E Open the gate";
    case "beacon":
      return "E Light the Ridge Beacon (requires 2 Ember Seals)";
    case "relay_socket":
      return state.changesByObjectId[id]?.lit
        ? null
        : "E Light the fire station (requires a Relay Brazier)";
    case "story_prop":
      return "E Inspect the relic";
    case "explosive_barrel":
      return state.changesByObjectId[id]?.opened
        ? null
        : "E / Attack Detonate the resin barrel";
    case "mirror_lamp":
      return state.changesByObjectId[id]?.lit
        ? null
        : "E Light the brass mirror lamp";
    default:
      return null;
  }
}

/** Nearest interactable as a screen-space prompt, plus whether it is the main campfire. */
export function currentPrompt(
  state: RunState,
  sys: Systems,
  camera: Phaser.Cameras.Scene2D.Camera,
): { prompt: Prompt | null; nearCamp: boolean } {
  const o = nearestInteractable(state, sys);
  if (!o) return { prompt: null, nearCamp: false };
  const text = promptText(o.kind, o.itemId, o.id, state, sys);
  if (!text) return { prompt: null, nearCamp: false };
  const view = camera.worldView;
  return {
    prompt: {
      text,
      x: Math.round((o.x - view.x) * camera.zoom),
      y: Math.round((o.y - 14 - view.y) * camera.zoom),
    },
    nearCamp: o.kind === "campfire",
  };
}

/** Pushes the 10 Hz HUD model and objective line to the React layer. */
export function publishHud(hud: HudModel, state: RunState, sys: Systems): void {
  uiStore.set({
    hud,
    objective: hud.eternal?.objective ?? objectiveLine(state, sys),
  });
}

/** Per-frame prompt update; only notifies React when the text or rounded position changed. */
export function publishPrompt(next: {
  prompt: Prompt | null;
  nearCamp: boolean;
}): void {
  const cur = uiStore.get();
  const a = cur.prompt;
  const b = next.prompt;
  const same =
    a === b || (a && b && a.text === b.text && a.x === b.x && a.y === b.y);
  if (same && cur.nearCamp === next.nearCamp) return;
  uiStore.set({ prompt: b, nearCamp: next.nearCamp });
}
