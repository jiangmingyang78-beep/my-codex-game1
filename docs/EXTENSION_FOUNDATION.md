# Emberwood Extension Foundation

This extension uses `src/entities/enemySeeds.js` from A1.txt as a behavior reference. Run it through this project's Phaser/Vite frontend. The Snow Weasel uses the existing JSON values, rule phases, and combat events.

| Source | Gap | Resolution |
| --- | --- | --- |
| A1 behavior seeds | `context.tileSize ?? 16` and optional callbacks can hide missing wiring. | The core lunge explicitly receives tile size, movement, and hit callbacks. |
| A1 ranged enemies and guards | `" reposition"` does not match its update branch. The child seed's `init` writes to a shallow copy. | Verify first-frame behavior and transitions before integrating either behavior. |
| Original `worldGen.ts` | A single gate, a single fire station, and hardcoded resource filters made additional regions difficult. | The generator reads regional layouts, terrain, gates, fire stations, and resource rules. |
| Original `enemyAi.ts` | The Snow Weasel's lunge shared a branch with generic AI. | Dispatch attack seeds by `attack.type`. The AI still manages shared phases. |
| Original saves | v1 required an exact version match. Fixed loot markers and map changes shared a dictionary. | v2 migrates v1 and matching unversioned saves. `collectedPickups` and `groundLoot` track claimed and unclaimed loot separately. |

## Interface template for DeepSeek

```text
The target is my-codex-game1/src/frontend. Preserve existing IDs, event payloads, and public src/vfx interfaces.
Prefer configuration changes and reuse existing systems. Document effects on IDs, events, and saves, plus player verification steps.

Add a region
- Set map dimensions and tile size with world.widthTiles, world.heightTiles, and world.tileSizePx in data/balance.json.
- Set id, entry, residentSpawns, nightSpawns, encounterId, and relaySocketId in data/regions.json.
- Set bounds and terrain in WORLD_LAYOUT.regions in systems/world/worldLayout.ts.
- Bounds use inclusive tile coordinates. Terrain layers apply in order. Use a TILE key for tile.
- Set the spawn tile in WORLD_LAYOUT.spawns[spawnId]. Spawn IDs must be unique and enemyId must reference a registered enemy.
- Set collision tiles in gate.tiles and the interaction position in gate.interactAt. Half tiles are allowed. The gate ID comes from entry.gateId.
- Set the fire-station tile in relay, using relaySocketId as the ID. Set idPrefix, itemId, count, and yield for nodes.
- Preserve existing placements and stable IDs when appending layouts. Check access, gates, and resource counts.

Add an enemy variant or seed
- Set id, regionIds, maxHp, attackDamage, moveSpeedPxPerSec, attack, and drops in data/enemies.json.
- The Snow Weasel uses attack.type lunge with triggerRangeTiles, windupSec, distanceTiles,
  travelSec, recoverySec, and intervalSec. Distances use tiles, time uses seconds, and coordinates use world pixels.
- Add data when reusing an attack type. For a new attack, extend AttackMove and register attackSeeds.
- A seed runs update(enemy, dt, player, context). Context supplies move, tileSize,
  contactRadiusPx, moveBy(dx,dy), and strikeHero(). Generic AI manages wind-up, recovery, and events.
- Set itemId, count, and probability for drops. Fixed rewards use a unique pickupId and oncePerRun: true.

Add a recipe or item
- Set id, name, stationId, minCampLevel, inputs, output, and optional constraints in data/recipes.json.
- Output uses {type:"item",id,count} or {type:"camp_level",level}.
- Set id, name, type, maxStack, effects, and description for new items in items.json.
- Register new regions, enemies, recipes, and items in data/catalogDefinitions.json.
- Use existing inventory and crafting systems. Test missing ingredients, full stacks, successful crafting, and reloading saves.

Saves and events
- Register migrations per version in core/saveMigration.ts. v2 stores claimed fixed IDs in collectedPickups
  and pending pickups in groundLoot. seals still gates Ember Seals, and changesByObjectId records map changes.
- Events use {type,x,y,payload}. Consume them after the rule step, and connect presentation through the VFX bridge.
```

## Player verification

1. Start a run, gather and craft, then pass the mill gate after upgrading the campfire to level 2. Check material deductions, gate collision, and position.
2. Fight a Snow Weasel and move sideways after its wind-up. Check lunge direction, a single hit, recovery, hit audio, and particles.
3. Continue from a v1 save, collect the pending Ember Seal, save, and reload. Check that the fire, gate, inventory, and seal restore and that the reward appears once.
