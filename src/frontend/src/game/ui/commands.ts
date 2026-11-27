import { beginRun, returnToTitle } from "../session/activeRun";
import { selectTitleHero } from "./titleInfo";

export interface DevEnemyOption {
  id: string;
  name: string;
}

export interface DevCommands {
  listEnemies(): DevEnemyOption[];
  isGodMode(): boolean;
  grantAllGear(): void;
  restoreAndReset(): void;
  simulateHit(): void;
  togglePhase(): void;
  toggleGodMode(): boolean;
  spawnEnemy(enemyId: string): boolean;
  clearEnemies(): void;
}

/** Eternal Mode loadout actions, bound by the game scene only during an eternal run. */
export interface EternalCommands {
  toggleEquipment(itemId: string): void;
  setLoadoutMode(mode: "standard" | "free"): void;
  selectAllEquipment(): void;
  clearEquipment(): void;
  startCombat(): void;
}

/** Actions the React UI can request. Scenes bind the ones they own and unbind on shutdown. */
export interface GameCommands {
  selectHero(heroId: string): void;
  newGame(): void;
  newEternal(): void;
  continueGame(): void;
  pause(): void;
  resume(): void;
  save(): boolean;
  toTitle(): void;
  restart(): void;
  viewRecipe(recipeId: string): void;
  craft(recipeId: string): void;
  quickUse(slot: number): void;
  interact(): void;
  attack(): void;
  openCraft(): void;
  closeCraft(): void;
  dev?: DevCommands;
  eternal?: EternalCommands;
}

const noop = (): void => undefined;

/** Starting a run and returning to the title are handled by the store, never by a scene. */
function freshCommands(): GameCommands {
  return {
    selectHero: selectTitleHero,
    newGame: () => beginRun("new"),
    newEternal: () => beginRun("eternal"),
    continueGame: () => beginRun("continue"),
    pause: noop,
    resume: noop,
    save: () => false,
    toTitle: returnToTitle,
    restart: noop,
    viewRecipe: noop,
    craft: noop,
    quickUse: noop,
    interact: noop,
    attack: noop,
    openCraft: noop,
    closeCraft: noop,
    dev: undefined,
    eternal: undefined,
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
