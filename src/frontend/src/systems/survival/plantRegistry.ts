import { loadDataFiles } from "@/core/gameData";
const plantData = loadDataFiles().plants;

export type PlantDef = (typeof plantData.plants)[number];
export interface Plant {
  key: string;
  plantId: string;
  tx: number;
  ty: number;
  stage: number;
  wild: boolean;
  growthSec: number;
  hp: number;
  stump: boolean;
  wateredSec: number;
  fertilizedSec: number;
  fertilizeMult: number;
  frostProofSec: number;
  hitShakeSec: number;
}
export type PlantRegistry = Map<string, Plant>;
export const ALL_PLANT_DEFS = plantData.plants;
const byId = new Map(ALL_PLANT_DEFS.map((def) => [def.id, def]));
const bySeed = new Map(ALL_PLANT_DEFS.map((def) => [def.seedItemId, def]));
const fertilizers = new Map(Object.entries(plantData.fertilizers));

export const tileKey = (tx: number, ty: number) => `${tx},${ty}`;
export const getPlantDef = (id: string) => byId.get(id);
export const getPlantBySeed = (id: string) => bySeed.get(id);
export const getFertilizerDef = (id: string) => fertilizers.get(id);
export const createPlantRegistry = (): PlantRegistry => new Map();

export function canPlantAt(
  registry: PlantRegistry,
  tx: number,
  ty: number,
  plantId: string,
  terrain: string,
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
  registry: PlantRegistry,
  plantId: string,
  tx: number,
  ty: number,
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
  registry: PlantRegistry,
  tx: number,
  ty: number,
  itemId: string,
  terrain: string,
  nearWater = false,
) {
  const def = getPlantBySeed(itemId);
  if (!def || !canPlantAt(registry, tx, ty, def.id, terrain, nearWater))
    return null;
  return spawnPlant(registry, def.id, tx, ty);
}
