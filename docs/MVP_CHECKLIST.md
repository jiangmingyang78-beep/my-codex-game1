# Emberwood: Last Torch MVP Verification Checklist

Use this checklist for browser automation or manual playtesting. The game runs client-side in Phaser 3.90.0 and saves to `localStorage`. Rule systems live in `src/frontend/src/core` and `src/frontend/src/systems`. JSON files under `src/frontend/src/data` are the source of truth.

## 0. Setup

- [ ] Run `pnpm typecheck` and `pnpm fix` from `src/frontend`.
- [ ] Check the developer console for errors at startup and during gameplay.
- [ ] Click **New Game** once to begin.
- [ ] At 1280×720, 1024×600, and 800×600, verify that the HUD, quick bar, and panel text stay readable and do not overlap.

## 1. Main gameplay loop

1. [ ] Start a game near the campfire. Verify the health, fullness, and torch bars and values, the clock and day, Fireside Woods region, and objective with 0/2 Ember Seals.
2. [ ] Approach wood, stone, fiber, and berry nodes. Press E or click the interaction prompt. Verify the pickup notification, inventory increase, and disappearance of each node.
3. [ ] Press E at the campfire or click **Campfire: Craft**. In the original MVP, the panel shows nine recipes. Verify missing materials disable crafting and show the shortfall.
4. [ ] Craft an item such as a Baked Berry Cake. Materials are deducted once, counts update, and crafting and autosave notifications appear.
5. [ ] Craft the Level 2 campfire upgrade. The recipe card shows the level change, the light radius grows, and the panel shows Level 2.
6. [ ] Close the panel and wait for dusk. Check the screen tint, nightfall cue, and campfire light.
7. [ ] Step outside firelight at night to drain torchlight, then return to recharge. Verify night enemies spawn and attack.
8. [ ] Verify autosaves after dusk, dawn, and crafting. Select **Save progress** from the pause menu and verify its confirmation.
9. [ ] Reload and select **Continue Game**. Compare position, health, fullness, torchlight, inventory, campfire level, gathered nodes, defeated enemies, lit braziers, clock, and buffs with the saved state.

## 2. Key interactions

- [ ] **Full inventory.** Fill a material stack and gather again. The game rejects the pickup and keeps the resource node or dropped item.
- [ ] **Old Mill gate.** Press E before the campfire reaches Level 2 and check the rejection reason. Upgrade the campfire, then verify the gate opens and can be crossed.
- [ ] **Bandage at full health.** Press 4 or click the fourth slot. The game reports full health and keeps the Bandage.
- [ ] **Quick slots.** Keys 1–4 and clicking or tapping slots 1–4 behave alike. A stack of zero shows a notice. Quick use is disabled while paused or when a panel is open.
- [ ] **Pause.** Esc and the pause button open the menu with resume, save, sound, and return-to-title actions. Time, hunger, torchlight, and enemy positions stay fixed while paused.
- [ ] **Lost focus.** Switching tabs autosaves and pauses. Resume manually and check that no simulation jump occurred.
- [ ] **Invulnerability after a hit.** Check blinking or translucency, brief damage immunity, screen shake, and hit particles.
- [ ] **Drops.** Defeating an enemy leaves loot in place. Walk over it to collect it. A full inventory rejects pickup without losing the drop.
- [ ] **First Ember Seal.** Defeat the Old Mill guardian and collect the seal. Check the 1/2 HUD objective count, pickup notification, and new camp note.
- [ ] **Relay Brazier.** Craft it after upgrading the campfire to Level 2. Press E at the Old Mill socket. Fire and light appear, the count of available sockets decreases, and it remains lit after loading.
- [ ] **Death or storm.** At zero health, check The Fire Goes Out and the cause of death. After 75 in-game minutes without lighting the beacon, check The Storm Arrives. The summary offers restart and return to title. Death clears the run save but keeps camp notes.

## 3. Saves and recovery

- [ ] Run saves and camp notes use separate run and meta keys.
- [ ] Corrupt the primary save JSON. With no usable backup, Continue Game is disabled and the title reports that a new run started. With a valid backup, it reports recovery and allows continuing.
- [ ] Change `schemaVersion`. The game reports the version problem and keeps running.
- [ ] Disable `localStorage`. The title says progress will not be saved. Gameplay continues, and saving reports failure.
- [ ] Mute is stored in `emberwood-torch:muted` and survives a reload.

## 4. Performance

- [ ] Particle count stays within `particleBudget`: `balance.limits.maxParticles` normally and `reducedMotionMaxParticles` under reduced motion.
- [ ] At 1280×720, check for 55–60 FPS during nights with fire, snow, and several enemies.
- [ ] Play for more than one full night and watch heap usage. Destroyed enemies, drops, and projectiles should leave no steady growth in the Phaser object count.
- [ ] Repeatedly return to title and restart. Check for duplicate listeners, leaked textures, or “key already in use” errors.

## 5. Common failure points

- [ ] **Audio unlock.** No sound or errors before a user gesture. Gathering, crafting, hits, pickups, and nightfall sound after it. Muting silences all cues.
- [ ] **React StrictMode.** The development build leaves one Phaser canvas after mounting and destroys the game on unmount.
- [ ] **Storage exceptions.** Read and write failures should leave the main loop usable.
- [ ] **Large frame delta.** Resuming a background tab or dropping frames caps delta to 0.1 seconds in the scene and `maxStepSec` in the core, preventing sudden loss of health or fullness.
- [ ] **Stale input.** Clicking buttons removes focus so Space and E cannot retrigger them. Keys pressed while paused do not replay after resuming.
- [ ] **Resize.** Integer camera scaling keeps pixels sharp. The camera follows the hero and stays within map bounds.

## 6. Original MVP limitations

- Art used runtime-generated placeholder sprites and terrain. The initial scope excluded a formal Tiled map and hand-drawn atlas.
- Web Audio synthesized the placeholder sounds without bundled audio files.
- The original 30-second development shortcut was pending. Day and night lengths use `daySec` and `nightSec` from `balance.json`.
- The Ice Gorge, Ridge Beacon, final guardian, and beacon victory were outside the initial MVP.
- The campfire panel had no sleep action. Autosave triggers were dusk, dawn, region changes, crafting, campfire upgrades, and hiding the tab.
- The initial version supported touch on quick slots and buttons. Touch movement and attack controls were outside that scope.

## 7. v3.2.0 Survival art regression

- [x] In Chrome with seed 2048, checked grass, rock, and ice shoreline textures, animated water, and ice edges.
- [x] Checked four growth states from saves. Harvested mature wheat with E and observed the drop notice.
- [x] Checked fence lines, corners, and both gate orientations. Opened an east-west gate and verified it remained open after reload.
- [x] Checked pause, resume, mode menu, inventory, technology tree, world switching, and vein selection.
- [ ] Walk shoreline corners across several seeds. Inspect seams after removing a neighboring fence, and verify passage through a north-south gate.

## 8. v3.2.0 Livestock, mineral icons, and trees

- [x] Fed a hen and sheep. Verified both feeding poses, freezing on pause, continuing on resume, and returning to idle.
- [x] Verified distinct 12×12 icons for Coal, Quartz, Copper Ore, Clay, Iron Ore, Frost Crystal, and Rock Salt, consistent in the inventory and on the ground.
- [x] Verified separate wetland, tundra, and fungal forest tree sprites in seed 2048. The fungal forest test used streamed terrain.
- [ ] Play through the full feeding-to-egg or wool cycle and inspect canopy sway at different wind speeds.

## 9. Survival rain impacts

- [x] A rainy seed 2048 save showed water ripples, rock splashes, wet grass, and highlights on ice in the same viewport.
- [x] Impacts froze on pause and resumed afterward. Reduced motion drew fewer impacts, and a clear-weather reload showed none.
- [ ] Play along a shoreline and near the campfire at night to check the effects.

## 10. Plant growth and fence previews

- [x] Three saved growth stages showed nine distinct silhouettes for Snowberry, Ice Bog Reed, and Frost Fungus. Harvesting restored seedling art and reset growth to 0 in the save.
- [x] Horizontal and vertical gate previews differed. Occupied tiles showed a blocked preview and refused construction. Vertical gate and connected fence art matched their previews.
- [ ] Playtest touch previews, drag-to-build, and natural growth transitions.

## 11. Dusk warnings, camp repairs, and landmarks

- [x] Walked through dusk and a two-wave raid in Chrome. Checked dimming, countdown, next-wave notice, and the no-more-waves notice. Leaving the 18-tile range hid beacon protection. Unit tests cover one wave and skipped nights.
- [x] Loaded a save without the new fields, contributed part of the well materials, and reloaded to verify progress. After completing the repairs, checked three decorations and that excess Wood stayed in inventory.
- [x] Filled the can manually before repairs and automatically near the restored well. Sleeping in the camp bed consumed 6 fullness. The camp hen yielded 3 eggs.
- [x] Placed and updated a landmark, selected it, checked direction and distance arrows outside the map range, deleted it to fall back to camp, and verified independent persistence after world switching.
- [x] Chrome touch emulation at 375 px covered marker placement and map controls, and Adventure started. Type checks, formatting, build, and 64 unit tests passed in that round.
- [ ] On a real phone, gather during daylight and defend through the night. Check the repair material curve and return-to-camp directions after dark.

## 12. Survival saves, encounters, and weather

- [x] Ran the `origin/v1` archive to create a legacy-layout save and loaded another cached legacy save with seed 1055306422. Both disk saves used format 8. Verified player, inventory, buildings, tilled ground, and dropped loot. The same archive save produced matching 50×32 terrain in both versions.
- [x] Created a version 2 world fixture with seed 23456. Loaded it through the normal entry point and verified player position, inventory, and 50×32 terrain, with an empty encounter list.
- [ ] Obtain original player saves for world version 2 and save formats 1 and 2.
- [x] Seed 42 exercised eight templates covering caches, traps, ambushes, and healing. After a reload, loot could be collected from the ground. Retrying after another reload granted no new items, trap damage, or spring healing. Ambush health persisted on reload, defeated enemies stayed gone, and living ambushers persisted across world switching and dawn.
- [x] Seed 3 entered White Abyss Blizzard and seed 4 entered Black Fog. Weather transitions survived reload. Time acceleration only approached the transition, while normal browser frames measured the transition and fullness. With `coldHungerPerSecond=1`, blizzard drain was 0.30 inside a heat source and 1.30 outside. Black Fog and the default blizzard both used 0.30 inside and outside.
- [x] The [November 27 screenshots](../tmp-visual-audit/survival-retest-2026-11-27/) cover eight encounters and the ambush before and after the fix. The earlier 82 screenshots were retained.

## 13. Winter phases, raids, and camp defenses

- [x] Unit tests cover day rollover, cold fronts, three phases, seeded scheduling, three warnings, wave budgets, watch beacon angles, prerequisites, windbreak fuel savings, auto-feeding hearths, and one-time dawn rewards.
- [x] A seed 42 save entered dusk in Chrome. The clock changed and the return-to-camp cue appeared. Day 2 warnings appeared around 40, 16, and 6 seconds. Seven enemies spawned after entering the long night, and surviving enemies restored after saving and reloading.
- [x] Fueled the hearth and completed all six facilities across four tiers. Used the inventory to make charcoal and medicine and consume a Warming Herb Pouch. Tier 4, fuel, products, and cold resistance expiry persisted on reload.
- [x] Moved remaining raiders onto the Stake Trap strip at just enough health for the finishing hit. Verified the trap repelled them and dawn awarded 5 Ember Dust. A reload kept the settled amount.
- [x] The production build displayed seven raiders and the T4 aura at 390 px without horizontal page overflow. Offline audio rendering covered dusk and all three raid cues, which increased in RMS amplitude.
- [x] From a fresh seed 42 save, used ordinary keyboard and mouse play to gather, craft, and defend. Both T4 facilities were complete by day 4. The balance report records overnight fuel use and the first return-to-camp warning.
- [ ] Check that phone speakers distinguish wind howls and low growls during play.
