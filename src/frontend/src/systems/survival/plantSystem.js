import {
  createPlantRegistry,
  getFertilizerDef,
  getPlantDef,
  spawnPlant,
  tileKey,
} from "./plantRegistry.js";

export {
  ALL_PLANT_DEFS,
  canPlantAt,
  createPlantRegistry,
  getFertilizerDef,
  getPlantBySeed,
  getPlantDef,
  plantFromSeed,
  spawnPlant,
  tileKey,
} from "./plantRegistry.js";

export function waterPlantAt(registry, tx, ty) {
  const plant = registry.get(tileKey(tx, ty));
  if (!plant || plant.stump || plant.stage === 2 || plant.wateredSec >= 30)
    return false;
  plant.wateredSec = 60;
  return true;
}

function advanceStages(plant, def, canMature = undefined) {
  while (plant.stage < 2 && plant.growthSec >= def.stageSec[plant.stage]) {
    const duration = def.stageSec[plant.stage];
    if (plant.stage === 1 && def.solid && canMature?.(plant) === false) {
      plant.growthSec = duration;
      return;
    }
    plant.growthSec -= duration;
    plant.stage++;
    if (plant.stage === 2) {
      plant.growthSec = 0;
      plant.hp = def.chopHp;
    }
  }
}

export function fertilizePlantAt(registry, tx, ty, itemId) {
  const plant = registry.get(tileKey(tx, ty));
  const fertilizer = getFertilizerDef(itemId);
  if (!plant || plant.stump || plant.stage === 2 || !fertilizer) return null;
  const def = getPlantDef(plant.plantId);
  plant.growthSec = fertilizer.advanceFullStage
    ? def.stageSec[plant.stage]
    : plant.growthSec + fertilizer.instantGrowthSec;
  plant.fertilizedSec = fertilizer.durationSec;
  plant.fertilizeMult = fertilizer.growthMult;
  plant.frostProofSec = Math.max(plant.frostProofSec, fertilizer.frostProofSec);
  advanceStages(plant, def);
  return plant;
}

function rollDrops(entries, rng, drops = {}) {
  for (const { itemId, min, max, probability } of entries) {
    if (probability < 1 && rng() >= probability) continue;
    const count = min === max ? min : min + Math.floor(rng() * (max - min + 1));
    drops[itemId] = (drops[itemId] ?? 0) + count;
  }
  return drops;
}

export function chopPlantAt(registry, tx, ty, rng = Math.random) {
  const key = tileKey(tx, ty);
  const plant = registry.get(key);
  if (!plant) return null;
  const def = getPlantDef(plant.plantId);
  if (def.harvestMode === "gather_regrow" || plant.stage < 2) {
    const drops =
      def.harvestMode === "fell"
        ? { [def.seedItemId]: 1 }
        : rollDrops(def.digDrops, rng);
    if (plant.stage === 2) rollDrops(def.drops, rng, drops);
    registry.delete(key);
    return { plant, action: "removed", drops };
  }

  plant.hp--;
  plant.hitShakeSec = 0.22;
  if (plant.hp > 0) return { plant, action: "hit", drops: {} };
  if (plant.stump) {
    registry.delete(key);
    return { plant, action: "removed", drops: rollDrops(def.stumpDrops, rng) };
  }

  plant.stump = true;
  plant.hp = def.stumpHp;
  return { plant, action: "felled", drops: rollDrops(def.drops, rng) };
}

export function harvestPlantAt(registry, tx, ty, rng = Math.random) {
  const plant = registry.get(tileKey(tx, ty));
  if (!plant || plant.stage !== 2 || plant.stump) return null;
  const def = getPlantDef(plant.plantId);
  if (def.harvestMode !== "gather_regrow") return null;
  plant.stage = 0;
  plant.growthSec = 0;
  plant.hitShakeSec = 0.18;
  return { plant, action: "gathered", drops: rollDrops(def.drops, rng) };
}

export function isPlantSolidAt(registry, tx, ty) {
  const plant = registry.get(tileKey(tx, ty));
  return plant?.stage === 2 && !plant.stump && getPlantDef(plant.plantId).solid;
}

export function* collectPlantLights(registry, tileSize) {
  for (const plant of registry.values()) {
    if (plant.stage !== 2 || plant.stump) continue;
    const radius = getPlantDef(plant.plantId).lightRadiusPx;
    if (radius)
      yield {
        x: (plant.tx + 0.5) * tileSize,
        y: (plant.ty + 0.5) * tileSize,
        radius,
        plantId: plant.plantId,
      };
  }
}

function elapseBuffs(plant, dt) {
  plant.wateredSec = Math.max(0, plant.wateredSec - dt);
  plant.fertilizedSec = Math.max(0, plant.fertilizedSec - dt);
  plant.frostProofSec = Math.max(0, plant.frostProofSec - dt);
  if (!plant.fertilizedSec) plant.fertilizeMult = 1;
}

export function tickPlants(
  registry,
  dt,
  weatherMods,
  heatSources,
  tileSize,
  canMature,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const plant of registry.values()) {
    plant.hitShakeSec = Math.max(0, plant.hitShakeSec - dt);
    let remaining = dt;
    if (!plant.stump && plant.stage < 2) {
      const def = getPlantDef(plant.plantId);
      const x = (plant.tx + 0.5) * tileSize;
      const y = (plant.ty + 0.5) * tileSize;
      const warm = heatSources.some(
        (source) =>
          (source.x - x) ** 2 + (source.y - y) ** 2 <= source.radius ** 2,
      );
      if (weatherMods.autoWater)
        plant.wateredSec = Math.max(plant.wateredSec, 60);
      while (remaining > 0 && plant.stage < 2) {
        const step = Math.min(
          remaining,
          (!weatherMods.autoWater && plant.wateredSec) ||
            Number.POSITIVE_INFINITY,
          plant.fertilizedSec || Number.POSITIVE_INFINITY,
          plant.frostProofSec || Number.POSITIVE_INFINITY,
        );
        const protectedFromFrost = warm || plant.frostProofSec > 0;
        const blizzard =
          weatherMods.blizzard || weatherMods.weatherId === "blizzard";
        const weather = weatherMods.plantGrowthMult ?? 1;
        const climate =
          blizzard && protectedFromFrost ? Math.max(1, weather) : weather;
        const warmth = protectedFromFrost ? (def.heatGrowthBonus ?? 1) : 1;
        const favorite =
          def.preferredWeather === weatherMods.weatherId ? 1.25 : 1;
        const moisture =
          weatherMods.autoWater || plant.wateredSec > 0 ? 1.35 : 1;
        plant.growthSec +=
          step * climate * warmth * favorite * moisture * plant.fertilizeMult;
        elapseBuffs(plant, step);
        remaining -= step;
        advanceStages(plant, def, canMature);
      }
      if (weatherMods.autoWater && plant.stage < 2)
        plant.wateredSec = Math.max(plant.wateredSec, 60);
    }
    if (remaining > 0) elapseBuffs(plant, remaining);
  }
}

export function isPristineWildPlant(plant) {
  return (
    plant.wild &&
    !plant.stump &&
    plant.stage === 2 &&
    plant.hp === getPlantDef(plant.plantId).chopHp &&
    !plant.wateredSec &&
    !plant.fertilizedSec &&
    !plant.frostProofSec &&
    !plant.hitShakeSec
  );
}

export function serializePlants(registry) {
  return Array.from(registry.values(), (p) => [
    p.plantId,
    p.tx,
    p.ty,
    p.stage,
    p.growthSec,
    p.hp,
    p.stump,
    p.wateredSec,
    p.fertilizedSec,
    p.fertilizeMult,
    p.frostProofSec,
    p.hitShakeSec,
    p.wild,
  ]);
}

const nonnegative = (value, fallback = 0) =>
  Number.isFinite(value) && value >= 0 ? value : fallback;

export function deserializePlants(raw) {
  const registry = createPlantRegistry();
  if (!Array.isArray(raw)) return registry;
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const [
      id,
      tx,
      ty,
      stage = 0,
      growth,
      hp,
      stump,
      water,
      fertilizer,
      multiplier,
      frostProof,
      shake,
      wild,
    ] = row;
    const plant = spawnPlant(registry, id, tx, ty, {
      stage,
      wild: wild === true,
    });
    if (!plant) continue;
    const def = getPlantDef(id);
    plant.stump = stump === true && def.harvestMode === "fell" && stage === 2;
    const maxHp = plant.stump ? def.stumpHp : def.chopHp;
    plant.hp = Math.max(1, Math.min(maxHp, nonnegative(hp, maxHp)));
    plant.growthSec =
      stage < 2 ? Math.min(def.stageSec[stage], nonnegative(growth)) : 0;
    plant.wateredSec = nonnegative(water);
    plant.fertilizedSec = nonnegative(fertilizer);
    plant.fertilizeMult =
      plant.fertilizedSec > 0 ? Math.max(1, nonnegative(multiplier, 1)) : 1;
    plant.frostProofSec = nonnegative(frostProof);
    plant.hitShakeSec = nonnegative(shake);
  }
  return registry;
}
