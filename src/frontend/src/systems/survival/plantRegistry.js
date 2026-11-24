import plantData from "../../data/plants.json";

export const ALL_PLANT_DEFS = plantData.plants;
const byId = new Map(ALL_PLANT_DEFS.map((def) => [def.id, def]));
const bySeed = new Map(ALL_PLANT_DEFS.map((def) => [def.seedItemId, def]));
const fertilizers = new Map(Object.entries(plantData.fertilizers));

export const tileKey = (tx, ty) => `${tx},${ty}`;
export const getPlantDef = (id) => byId.get(id);
export const getPlantBySeed = (id) => bySeed.get(id);
export const getFertilizerDef = (id) => fertilizers.get(id);
export const createPlantRegistry = () => new Map();

export function canPlantAt(
  registry,
  tx,
  ty,
  plantId,
  terrain,
  nearWater = false,
) {
  const def = getPlantDef(plantId);
  return Boolean(
    Number.isInteger(tx) &&
      Number.isInteger(ty) &&
      def &&
      def.allowedTerrain.includes(terrain) &&
      (!def.requiresNearWater || nearWater) &&
      !registry.has(tileKey(tx, ty)),
  );
}

export function spawnPlant(
  registry,
  plantId,
  tx,
  ty,
  { stage = 0, wild = false } = {},
) {
  const def = getPlantDef(plantId);
  const key = tileKey(tx, ty);
  if (
    !def ||
    !Number.isInteger(tx) ||
    !Number.isInteger(ty) ||
    ![0, 1, 2].includes(stage) ||
    registry.has(key)
  )
    return null;
  const plant = {
    key,
    plantId,
    tx,
    ty,
    stage,
    wild,
    growthSec: 0,
    hp: def.chopHp,
    stump: false,
    wateredSec: 0,
    fertilizedSec: 0,
    fertilizeMult: 1,
    frostProofSec: 0,
    hitShakeSec: 0,
  };
  registry.set(key, plant);
  return plant;
}

export function plantFromSeed(
  registry,
  tx,
  ty,
  itemId,
  terrain,
  nearWater = false,
) {
  const def = getPlantBySeed(itemId);
  if (!def || !canPlantAt(registry, tx, ty, def.id, terrain, nearWater))
    return null;
  return spawnPlant(registry, def.id, tx, ty);
}
