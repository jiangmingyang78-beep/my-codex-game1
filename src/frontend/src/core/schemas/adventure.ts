import {
  boolean,
  count,
  dict,
  fields,
  list,
  natural,
  nonnegative,
  nullable,
  number,
  oneOf,
  optional,
  positive,
  ratio,
  shape,
  string,
  variant,
} from "../schemaChecks";
const ids = list(string);
const stock = dict(count);
const named = { id: string, name: string };
const drop = shape({
  itemId: string,
  count,
  probability: ratio,
  pickupId: optional(string),
  oncePerRun: optional(boolean),
});
const owned = oneOf("owned");
const effect = variant("type", {
  restore_stat: {
    trigger: oneOf("use"),
    stat: oneOf("hunger", "hp", "light"),
    amount: number(),
    requiresBelowMax: optional(boolean),
  },
  night_light_drain_multiplier: {
    trigger: oneOf("owned", "use"),
    multiplier: nonnegative,
    durationSec: optional(positive),
    reapply: optional(oneOf("refresh_duration")),
  },
  set_combat_stat: {
    trigger: owned,
    stat: oneOf("attackDamage", "attackRangeTiles"),
    value: positive,
  },
  add_owned_stat: {
    trigger: owned,
    stat: oneOf(
      "maxHp",
      "attackDamage",
      "coldResist",
      "damageReduction",
      "moveSpeedBonus",
      "dashCooldownReductionSec",
      "immunityBonusSec",
    ),
    value: number(),
  },
  periodic_block: { trigger: owned, cooldownSec: positive },
  light_radius_multiplier: { trigger: owned, multiplier: positive },
  ignite_relay: {
    trigger: oneOf("place"),
    targetType: string,
    radiusTiles: positive,
    consumeCount: count,
  },
  quest_requirement: { trigger: owned, targetId: string, requiredCount: count },
  ignite_beacon: {
    trigger: oneOf("interact"),
    targetId: string,
    requiredCount: count,
  },
});
const attackNumbers = fields(
  "triggerRangeTiles windupSec recoverySec intervalSec distanceTiles travelSec rangeTiles arcDegrees activeSec projectileSpeedPxPerSec projectileLifetimeSec triggerTiles dashDurationSec recoverSec reachTiles cooldownSec preferredTiles radiusTiles",
  optional(positive),
);
const move = {
  type: oneOf("projectile", "lunge", "charge", "sweep"),
  ...attackNumbers,
  triggerRangeTiles: positive,
  windupSec: positive,
  recoverySec: positive,
  lightDamage: optional(nonnegative),
};
const attack = shape({
  ...attackNumbers,
  type: optional(
    oneOf("projectile", "lunge", "charge", "sweep", "alternating", "melee"),
  ),
  mode: optional(oneOf("projectile", "aoe")),
  lightDamage: optional(nonnegative),
  moves: optional(list(shape(move), 1)),
  enrage: optional(shape({ hpRatioAtOrBelow: ratio, intervalSec: positive })),
});
const seeds = ["lunge", "stalk_melee", "ranged_telegraph"];
const rule = variant("type", {
  slippery_ice: { drag: nonnegative },
  dense_fog_bog: {
    bogSpeedMult: nonnegative,
    fogLightDrainMult: positive,
    safeTile: oneOf("path", "floor"),
  },
  periodic_gale: {
    intervalSec: positive,
    durationSec: positive,
    lightRadiusMult: positive,
    pushSpeedPxPerSec: nonnegative,
    pushDirX: number(),
    pushDirY: number(),
  },
  low_pressure_storm: { lightDrainMult: positive, coldScale: nonnegative },
  explosive_barrels: { blastRadiusTiles: positive, blastDamage: nonnegative },
  mirror_darkroom: { requiredLamps: count },
});
const spawn = shape({ spawnId: string, enemyId: string });
const ending = shape({ title: string, epilogue: string });
export const adventureSchemas = {
  items: shape({
    items: list(
      shape({
        ...named,
        type: string,
        maxStack: count,
        effects: list(effect),
        description: string,
      }),
    ),
  }),
  recipes: shape({
    recipes: list(
      shape({
        ...named,
        starterUnlocked: optional(boolean),
        unlockOnPickup: optional(list(string, 1)),
        unlockOnCampProject: optional(list(string, 1)),
        stationId: string,
        minCampLevel: count,
        inputs: stock,
        output: variant("type", {
          item: { id: string, count },
          camp_level: { level: count },
        }),
        constraints: optional(
          shape({
            uniqueOutput: optional(boolean),
            inventoryCapSource: optional(string),
            exactCampLevel: optional(count),
          }),
        ),
      }),
    ),
  }),
  enemies: shape({
    enemies: list(
      shape({
        ...named,
        elementResistance: optional(
          shape({ burn: optional(ratio), chill: optional(ratio) }),
        ),
        faction: optional(oneOf("shadow", "beast", "construct", "neutral")),
        activeWindow: optional(oneOf("any", "day", "night")),
        territoryRadius: optional(positive),
        fearLightThreshold: optional(number(0, 15, true)),
        regionIds: ids,
        maxHp: positive,
        attackDamage: nonnegative,
        moveSpeedPxPerSec: nonnegative,
        attack: optional(attack),
        drops: list(drop),
        scope: optional(oneOf("shared", "adventure_only")),
        seedType: optional(oneOf(...seeds, "warden_phase")),
        specialKey: optional(string),
        knockbackSpeed: optional(nonnegative),
        phases: optional(
          list(
            shape({
              hpThreshold: ratio,
              seedType: oneOf(...seeds),
              overrides: optional(
                shape({
                  moveSpeedPxPerSec: optional(nonnegative),
                  attackDamage: optional(nonnegative),
                  attack: optional(attack),
                }),
              ),
            }),
            1,
          ),
        ),
      }),
    ),
    encounterRewards: list(
      shape({
        encounterId: string,
        regionId: string,
        trigger: oneOf("all_members_defeated"),
        members: list(shape({ enemyId: string, count }), 1),
        drops: list(drop),
      }),
    ),
  }),
  regions: shape({
    regions: list(
      shape({
        ...named,
        act: optional(count),
        kind: optional(oneOf("main", "side")),
        environmentRule: optional(rule),
        storyProps: optional(
          list(
            shape({
              id: string,
              tileX: natural,
              tileY: natural,
              spriteKey: string,
              toast: string,
              heroToasts: optional(dict(string)),
              unlockNoteId: optional(string),
              rewardItem: optional(
                shape({ itemId: string, count, pickupId: string }),
              ),
            }),
          ),
        ),
        entry: shape({
          gateId: nullable(string),
          minCampLevel: count,
          requiredPickupIds: ids,
        }),
        encounterId: nullable(string),
        relaySocketId: nullable(string),
        minimumStartingSupply: dict(natural),
        residentSpawns: list(spawn),
        nightSpawns: list(spawn),
        bossTrigger: optional(
          shape(fields("objectId spawnId lightZoneId", string)),
        ),
      }),
    ),
    worldObjects: shape({
      ...fields("heroSpawnId mainCampfireId finalBeaconId", string),
      renewableWoodNodeIds: ids,
    }),
    dawnRenewal: shape({ renewableItemIds: ids }),
  }),
  heroes: shape({
    defaultHeroId: string,
    heroes: list(
      shape({
        ...named,
        ...fields("epithet roleTag bio quote traitName traitDesc", string),
        traits: shape({
          ...fields("maxHpDelta attackDamageDelta", optional(number())),
          ...fields(
            "moveSpeedMult lightRadiusMult lightDrainMult immunityBonusSec inFireRegenMult healBonus",
            optional(nonnegative),
          ),
        }),
        startingInventory: stock,
        unlock: variant("type", {
          default: {},
          boss_defeated: { enemyId: string },
          consumables_crafted: { count },
          kills: { count },
          camp_notes: { count },
        }),
        palette: shape(fields("o f s e p b d", string)),
      }),
    ),
  }),
  lore: shape({
    worldTagline: string,
    regionToasts: dict(string),
    campNotes: dict(shape({ title: string, body: string })),
    endings: shape({ won: ending, dead: ending, storm_lost: ending }),
  }),
};
