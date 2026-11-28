# Emberwood: Last Torch Architecture Review

The initial MVP review covered `GDD_AND_SPEC.md`, `MVP_HANDOFF.md`, `src/data/*.json`, `tools/validate-mvp.cjs`, and `src/vfx/*.js`. The validation script passed for 15 items, 9 recipes, 5 enemies, 4 regions, 2 fixed rewards, and VFX imports. It checked references. The findings below came from reviewing the documentation, JSON, and VFX source. Paths are relative to `src/frontend/src/` unless stated otherwise.

## 1. Inconsistencies and fixes

| # | Issue | Resolution | Location |
| --- | --- | --- | --- |
| 1 | The GDD described Vite and plain JavaScript. The project uses React 19 and strict TypeScript, and seven JavaScript VFX modules did not conform to the lint settings. | Enable `allowJs`, disable `checkJs`, retain `resolveJsonModule`, and exclude `src/vfx/**` in Biome. Preserve the VFX code and public signatures. | `tsconfig.json`, `biome.json` |
| 2 | The handoff documented `step(state, {sec,input,frame,commands}, systems)` without defining the `createRun(config, snapshot?)` config. | Use `step(state, request, systems?)`, defaulting to `getSystems()`, and `createRun(config?: {systems?, seed?, runId?}, snapshot?)`. Validate and clone snapshots first. | `core/run.ts`, `core/systems.ts`, `core/types.ts` |
| 3 | The GDD called a system function `inventory.use`. React hook lint treats names beginning with `use` as hooks and rejects conditional calls. | Rename it to `consumeItem`. The command type remains `use`. | `systems/inventory.ts`, `core/commands.ts` |
| 4 | The `snowland.json` map and Tiled atlas were missing, and region object IDs and spawn IDs needed coordinates. | Generate a seeded 96×64 collision and terrain grid containing `camp_edge` (x 0–47) and `old_mill` (x 48–95, y 0–47). Take object IDs from `regions.json` and centralize coordinates in `worldLayout.ts`. This is the layer to replace when introducing Tiled. | `systems/world/worldLayout.ts`, `systems/world/worldGen.ts` |
| 5 | `regions.json` includes `ice_gorge_relay`, which was outside the initial map and would inflate the unlit socket count. | Count sockets that exist in the current world for recipes and firelight. | `systems/crafting.ts` (`unlitRelaySlots`), `systems/campCircle.ts` |
| 6 | Stored day and phase values could conflict with `elapsedSec`. | Derive both values from `elapsedSec` and recompute them when loading. | `core/clock.ts`, `core/snapshot.ts` |
| 7 | Hunger used per-minute tuning while other stats used seconds. | Convert hunger to a per-second rate, preserving fractional values in state. | `systems/survival.ts` |
| 8 | Hits, hunger, and darkness share 0.65 seconds of invulnerability. The GDD did not say how to handle blocked hunger or darkness ticks. | Keep the timers when invulnerability blocks hunger or darkness damage and retry on the next frame. | `systems/survival.ts` (`damageHero`) |
| 9 | The end-state rule gave death priority but did not cover death and a storm timeout in the same frame. | Check HP ≤ 0 before `elapsedSec ≥ runLimitSec`. Stop stepping after the run ends. | `core/run.ts` (`checkEnd`) |
| 10 | Event `x` and `y` can be null, and VFX throws on invalid coordinates. | Return null from `toVfxEvent` for missing or nonfinite positions. Map `camp.upgraded` to an ignition burst. | `core/vfxBridge.ts` |
| 11 | Camp notes needed idempotent end-of-run handling by `runId`. | Store up to 20 `settledRunIds` and award notes once per `runId`. Save notes under an independent `metaKey`. | `core/meta.ts` |
| 12 | Invalid versions, corrupted saves, and unavailable storage needed distinct messages. | `loadRun` returns `empty/ok/recovered_backup/fallback_new/unavailable` with a player notice. It tries a backup on primary failure. Before writing, `saveRun` copies a valid primary to the backup key. A failure preserves the last good save. | `core/save.ts`, `core/storage.ts` |
| 13 | Fixed loot such as Ember Seals must remain on the ground when the inventory is full. | Store each `pickupId` under `changesByObjectId[...].loot` with `pending` or `picked`. `seals` records collected pickup IDs and reconstructs the `ember_seal` stack on load. | `systems/combat/loot.ts`, `core/snapshot.ts` |
| 14 | Night raid IDs were described as depending on wave and spawn point. | Use `night{round}_{spawnId}`, save `nightRound`, and remove the units listed in `nightRaid.spawnedIds` at dawn. | `systems/combat/enemySpawn.ts` |
| 15 | A map change or edited save can leave the hero inside a solid tile. | Validate finite, in-bounds coordinates. Reset a hero on a solid tile to `heroStart`. | `core/snapshot.ts` |
| 16 | Invalid item quantities, health, or timers in saves could corrupt the run. | Validate numeric bounds and finiteness. Treat an invalid save as corrupted. Item IDs must exist and quantities cannot exceed `maxStack`. | `core/snapshot.ts` |

## 2. Edge cases covered

- A full inventory rejects gathering, reports why, and keeps the resource node available. See `pickUp` in `systems/inventory.ts`.
- Using a Bandage at full health rejects the action without consuming it. See `consumeItem` and `requiresBelowMax`.
- Crafting with missing ingredients reports the shortfall for each ingredient and consumes nothing.
- Unique equipment such as the Iron Lantern and Iron Spear can be crafted once. The number of Relay Braziers is limited by unlit sockets.
- Reusing Warm Frostcap Stew refreshes its duration. Its torch drain multiplier combines with the lantern's multiplier.
- `core/clock.ts` clamps negative, NaN, and oversized step durations to `[0, maxStepSec]`.
- The Old Mill gate requires a Level 2 campfire. The stable reason code is `camp_level_too_low`, which `reasonMessage` displays to the player.

## 3. Performance considerations

| Area | Observation | Handling |
| --- | --- | --- |
| Particle budget | Reduced motion has a hardcoded `Math.min(30, maxParticles)` independent of `balance.limits.reducedMotionMaxParticles`. The shock ring cap equals `maxParticles`, up to 120 rings. Ambient particles are capped at `min(150, 60%)`. | `particleBudget(data, reducedMotion)` in `core/vfxBridge.ts` keeps the scene limit consistent without changing the VFX interface. Scenes also cap events per frame. |
| Shock ring array | `rings.shift()` on overflow costs O(n). | The 120-ring bound is acceptable for the MVP. |
| Canvas texture cache | `setBounded` defaults to a first-in, first-out cap of 256 entries. Eviction does not release textures registered with Phaser. | Generate only needed textures at startup and call `fx.destroy()` when the scene ends. |
| Per-frame allocations | `step` creates an input object only when omitted. Collision reuses its output object. Enemy iteration uses `for...in`. `buildHudModel` allocates. | Reuse the scene request and refresh the HUD at about 10 Hz. |
| Active entities | The initial limits were 8 enemies and 12 projectiles. | Night spawns and projectiles check `balance.limits` in `enemySpawn.ts` and `enemyAi.ts`. |
| Step size | Simulation steps cap at 0.05 seconds, so the game clock slows below 20 FPS. | This matches the GDD's behavior during stalls. |
| File length | The GDD capped files at 299 lines. | The longest MVP file was `core/snapshot.ts` at 272 lines. |

## 4. MVP limitations and assumptions

- The initial MVP had no development switch for a 30-second day/night test. `RunConfig` did not expose a clock multiplier.
- The Ice Ram, Coal Shade, and Beacon Keeper were loaded but placed outside `camp_edge` and `old_mill`.
- `legacyAssetReferences` is migration reference data. The old `outputs/Emberwood.html` was missing from the handoff archive, so its references could not be checked. New runs use the new IDs.
- `core` and `systems` cross-reference types, such as `RunState` and `World`, without runtime import cycles.
- The procedural grid stood in for `snowland.json`. `createTileTextures` generated terrain art, and `worldLayout.ts` defined coordinates.
- Procedural textures and simple geometry stood in for the character, enemy, item, and icon atlas.
- Sound synthesis used the `GameEvent` stream because the original handoff included no audio files.
- Rule systems return stable reason codes. `reasonMessage` maps them to the current English interface.

## 5. Survival shorelines and camp art

- Shorelines select pixel patterns from adjacent water, diagonal water, and biome. World changes clear terrain caches, while shoreline patterns can be reused between worlds.
- Wheat chooses one of four textures from saved growth. Fences connect to cardinal neighbors, and gates use their open state and neighboring fences. The combined fence and gate cache holds at most 48 textures.
- The Survival entry point generates both sets of textures through the pixel drawing functions. Terrain seeding, growth progress, collisions, and save fields keep their existing rules.
- Wetland, tundra, and fungal forest trees have roots and three canopy layers. Draw the pattern once, then apply mirror and height variants and wind offsets during rendering.
- Livestock feeding frames use the existing remaining feed time. Pausing freezes animation, while cooldowns and yields stay in the normal update path.
- The seven mineral icons and rock textures share the palette in `survivalRockArt.json`. Inventory, quick slots, pickup notices, and ground drops share item textures.
- The weather layer reports screen coordinates when selected raindrops hit the ground. Survival maps them to world coordinates and terrain materials. It retains at most 32 impacts, clips them to their tiles, and draws them before characters and lighting.
- Snowberry, Ice Bog Reed, and Frost Fungus use their mature palettes for seedling and intermediate textures. Saved growth selects the texture, and harvesting resets it to the seedling stage.
- Fence and gate previews use the same tile, occupancy, and material checks as construction. The preview uses the build texture for the target tile's neighbor mask and updates when adjacent structures change.

## 6. Survival night raids and camp projects

- At dawn, the current Survival day and weather set the three phase boundaries. The clock, terrain colors, farming, sleep, and raids share them. The default cycle is 192 seconds, and existing saves retain their original timeline for days survived.
- The world seed chooses raid days and whether arrival is at nightfall or midnight. Material contributions determine camp tier. Tier, day, and weather set the wave budget. The director records warnings, pending spawns, and living enemies. Candidates must be outside the viewport, reachable from the camp, within category capacity, and eligible under lighting rules. Lit Watch Beacons block their approach direction.
- Repelling a full wave marks its reward pending. Natural dawn and sleep use the same resolution. Ember Dust and the next raid schedule save together. Dawn removes remaining raiders if the wave was not cleared. Hearth Ash contributes to tier 3 and 4 facilities.
- `survivalCampProjects.json` defines three repairs and four camp defense tiers. Defenses accept partial contributions by the campfire. Weather affects hearth use. Lighting, heat, camp UI, decorations, and gameplay benefits share the resulting completion state. At the research table, each contribution is limited by missing materials and stock. A restored well automatically fills an equipped watering can within two tiles. Manual refills at wells and ponds remain immediate.
- `campProjects`, `landmarks`, and `landmarkTarget` save with the world. Older saves use defaults. Vein, crossing, and camp markers use world coordinates, with one marker per tile. Campfire Camp is a built-in target. Direction arrows and markers draw over the cached terrain minimap.

## 7. Survival encounter ambush persistence

- Revisiting a save after triggering a Shadowed Stone Circle revealed that surviving ambushers disappeared on reload. Save format 8 adds optional `survival.encounterEnemies`, keyed by encounter and entity index, with position and health. Loading restores surviving enemies from the current template for spent encounters and validates their health and coordinates.
- On defeat, a new save records both the ground loot and the removed ambusher. Raid cleanup leaves living ambushers in place. Older explored saves without the field continue to load with empty ambush state.
