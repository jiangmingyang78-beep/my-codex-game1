import { beginRun, returnToTitle } from "../session/activeRun";

/** Actions the React UI can request. Scenes bind the ones they own and unbind on shutdown. */
export interface GameCommands {
  newGame(): void;
  continueGame(): void;
  pause(): void;
  resume(): void;
  save(): void;
  toTitle(): void;
  restart(): void;
  craft(recipeId: string): void;
  quickUse(slot: number): void;
  interact(): void;
  attack(): void;
  openCraft(): void;
  closeCraft(): void;
}

const noop = (): void => undefined;

/** Starting a run and returning to the title are handled by the store, never by a scene. */
function freshCommands(): GameCommands {
  return {
    newGame: () => beginRun("new"),
    continueGame: () => beginRun("continue"),
    pause: noop,
    resume: noop,
    save: noop,
    toTitle: returnToTitle,
    restart: noop,
    craft: noop,
    quickUse: noop,
    interact: noop,
    attack: noop,
    openCraft: noop,
    closeCraft: noop,
  };
}

const defaults: GameCommands = freshCommands();
export const commands: GameCommands = freshCommands();

/** Binds handlers and returns a function that restores the no-ops for exactly those keys. */
export function bindCommands(handlers: Partial<GameCommands>): () => void {
  const keys = Object.keys(handlers) as (keyof GameCommands)[];
  const bound = new Map<keyof GameCommands, GameCommands[keyof GameCommands]>();
  for (const key of keys) {
    const handler = handlers[key];
    if (!handler) continue;
    (commands as unknown as Record<string, unknown>)[key] = handler;
    bound.set(key, handler);
  }
  return () => {
    for (const [key, handler] of bound) {
      if ((commands as unknown as Record<string, unknown>)[key] === handler) {
        (commands as unknown as Record<string, unknown>)[key] = defaults[key];
      }
    }
  };
}
