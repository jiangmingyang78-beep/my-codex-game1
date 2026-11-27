// The console protocol addresses two documents; both edit the same physical table.
export function enemyDocuments(catalog) {
  return {
    "enemies.json": { enemies: catalog.enemies.filter(enemy => enemy.seedType) },
    "legacyEnemies.json": {
      enemies: catalog.enemies.filter(enemy => !enemy.seedType),
      encounterRewards: catalog.encounterRewards,
    },
  };
}
export function mergeEnemyDocuments(documents, original) {
  const legacy = documents["legacyEnemies.json"];
  const rows = [...documents["enemies.json"].enemies, ...legacy.enemies];
  const byId = new Map(rows.map(enemy => [enemy.id, enemy]));
  return {
    // Fixed catalog IDs are checked by validateDraft. Preserve physical row order.
    enemies: original ? original.enemies.map(enemy => byId.get(enemy.id)) : rows,
    encounterRewards: legacy.encounterRewards,
  };
}
