# Emberwood Map and Balance Console

From the repository root, run `pnpm map` and open the local address printed in the terminal. The map tool and the game start separately. Only the map tool's Vite development server exposes file writeback. The game remains client-side and stores player saves in `localStorage`.

## Controls

- Adventure uses the game's map generator. Press 1 to select, 2 to place a resource, 3 to place a resident enemy, 4 to move a point, or 5 to delete. Scroll to zoom at the cursor, double-click to center, and middle-drag or use WASD to pan. Red outlines mark blocked tiles.
- Select an entry in the point dropdown to locate it. Select an enemy and open Enemy Tuning. Sliders update the metrics and canvas live and record one history entry when released. Bosses have a phase preview. Hero Tuning shows the attack arc and Level 3 campfire radius at the spawn point.
- Ctrl+Z undoes changes. Ctrl+Y or Ctrl+Shift+Z redoes them. History holds 50 steps. Presets contain eight configuration documents. Import validates the version, structure, references, and map points. The item catalog is read-only.
- **Review diff and save** shows each path, baseline, and draft by file. Use ↺ to revert one change. **Save and check balance** shows the same review, then presents time-to-kill rankings, alerts, and material supply and demand after saving.
- Run state and saves retain collection and defeat progress. Reload the game and start a new run to check a map edit from scratch.

## Field mappings

| Panel or metric | File and fields | Units and behavior |
| --- | --- | --- |
| Resource points | `worldOverrides.json`: `addedObjects`, `removedObjectIds`, `movedObjects`, `editedObjects` | Uses `id`, `tx`, `ty`, `itemId`, `yield`, and `renewable`. Adding and moving clamp coordinates to the map, convert to tile-center pixels, and update both `objects` and `objectList`. |
| Resident spawns | `addedSpawns`, `removedSpawnIds`, `movedSpawns`, `editedSpawns` in the same file | The point ID is the world spawn ID. `enemyId` selects the enemy and `regionId` is derived from the new location or set explicitly. The runtime resident roster updates. |
| Active limits and renewable items | `balance.json`: `limits.activeEnemies`, `limits.activeProjectiles`. `regions.json`: `dawnRenewal.renewableItemIds`. | On-screen caps and IDs of items that can regrow at dawn. |
| Regional spawns | `regions.json`: `regions[].residentSpawns[]`, `nightSpawns[]` | Uses `spawnId` and `enemyId`. Map overrides update residents, and the rules panel edits night composition. |
| Enemy stats and loot | Console documents `enemies.json` and `legacyEnemies.json`, saved together in `enemies.json`: `enemies[].maxHp`, `attackDamage`, `moveSpeedPxPerSec`, `drops[]` | Health, damage per hit, pixels per second, and drops with `itemId`, `count`, and `probability`. |
| Melee and lunges | `attack.reachTiles`, `triggerTiles`, `distanceTiles`, `windupSec`, `cooldownSec`, `dashDurationSec`, `recoverSec` | Tiles and seconds. A lunge cycle consists of wind-up, travel, and recovery without an additional melee cooldown. |
| Ranged and legacy attacks | `attack.preferredTiles`, `radiusTiles`, `projectileSpeedPxPerSec`, `projectileLifetimeSec`, `triggerRangeTiles`, `rangeTiles`, `arcDegrees`, `activeSec`, `travelSec`, `recoverySec`, `intervalSec` | Cast range, burst radius, projectile speed and lifetime, sweep, and attack timing. Each enemy shows the fields it uses. |
| Phases and alternating attacks | `phases[].hpThreshold`, `phases[].overrides.attack`, `attack.moves[]`, `attack.enrage` | Phase DPS weights health portions. Alternating moves use average duration. Enrage contributes according to its health threshold. |
| Global hero stats | `balance.json`: `hero.moveSpeedPxPerSec`, `attackDamage`, `attackRangeTiles`, `attackArcDegrees`, `attackCooldownSec` | Pixels per second, damage, tiles, degrees, and seconds. |
| Survival and firelight | `stats.hp.initial/max/damageImmunitySec`, `stats.hunger.dayDrainPerMinute/nightDrainPerMinute`, `stats.light.nightDrainPerSec`, `camp.radiiTilesByLevel` | Health, immunity seconds, fullness per minute, torchlight per second, and level-based radii. |
| Five heroes | `heroes.json`: `heroes[].traits` and `startingInventory` | Edits each hero's actual modifiers. Starting inventory maps item IDs to positive integer counts. |
| TTK, DPS, and hits survived | Enemy and hero stats above, plus effects for `iron_spear`, `iron_blade`, and `iron_armor` in `items.json` | First hit is at time zero. TTK is (hits − 1) × attack interval. Survivability counts peak attacks the hero can take and remain alive. Hero DPS includes starting equipment. |
| Independent wave settings | `encounters.json`: `waves.intervalSec/count`, `resources.renewalLimit/cooldownSec`, `weights[regionId]` | First wave at dusk. Later waves use game seconds and respect the on-screen cap. Weight multiplies regional night spawns. Fractions round deterministically by day and wave. |
| Per-node renewal | `worldOverrides.json`: `renewalLimit`, `respawnCooldownSec` | Per-node limits and cooldowns take precedence. With defaults, renewable resources refresh at dawn without a cap. |
| Range and dash settings | `encounters.json`: `perception.aggroTiles/leashTiles`, `dash.distanceTiles/cooldownSec` | Blue-gray rings show resident detection and leash range. Raiders use pursuit rules. The default dash scales with movement speed. An explicit distance uses tiles and still checks collision. |
| Standalone Survival overrides | Optional values in `public/survival-balance.json`. See the README. | The Survival page merges these with `balance.json` at startup. Density changes procedural mineral and wood tiles, frequency changes nightly wave count, and starting supplies apply to new worlds. |

Fixed point overrides apply to procedural Adventure. New Survival worlds and the console share a 16×16-chunk generator. Hover to inspect the biome and features. The landmark layer shows reserved encounter areas and the spawn layer shows wildlife dens. A new world's resource density saves with the seed, so the same pair reproduces the layout. Older saves retain their terrain algorithm.

## Architecture review

- World generation and rendering are separate. The Adventure adapter shares the game's `applyWorldOverrides`, which returns its input for empty overrides. A separate `WeakMap` retains original resident definitions to keep default coordinates available across regeneration.
- `ConsoleStore` keeps the baseline and draft. Reversible commands cover both map and field edits. Panels submit commands and metrics are pure functions. Editing a point does not repaint the cached terrain canvas.
- The server resolves targets from an allowlist and rejects links, cross-origin requests, and unknown files. It reuses structure, reference, and blocked-tile checks. Each file uses a same-directory temporary file and atomic rename, verifies its disk baseline, and keeps any uncommitted draft if writing fails.
- The balance check invokes the existing script with `execFile` and passes the resolved resources and spawns. The economy summary includes manual overrides. The default summary mode leaves the report file alone. Sending `{"full":true}` runs full mode.

## 30-second tuning check

| Action | Headless Edge result |
| --- | --- |
| Place one Iron Ore, undo, and redo | Adventure tile (18, 26), with a unique ID and the same object restored on redo. |
| Adjust the Rotten Woodcutter's attack interval | 0.85 → 1.35 seconds. Enemy DPS 0.87 → 0.61. Hero still needs four hits. |
| Adjust melee reach and health | Reach 1.2 → 2 tiles changed canvas pixels. Health 4 → 5 changed unarmed TTK from four hits / 1.26 seconds to five / 1.68 seconds. |
| Preview diff, save, and check balance | Two files and four edits passed validation. Fixed ore rose from 16 to 17. The API returned material and TTK results. |
| Reload, start a new game, and press E | The object appeared at pixel (296, 424), the attack interval was 1.35 seconds, and the screen showed one Iron Ore collected. |

Automation took about four seconds from both pages being ready to in-game gathering. After testing, the original balance data and empty overrides were restored byte for byte. The temporary server and browser were closed.

## Verification checklist

- [x] Type checks, Biome, production build, separate console type check, and console Vite build.
- [x] `node tools/map-viewer/verify.mjs` covers clamping, resident registration, cross-region moves, original layout retention, references, blocked tiles, history limits, and restoration.
- [x] Generation matched the prior HEAD across 23,040 tiles, 104 world objects, 38 spawns, regions, gates, and player spawn.
- [x] Checked the four APIs, eight baselines, copy validation, invalid structures, unknown files, and stale-baseline conflicts. Both tested writes used two-space indent and a final newline.
- [x] Verified three modes, four tabs, shortcuts, live sliders, preset round trips, field resets, and a 1440 × 576 Adventure panorama PNG.
- [ ] Playtest each enemy's hits, pursuit, complete raids, and long-term material balance.
- [ ] Headless Edge reported a closed AudioContext after hot reload in the game dev server. A manual reload and new run gathered successfully. The console page showed no runtime errors.

## Runtime comparison

Run `node tools/map-viewer/verifyRuntime.mjs` for frame-by-frame Adventure checks. The comparison changes configuration only inside the test process.

| Case | Baseline → modified |
| --- | --- |
| Lin dashing on flat ground | 1.88 tiles / 1.6 seconds → 3 tiles / 2 seconds |
| Current and legacy enemies | Detection 8 → 11 tiles, so an enemy at 10 tiles switched from idle to pursuit. Leash 16 → 12, so an enemy at 13 tiles switched from pursuit to idle. |
| Camp raid | One wave of two by default. Two waves spawned four. Reducing the second wave interval from 0.25 to 0.1 seconds made it arrive sooner. Weight 1 → 0.5 reduced the first wave from two to one. |
| Regrowth | Defaults regrew at two consecutive dawns. With a global 10-second cooldown, no refresh at 9 seconds. A node override of 2 seconds and one renewal refreshed at 2 seconds after reload and stopped after the second harvest. |
| Historical Survival generator, headless Edge | Seed 42 with three multipliers 1 → 2. Resource tiles 285 → 546, starting Wood 3 → 6, and waves while idle 1 → 2. Probes loaded only in browser test responses. |

Resource timers use elapsed game time and pause with the game. Fixed roads, guaranteed camp supplies, and story terrain take precedence over resource density. Adventure data changes require a new production build. Survival reads its public JSON at page load.
