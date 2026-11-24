import { skipEternalPrep } from "@/systems/eternal/eternalDirector";
import {
  type LoadoutResult,
  setAllEquipment,
  setLoadoutMode,
  toggleEquipment,
} from "@/systems/eternal/eternalLoadout";
import { playSfx } from "../audio/sfx";
import type { EternalCommands } from "../ui/commands";
import { uiStore } from "../ui/store";
import type { RunSession } from "./RunSession";

/** Eternal Mode actions for the React loadout panel; `refresh` republishes the HUD model. */
export function createEternalCommands(
  session: RunSession,
  refresh: () => void,
): EternalCommands {
  const { state, sys } = session;
  const apply = (result: LoadoutResult): void => {
    if (result.message)
      uiStore.toast(result.message, result.ok ? "good" : "warn");
    playSfx("ui");
    refresh();
  };
  return {
    toggleEquipment: (id) => apply(toggleEquipment(state, sys, id)),
    setLoadoutMode: (mode) => apply(setLoadoutMode(state, sys, mode)),
    selectAllEquipment: () => apply(setAllEquipment(state, sys, true)),
    clearEquipment: () => apply(setAllEquipment(state, sys, false)),
    startCombat: () => {
      skipEternalPrep(state);
      playSfx("ui");
      refresh();
    },
  };
}
