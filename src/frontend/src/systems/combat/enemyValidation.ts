import type {
  AttackMove,
  EncounterRewardDef,
  EnemyAttack,
  EnemyDef,
  EnemyPhaseStage,
  ItemDef,
} from "@/core/dataTypes";
import { invalid, positive } from "@/core/schemaChecks";

export function validateEnemyDrops(
  enemies: readonly EnemyDef[],
  encounters: readonly EncounterRewardDef[],
  items: ReadonlyMap<string, ItemDef>,
) {
  const fixed = new Set<string>();
  for (const [group, rows] of [
    ["enemies", enemies],
    ["encounterRewards", encounters],
  ] as const) {
    rows.forEach((source, i) =>
      source.drops.forEach((drop, j) => {
        const path = `enemies.json.${group}[${i}].drops[${j}]`;
        const item = items.get(drop.itemId);
        if (!item) invalid(`${path}.itemId`, `unknown item ${drop.itemId}`);
        if (
          !Number.isSafeInteger(drop.count) ||
          drop.count < 1 ||
          drop.count > item.maxStack
        )
          invalid(`${path}.count`, "invalid stack size");
        if (
          !Number.isFinite(drop.probability) ||
          drop.probability < 0 ||
          drop.probability > 1
        )
          invalid(`${path}.probability`, "expected 0..1");
        if ((drop.oncePerRun === true) !== Boolean(drop.pickupId))
          invalid(`${path}.oncePerRun`, "must match presence of pickupId");
        if (item.type === "quest" && (!drop.pickupId || drop.probability !== 1))
          invalid(
            path + (drop.pickupId ? ".probability" : ".pickupId"),
            "quest drop must be guaranteed and identifiable",
          );
        if (drop.pickupId) {
          if (fixed.has(drop.pickupId))
            invalid(`${path}.pickupId`, `duplicate pickup ${drop.pickupId}`);
          fixed.add(drop.pickupId);
        }
      }),
    );
  }
  return fixed;
}

const seedFields = {
  lunge: ["triggerTiles", "distanceTiles", "dashDurationSec", "recoverSec"],
  stalk_melee: ["reachTiles", "cooldownSec"],
  ranged_telegraph: ["preferredTiles", "cooldownSec"],
} as const;
function checkAttack(
  type: EnemyPhaseStage["seedType"],
  attack: EnemyAttack | undefined,
  path: string,
) {
  if (!attack) invalid(path, "missing seed attack");
  for (const key of ["windupSec", ...seedFields[type]] as const)
    positive(attack[key], `${path}.${key}`);
  if (
    type === "ranged_telegraph" &&
    attack.mode !== "aoe" &&
    attack.mode !== "projectile"
  )
    invalid(`${path}.mode`, "expected aoe or projectile");
}
function checkLegacyMove(move: EnemyAttack, path: string) {
  const fields: Record<AttackMove["type"], readonly (keyof AttackMove)[]> = {
    lunge: ["distanceTiles", "travelSec"],
    charge: ["distanceTiles", "travelSec"],
    sweep: ["activeSec", "rangeTiles", "arcDegrees"],
    projectile: ["projectileSpeedPxPerSec", "projectileLifetimeSec"],
  };
  if (!move.type || !Object.hasOwn(fields, move.type))
    invalid(`${path}.type`, "invalid legacy move");
  for (const key of [
    "windupSec",
    "recoverySec",
    "triggerRangeTiles",
    ...fields[move.type as AttackMove["type"]],
  ] as const)
    positive(move[key], `${path}.${key}`);
}
export function validateEnemySeeds(enemies: readonly EnemyDef[]) {
  enemies.forEach((enemy, i) => {
    const p = `enemies.json.enemies[${i}]`;
    if (enemy.seedType === "warden_phase") {
      if (!enemy.phases?.length) invalid(`${p}.phases`, "missing boss phases");
      enemy.phases.forEach((stage, j, stages) => {
        const path = `${p}.phases[${j}]`;
        if (
          j === 0
            ? stage.hpThreshold !== 1
            : stage.hpThreshold <= 0 ||
              stage.hpThreshold >= stages[j - 1].hpThreshold
        )
          invalid(`${path}.hpThreshold`, "thresholds must descend from 1");
        checkAttack(
          stage.seedType,
          { ...enemy.attack, ...stage.overrides?.attack },
          `${path}.overrides.attack`,
        );
      });
    } else if (enemy.seedType)
      checkAttack(enemy.seedType, enemy.attack, `${p}.attack`);
    else if (enemy.attack?.type === "alternating") {
      if (!enemy.attack.moves?.length)
        invalid(`${p}.attack.moves`, "missing moves");
      enemy.attack.moves.forEach((move, j) =>
        checkLegacyMove(move, `${p}.attack.moves[${j}]`),
      );
    } else {
      if (!enemy.attack) invalid(`${p}.attack`, "missing attack");
      checkLegacyMove(enemy.attack, `${p}.attack`);
    }
  });
}
