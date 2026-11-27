import { listAdventureSpecialIds } from "@/entities/adventureSpecialEnemies";
import {
  validateEnemyDrops,
  validateEnemySeeds,
} from "@/systems/combat/enemyValidation";
import { catalogIds, index, keys, reference, refs } from "./dataReferences";
import { schemas } from "./dataSchemas";
import type {
  BalanceData,
  CatalogDefinitions,
  EncounterRewardDef,
  EnemyDef,
  GameData,
  HeroDef,
  ItemDef,
  RecipeDef,
  RegionsFile,
} from "./dataTypes";
import type { dataFiles } from "./gameData";
import { invalid } from "./schemaChecks";
import { validateEncounterReferences } from "./schemas/encounterPieces";
import { validateSurvivalReferences } from "./survivalDataValidator";

type RawFiles = typeof dataFiles;
type Files = Omit<
  RawFiles,
  "items" | "recipes" | "regions" | "heroes" | "enemies"
> & {
  items: { items: ItemDef[] };
  recipes: { recipes: RecipeDef[] };
  regions: RegionsFile;
  heroes: { heroes: HeroDef[]; defaultHeroId: string };
  enemies: { enemies: EnemyDef[]; encounterRewards: EncounterRewardDef[] };
};
type Inputs = Record<keyof Files, unknown>;
export function validateGameData(input: Inputs): GameData {
  // Check raw JSON before reading a field or publishing a runtime index.
  for (const file of Object.keys(schemas) as (keyof Files)[])
    schemas[file](input[file], `${file}.json`);
  const files = input as Files;
  const balance = files.balance as BalanceData;
  const ring = balance.survival;
  if (
    !(
      ring.minSpawnRadius < ring.maxSpawnRadius &&
      ring.maxSpawnRadius < ring.despawnRadius
    )
  )
    invalid(
      "balance.json.survival",
      "expected minSpawnRadius < maxSpawnRadius < despawnRadius",
    );
  const catalog: CatalogDefinitions = files.catalogDefinitions;
  const itemList = files.items.items;
  const recipeList = files.recipes.recipes;
  const { regions: regionList, worldObjects, dawnRenewal } = files.regions;
  const enemyList = files.enemies.enemies.map((enemy) => ({
    ...enemy,
    attack: enemy.attack ?? {},
  }));
  const rewards = files.enemies.encounterRewards;
  const items = index(itemList, (r) => r.id, "items.json.items");
  const recipes = index(recipeList, (r) => r.id, "recipes.json.recipes");
  const enemies = index(enemyList, (r) => r.id, "enemies.json.enemies");
  const encounters = index(
    rewards,
    (r) => r.encounterId,
    "enemies.json.encounterRewards",
    "encounterId",
  );
  const regions = index(regionList, (r) => r.id, "regions.json.regions");
  const heroes = index(files.heroes.heroes, (r) => r.id, "heroes.json.heroes");
  const plants = index(files.plants.plants, (r) => r.id, "plants.json.plants");
  const stock = new Set(
    Object.values(files.survivalCatalog)
      .flat()
      .filter((row) => row[1] === "stock")
      .map((row) => row[2]),
  );
  validateEncounterReferences(
    files.encounters.setPieces ?? [],
    items,
    stock,
    enemies,
    plants,
  );
  const weather = index(
    files.weather.weathers,
    (r) => r.id,
    "weather.json.weathers",
  );
  for (const [field, table] of [
    ["itemIds", items],
    ["recipeIds", recipes],
    ["enemyIds", enemies],
    ["regionIds", regions],
    ["heroIds", heroes],
    ["plantIds", plants],
    ["weatherIds", weather],
  ] as const)
    catalogIds(catalog[field], table, field);

  const pickups = validateEnemyDrops(enemyList, rewards, items);
  validateEnemySeeds(enemyList);
  const specialIds = new Set(listAdventureSpecialIds());
  enemyList.forEach((e, i) => {
    const path = `enemies.json.enemies[${i}]`;
    refs(regions, e.regionIds, `${path}.regionIds`);
    if (e.specialKey) reference(specialIds, e.specialKey, `${path}.specialKey`);
  });
  rewards.forEach((r, i) => {
    const p = `enemies.json.encounterRewards[${i}]`;
    reference(regions, r.regionId, `${p}.regionId`);
    r.members.forEach((m, j) =>
      reference(enemies, m.enemyId, `${p}.members[${j}].enemyId`),
    );
  });
  const { defaultHeroId } = files.heroes;
  reference(heroes, defaultHeroId, "heroes.json.defaultHeroId");
  if (heroes.get(defaultHeroId)?.unlock.type !== "default")
    invalid("heroes.json.defaultHeroId", "default hero is locked");
  [...heroes.values()].forEach((h, i) => {
    const p = `heroes.json.heroes[${i}]`;
    keys(items, h.startingInventory, `${p}.startingInventory`);
    for (const [id, n] of Object.entries(h.startingInventory))
      if (n > (items.get(id)?.maxStack ?? 0))
        invalid(`${p}.startingInventory.${id}`, "exceeds maxStack");
    if (h.unlock.type === "boss_defeated")
      reference(enemies, h.unlock.enemyId, `${p}.unlock.enemyId`);
  });
  const lore = files.lore;
  keys(regions, lore.regionToasts, "lore.json.regionToasts");
  for (const id of regions.keys())
    if (!Object.hasOwn(lore.regionToasts, id))
      invalid(`lore.json.regionToasts.${id}`, "missing region toast");
  for (const { id } of balance.meta.notes)
    if (!Object.hasOwn(lore.campNotes, id))
      invalid(`lore.json.campNotes.${id}`, "missing note");
  files.catalogDefinitions.legacyAssetReferences?.forEach((a, i) =>
    reference(
      items,
      a.itemId,
      `catalogDefinitions.json.legacyAssetReferences[${i}].itemId`,
    ),
  );
  refs(
    items,
    balance.hero.quickUseItemIds,
    "balance.json.hero.quickUseItemIds",
  );
  reference(
    regions,
    balance.starting.regionId,
    "balance.json.starting.regionId",
  );
  for (const [key, s] of Object.entries(balance.stats))
    if (s.initial > s.max)
      invalid(`balance.json.stats.${key}.initial`, "exceeds max");
  recipeList.forEach((r, i) => {
    const p = `recipes.json.recipes[${i}]`;
    if (r.stationId !== worldObjects.mainCampfireId)
      invalid(`${p}.stationId`, "unknown crafting station");
    if (r.unlockOnPickup) refs(items, r.unlockOnPickup, `${p}.unlockOnPickup`);
    for (const project of r.unlockOnCampProject ?? []) {
      if (
        recipes.get(project)?.output.type !== "camp_level" &&
        !regionList.some((r) => r.relaySocketId === project)
      )
        invalid(`${p}.unlockOnCampProject`, `unknown camp upgrade ${project}`);
    }
    keys(items, r.inputs, `${p}.inputs`);
    if (r.output.type === "item")
      reference(items, r.output.id, `${p}.output.id`);
  });
  refs(
    items,
    dawnRenewal.renewableItemIds,
    "regions.json.dawnRenewal.renewableItemIds",
  );
  regionList.forEach((r, i) => {
    const p = `regions.json.regions[${i}]`;
    keys(items, r.minimumStartingSupply, `${p}.minimumStartingSupply`);
    if (r.encounterId !== null)
      reference(encounters, r.encounterId, `${p}.encounterId`);
    for (const group of ["residentSpawns", "nightSpawns"] as const)
      r[group].forEach((s, j) => {
        const path = `${p}.${group}[${j}].enemyId`;
        reference(enemies, s.enemyId, path);
        if (!enemies.get(s.enemyId)?.regionIds.includes(r.id))
          invalid(path, `enemy is not allowed in ${r.id}`);
      });
    r.storyProps?.forEach((prop, j) => {
      const path = `${p}.storyProps[${j}]`;
      if (prop.heroToasts) keys(heroes, prop.heroToasts, `${path}.heroToasts`);
      if (prop.tileX >= balance.world.widthTiles)
        invalid(`${path}.tileX`, "outside world");
      if (prop.tileY >= balance.world.heightTiles)
        invalid(`${path}.tileY`, "outside world");
      if (prop.rewardItem) {
        reference(items, prop.rewardItem.itemId, `${path}.rewardItem.itemId`);
        if (pickups.has(prop.rewardItem.pickupId))
          invalid(`${path}.rewardItem.pickupId`, "duplicate pickup");
        pickups.add(prop.rewardItem.pickupId);
      }
    });
  });
  regionList.forEach((r, i) =>
    refs(
      pickups,
      r.entry.requiredPickupIds,
      `regions.json.regions[${i}].entry.requiredPickupIds`,
    ),
  );
  keys(
    regions,
    (files.encounters as { weights?: Record<string, number> }).weights ?? {},
    "encounters.json.weights",
  );
  validateSurvivalReferences(files, items, enemies, plants, weather, pickups);
  return {
    balance,
    catalog,
    items,
    itemList,
    recipes,
    recipeList,
    enemies,
    encounters,
    regions,
    regionList,
    heroes,
    defaultHeroId,
    lore,
    worldObjects,
    dawnRenewal,
    tileSize: balance.world.tileSizePx,
    relaySocketIds: regionList.flatMap((r) =>
      r.relaySocketId ? [r.relaySocketId] : [],
    ),
  };
}
