import balanceJson from "@/data/balance.json";
import catalogJson from "@/data/catalogDefinitions.json";
import heroesJson from "@/data/heroes.json";
import itemsJson from "@/data/items.json";
import legacyEnemiesJson from "@/data/legacyEnemies.json";
import loreJson from "@/data/lore.json";
import plantsJson from "@/data/plants.json";
import recipesJson from "@/data/recipes.json";
import regionsJson from "@/data/regions.json";
import weatherJson from "@/data/weather.json";
import { ALL_SEED_ENEMIES } from "@/shared/monsterCatalog.js";
import {
  validateEnemyDrops,
  validateEnemySeeds,
} from "@/systems/EnemyManager.js";
import type {
  BalanceData,
  CatalogDefinitions,
  EncounterRewardDef,
  EnemyDef,
  GameData,
  HeroDef,
  ItemDef,
  LoreData,
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

function validateCatalogIds(
  ids: readonly string[],
  known: ReadonlyMap<string, unknown>,
  source: string,
): void {
  requireIds(ids, known, source);
  if (new Set(ids).size !== ids.length || ids.length !== known.size)
    throw new Error(`${source}: catalog IDs must match the data`);
}

function validateSurvivalData(
  items: ReadonlyMap<string, ItemDef>,
  catalog: CatalogDefinitions,
): void {
  const weather = indexBy(weatherJson.weathers, (def) => def.id, "weather");
  const plants = indexBy(plantsJson.plants, (def) => def.id, "plants");
  validateCatalogIds(catalog.plantIds, plants, "catalog.plantIds");
  validateCatalogIds(catalog.weatherIds, weather, "catalog.weatherIds");
  requireIds([weatherJson.defaultWeatherId], weather, "defaultWeatherId");
  requireIds(Object.keys(plantsJson.fertilizers), items, "fertilizers");
  for (const def of weather.values())
    requireIds(Object.keys(def.transitions), weather, def.id);
  for (const def of plants.values()) {
    if (def.preferredWeather)
      requireIds([def.preferredWeather], weather, def.id);
    const drops = [
      ...def.drops,
      ...(def.stumpDrops ?? []),
      ...(def.digDrops ?? []),
    ];
    requireIds(
      [def.seedItemId, ...drops.map(({ itemId }) => itemId)],
      items,
      def.id,
    );
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
  const legacy = legacyEnemiesJson as unknown as {
    enemies: EnemyDef[];
    encounterRewards: EncounterRewardDef[];
  };
  const enemyFile = {
    enemies: [
      ...(ALL_SEED_ENEMIES as unknown as EnemyDef[]),
      ...legacy.enemies,
    ],
    encounterRewards: legacy.encounterRewards,
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
  validateEnemyDrops(enemyFile.enemies, enemyFile.encounterRewards, items);
  validateEnemySeeds(enemyFile.enemies);
  validateCatalogIds(catalog.itemIds, items, "catalog.itemIds");
  validateCatalogIds(catalog.recipeIds, recipes, "catalog.recipeIds");
  validateSurvivalData(items, catalog);
  const { defaultHeroId } = heroesJson;
  const heroes = indexBy(
    heroesJson.heroes as unknown as HeroDef[],
    (h) => h.id,
    "heroes",
  );
  requireIds([defaultHeroId], heroes, "defaultHeroId");
  if (getHero({ heroes, defaultHeroId }).unlock.type !== "default")
    throw new Error("Default hero must be unlocked");
  requireIds(catalog.heroIds, heroes, "catalog.heroIds");
  const lore: LoreData = loreJson;
  requireIds(
    regions.keys(),
    new Map(Object.entries(lore.regionToasts)),
    "regionToasts",
  );
  requireIds(
    balance.meta.notes.map((note) => note.id),
    new Map(Object.entries(lore.campNotes)),
    "campNotes",
  );
  for (const hero of heroes.values()) {
    if (!catalog.heroIds.includes(hero.id))
      throw new Error(`Missing hero ID in catalog: ${hero.id}`);
    requireIds(Object.keys(hero.startingInventory), items, hero.id);
    for (const [id, count] of Object.entries(hero.startingInventory)) {
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > (items.get(id)?.maxStack ?? 0)
      )
        throw new Error(`${hero.id}: invalid starting count for ${id}`);
    }
    if (hero.unlock.type === "boss_defeated")
      requireIds([hero.unlock.enemyId], enemies, hero.id);
  }

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
  requireIds([balance.starting.regionId], regions, "starting.regionId");
  for (const region of regionsFile.regions) {
    for (const spawn of [...region.residentSpawns, ...region.nightSpawns]) {
      requireIds([spawn.enemyId], enemies, spawn.spawnId);
      if (!enemies.get(spawn.enemyId)?.regionIds.includes(region.id))
        throw new Error(
          `${spawn.spawnId}: ${spawn.enemyId} is not allowed in ${region.id}`,
        );
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
    heroes,
    defaultHeroId,
    lore,
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

export function getHero(
  data: Pick<GameData, "heroes" | "defaultHeroId">,
  heroId = data.defaultHeroId,
): HeroDef {
  const hero = data.heroes.get(heroId);
  if (!hero) throw new Error(`Unknown hero ${heroId}`);
  return hero;
}
