import balanceJson from "@/data/balance.json";
import catalogJson from "@/data/catalogDefinitions.json";
import enemiesJson from "@/data/enemies.json";
import itemsJson from "@/data/items.json";
import recipesJson from "@/data/recipes.json";
import regionsJson from "@/data/regions.json";
import type {
  BalanceData,
  CatalogDefinitions,
  EncounterRewardDef,
  EnemyDef,
  GameData,
  ItemDef,
  RecipeDef,
  RegionsFile,
} from "./dataTypes";

function indexBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
  source: string,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    if (index.has(id)) throw new Error(`${source}: duplicate id ${id}`);
    index.set(id, row);
  }
  return index;
}

function requireIds(
  ids: Iterable<string>,
  known: ReadonlyMap<string, unknown>,
  source: string,
): void {
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`${source}: unknown id ${id}`);
  }
}

/** Builds the indexed data set and verifies cross references (mirrors tools/validate-mvp.cjs). */
export function buildGameData(): GameData {
  const balance = balanceJson as unknown as BalanceData;
  const catalog = catalogJson as unknown as CatalogDefinitions;
  const regionsFile = regionsJson as unknown as RegionsFile;
  const itemList = (itemsJson as unknown as { items: ItemDef[] }).items;
  const recipeList = (recipesJson as unknown as { recipes: RecipeDef[] })
    .recipes;
  const enemyFile = enemiesJson as unknown as {
    enemies: EnemyDef[];
    encounterRewards: EncounterRewardDef[];
  };

  const items = indexBy(itemList, (i) => i.id, "items");
  const recipes = indexBy(recipeList, (r) => r.id, "recipes");
  const enemies = indexBy(enemyFile.enemies, (e) => e.id, "enemies");
  const encounters = indexBy(
    enemyFile.encounterRewards,
    (e) => e.encounterId,
    "encounters",
  );
  const regions = indexBy(regionsFile.regions, (r) => r.id, "regions");

  for (const recipe of recipeList) {
    requireIds(Object.keys(recipe.inputs), items, recipe.id);
    if (recipe.output.type === "item")
      requireIds([recipe.output.id], items, recipe.id);
  }
  for (const enemy of enemyFile.enemies) {
    requireIds(
      enemy.drops.map((d) => d.itemId),
      items,
      enemy.id,
    );
  }
  requireIds(balance.hero.quickUseItemIds, items, "quickUseItemIds");
  requireIds(
    Object.keys(balance.starting.inventory),
    items,
    "starting.inventory",
  );
  requireIds([balance.starting.regionId], regions, "starting.regionId");
  for (const region of regionsFile.regions) {
    for (const spawn of [...region.residentSpawns, ...region.nightSpawns]) {
      requireIds([spawn.enemyId], enemies, spawn.spawnId);
    }
  }
  const relaySocketIds = regionsFile.regions.flatMap((r) =>
    r.relaySocketId ? [r.relaySocketId] : [],
  );

  return {
    balance,
    items,
    itemList,
    recipes,
    recipeList,
    enemies,
    encounters,
    regions,
    regionList: regionsFile.regions,
    worldObjects: regionsFile.worldObjects,
    dawnRenewal: regionsFile.dawnRenewal,
    catalog,
    tileSize: balance.world.tileSizePx,
    relaySocketIds,
  };
}

let cached: GameData | null = null;

/** Memoized game data; all systems read configuration through this object. */
export function loadGameData(): GameData {
  if (!cached) cached = buildGameData();
  return cached;
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
