import balance from "@/data/balance.json";
import catalogDefinitions from "@/data/catalogDefinitions.json";
import encounters from "@/data/encounters.json";
import enemies from "@/data/enemies.json";
import heroes from "@/data/heroes.json";
import items from "@/data/items.json";
import lore from "@/data/lore.json";
import metaUnlocks from "@/data/metaUnlocks.json";
import plants from "@/data/plants.json";
import recipes from "@/data/recipes.json";
import regions from "@/data/regions.json";
import survivalCampProjects from "@/data/survivalCampProjects.json";
import survivalCatalog from "@/data/survivalCatalog.json";
import survivalRecipes from "@/data/survivalRecipes.json";
import weather from "@/data/weather.json";
import type { EnemyDef, GameData, HeroDef, ItemDef } from "./dataTypes";
import { validateGameData } from "./dataValidator";

export const dataFiles = {
  balance,
  catalogDefinitions,
  encounters,
  enemies,
  heroes,
  items,
  lore,
  metaUnlocks,
  plants,
  recipes,
  regions,
  survivalCampProjects,
  survivalCatalog,
  survivalRecipes,
  weather,
};
export function buildGameData(): GameData {
  return validateGameData(dataFiles);
}

let cached: GameData | null = null;

/** Memoized game data; all systems read configuration through this object. */
export function loadGameData(): GameData {
  if (!cached) cached = buildGameData();
  return cached;
}

/** Raw mode-specific tables share the same startup consistency gate. */
export function loadDataFiles(): typeof dataFiles {
  loadGameData();
  return dataFiles;
}

export function getItem(data: GameData, itemId: string): ItemDef {
  const item = data.items.get(itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  return item;
}

export function getEnemy(data: GameData, enemyId: string): EnemyDef {
  const enemy = data.enemies.get(enemyId);
  if (!enemy) throw new Error(`Unknown enemy ${enemyId}`);
  return enemy;
}

export function itemName(data: GameData, itemId: string): string {
  return data.items.get(itemId)?.name ?? itemId;
}

export function getHero(
  data: Pick<GameData, "heroes" | "defaultHeroId">,
  heroId = data.defaultHeroId,
): HeroDef {
  const hero = data.heroes.get(heroId);
  if (!hero) throw new Error(`Unknown hero ${heroId}`);
  return hero;
}
