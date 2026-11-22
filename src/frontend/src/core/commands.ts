import { craft } from "@/systems/crafting";
import { consumeItem } from "@/systems/inventory";
import { interact } from "@/systems/world/interact";
import type { Command, GameEvent, RunState, Systems } from "./types";

/** Executes the panel/UI command queue once each; results are appended to `events`. */
export function runCommands(
  state: RunState,
  sys: Systems,
  commands: readonly Command[],
  events: GameEvent[],
): void {
  for (const cmd of commands) {
    if (cmd.type === "craft") events.push(...craft(state, sys, cmd.id).events);
    else if (cmd.type === "use")
      events.push(...consumeItem(state, sys, cmd.id).events);
    else if (cmd.type === "interact")
      events.push(...interact(state, sys, cmd.id).events);
  }
}
