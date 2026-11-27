import {
  type Check,
  boolean,
  count,
  dict,
  list,
  natural,
  nonnegative,
  number,
  oneOf,
  optional,
  positive,
  ratio,
  record,
  shape,
  string,
  variant,
} from "../schemaChecks";
const ids = list(string);
const stock = dict(count);
const named = { id: string, name: string };
const plantDrop = shape({
  itemId: string,
  min: natural,
  max: count,
  probability: ratio,
});
const condition: Check = (v, p) => {
  if (Object.hasOwn(record(v, p), "anyOf"))
    shape({ anyOf: list(condition, 1) })(v, p);
  else {
    const references = {
      itemId: optional(string),
      enemyId: optional(string),
      plantId: optional(string),
    };
    variant("event", {
      "resource.collected": { ...references, itemId: string },
      "item.picked": { ...references, itemId: string },
      "seal.collected": { ...references, pickupId: string },
      "enemy.defeated": { ...references, enemyId: string },
      "run.ended": {
        ...references,
        status: oneOf("won", "dead", "storm_lost"),
      },
    })(v, p);
  }
};
export const survivalSchemas = {
  plants: shape({
    plants: list(
      shape({
        ...named,
        seedItemId: string,
        harvestMode: oneOf("fell", "gather_regrow"),
        solid: boolean,
        chopHp: count,
        stageSec: list(positive, 2, 2),
        allowedTerrain: ids,
        stumpHp: optional(count),
        preferredWeather: optional(string),
        requiresNearWater: optional(boolean),
        heatGrowthBonus: optional(nonnegative),
        lightRadiusPx: optional(nonnegative),
        drops: list(plantDrop),
        stumpDrops: optional(list(plantDrop)),
        digDrops: optional(list(plantDrop)),
      }),
    ),
    fertilizers: dict(
      shape({
        instantGrowthSec: nonnegative,
        growthMult: positive,
        durationSec: positive,
        advanceFullStage: boolean,
        frostProofSec: nonnegative,
      }),
    ),
  }),
  weather: shape({
    defaultWeatherId: string,
    transitionDurationSec: positive,
    weathers: list(
      shape({
        ...named,
        minDay: count,
        durationSec: list(positive, 2, 2),
        lightRadiusMult: positive,
        fireDrainMult: positive,
        moveSpeedMult: positive,
        plantGrowthMult: nonnegative,
        spawnRateMult: nonnegative,
        autoWater: boolean,
        particleKind: oneOf("none", "snow", "blizzard", "rain", "fog"),
        particleCount: natural,
        windX: number(),
        fallSpeed: nonnegative,
        fogAlpha: ratio,
        tintColor: list(number(0, 255, true), 3, 3),
        tintAlpha: ratio,
        transitions: dict(nonnegative),
      }),
    ),
  }),
  survivalRecipes: dict(
    shape({
      cost: stock,
      count,
      camp: optional(boolean),
      tech: optional(string),
      unique: optional(boolean),
      metaUnlock: optional(string),
    }),
  ),
  survivalCatalog: dict(list(list(string, 4, 4))),
  survivalCampProjects: shape({
    projects: dict(shape({ name: string, detail: string, cost: stock })),
    wellAutoRefillTiles: positive,
    restHungerSaved: natural,
    bonusEggs: natural,
  }),
  metaUnlocks: list(
    shape({
      id: string,
      sourceMode: oneOf("adventure"),
      targetMode: oneOf("survival"),
      targetType: oneOf("plan", "recipe"),
      targetKey: string,
      title: string,
      condition,
      hint: string,
    }),
  ),
};
