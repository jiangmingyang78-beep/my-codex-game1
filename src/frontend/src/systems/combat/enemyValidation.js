export function validateEnemyDrops(enemies, encounters, items) {
  const fixed = new Set();
  for (const source of [...enemies, ...encounters]) {
    for (const drop of source.drops) {
      const item = items.get(drop.itemId);
      if (
        !item ||
        !Number.isInteger(drop.count) ||
        drop.count < 1 ||
        drop.count > item.maxStack ||
        !Number.isFinite(drop.probability) ||
        drop.probability < 0 ||
        drop.probability > 1
      )
        throw new Error(
          `${source.id ?? source.encounterId}: invalid drop ${drop.itemId}`,
        );
      const hasId =
        typeof drop.pickupId === "string" && drop.pickupId.trim().length > 0;
      if (
        (drop.pickupId !== undefined && !hasId) ||
        hasId !== (drop.oncePerRun === true) ||
        (item.type === "quest" && (!hasId || drop.probability !== 1))
      )
        throw new Error(
          `${source.id ?? source.encounterId}: invalid pickupId/oncePerRun`,
        );
      if (!hasId) continue;
      if (fixed.has(drop.pickupId))
        throw new Error(`Duplicate pickup ID: ${drop.pickupId}`);
      fixed.add(drop.pickupId);
    }
  }
}

export function validateEnemySeeds(enemies) {
  const fields = {
    lunge: ["triggerTiles", "distanceTiles", "dashDurationSec", "recoverSec"],
    stalk_melee: ["reachTiles", "cooldownSec"],
    ranged_telegraph: ["preferredTiles", "cooldownSec"],
  };
  const validAttack = (type, attack) =>
    Object.hasOwn(fields, type) &&
    attack &&
    ["windupSec", ...fields[type]].every(
      (key) => Number.isFinite(attack[key]) && attack[key] > 0,
    ) &&
    (type !== "ranged_telegraph" ||
      ["projectile", "aoe"].includes(attack.mode));
  for (const enemy of enemies) {
    const type = enemy.seedType;
    if (!type) continue;
    const valid =
      type === "warden_phase"
        ? Array.isArray(enemy.phases) &&
          enemy.phases[0]?.hpThreshold === 1 &&
          enemy.phases.every(
            (stage, index) =>
              stage.hpThreshold > 0 &&
              (index === 0 ||
                stage.hpThreshold < enemy.phases[index - 1].hpThreshold) &&
              validAttack(stage.seedType, stage.overrides?.attack),
          )
        : validAttack(type, enemy.attack);
    if (!valid)
      throw new Error(
        `${enemy.id}: invalid behavior seed or attack parameters`,
      );
  }
}
