import tuningSchema from "../../../public/survival-balance.schema.json";
import {
  count,
  dict,
  fields,
  list,
  natural,
  nonnegative,
  optional,
  positive,
  shape,
  string,
} from "../schemaChecks";
import { encounterSchema } from "./encounterPieces";
const ids = list(string);
const stats = { initial: nonnegative, max: positive };
export const configurationSchemas = {
  balance: shape({
    schemaVersion: count,
    world: shape({
      mapKey: string,
      ...fields(
        "widthTiles heightTiles tileSizePx logicalWidthPx logicalHeightPx",
        count,
      ),
    }),
    clock: shape(fields("daySec nightSec runLimitSec maxStepSec", positive)),
    starting: shape({ regionId: string, campLevel: count }),
    survival: shape(
      Object.fromEntries(
        Object.entries(tuningSchema.properties).map(([k, v]) => [
          k,
          k === "categoryCap"
            ? shape(fields("hostile elite neutral", natural))
            : "exclusiveMinimum" in v
              ? positive
              : nonnegative,
        ]),
      ),
    ),
    stats: shape({
      hp: shape({ ...stats, damageImmunitySec: nonnegative }),
      hunger: shape({
        ...stats,
        ...fields(
          "dayDrainPerMinute nightDrainPerMinute zeroDamage",
          nonnegative,
        ),
        zeroDamageIntervalSec: positive,
      }),
      light: shape({
        ...stats,
        ...fields("nightDrainPerSec inFireRegenPerSec zeroDamage", nonnegative),
        zeroDamageIntervalSec: positive,
      }),
    }),
    hero: shape({
      ...fields(
        "moveSpeedPxPerSec interactRangeTiles attackDamage attackRangeTiles attackArcDegrees attackCooldownSec",
        positive,
      ),
      quickUseItemIds: ids,
    }),
    camp: shape({
      radiiTilesByLevel: dict(positive),
      relayRadiusTiles: positive,
    }),
    storage: shape({
      ...fields("runKey runBackupKey metaKey", string),
      autosaveIntervalSec: positive,
    }),
    limits: shape(
      fields(
        "activeEnemies activeProjectiles maxParticles reducedMotionMaxParticles",
        natural,
      ),
    ),
    meta: shape({ notes: list(shape({ id: string, trigger: string })) }),
  }),
  catalogDefinitions: shape({
    schemaVersion: count,
    ...fields(
      "itemIds recipeIds enemyIds regionIds heroIds plantIds weatherIds",
      ids,
    ),
    legacyAssetReferences: optional(
      list(shape(fields("itemId legacyContentId legacyKey", string))),
    ),
  }),
  encounters: shape({
    setPieces: optional(list(encounterSchema)),
    waves: optional(
      shape({ count: optional(count), intervalSec: optional(positive) }),
    ),
    resources: optional(
      shape({
        renewalLimit: optional(natural),
        cooldownSec: optional(positive),
      }),
    ),
    dash: optional(
      shape({
        distanceTiles: optional(positive),
        cooldownSec: optional(positive),
      }),
    ),
    perception: optional(
      shape({
        aggroTiles: optional(nonnegative),
        leashTiles: optional(nonnegative),
      }),
    ),
    weights: optional(dict(nonnegative)),
  }),
};
