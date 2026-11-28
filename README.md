# Emberwood: Last Torch

Emberwood: Last Torch is a top-down pixel-art survival adventure you can play in your browser. Gather resources in the snowy woods, upgrade your campfire, and venture into the Old Mill to recover the Ember Seal.

## About Me

I have a deep love for video games—they have given me the courage to face life. In the past, I often wrote game reviews and impressions, though that was as far as I could go. Now, AI has empowered me to finally try creating something of my own. What I want to pass on is the boundless joy I felt the very first time I played Minecraft.

## Versions

- **First version (v1.9.0)** · *Emberwood: Pixel Adventure* ships as a single HTML file. [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v1.9.0) · [Source branch](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v1) · [Play on Caffeine](https://emberwood-visual-effects-m6k.caffeine.xyz/)
- **Second version (v2.0.0)** · *Emberwood: Last Torch* uses Phaser 3.90.0 and Vite and is developed on `main`. This MVP covers the snowy woods and the Old Mill and saves progress in the browser’s `localStorage`. [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v2.0.0)
- **Third version (v3.0.0)** · [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v3.0.0)
  - **Eternal Mode** takes place in a compact 32×32 campfire arena. You have 20 seconds to set up your loadout using a standard allowance or free selection. Standard loadouts get another chance to choose gear every 90 seconds. Enemy spawns use a credit budget that grows faster as combat progresses, three bosses rotate at 120-second intervals, and the mode tracks its own personal best between runs.
  - **Hero animations** use a hybrid rendering pipeline configured in `heroSprites.json`. Lin has 128×128 sprites with 16-frame idle, walk, attack, dash, hit, and knockdown animations. The other heroes use procedurally generated textures.
  - **Hero portraits** feature 128×128 pixel art for all five heroes. Nearest-neighbor scaling keeps the pixels crisp. Unlocked heroes appear in full color and locked heroes appear in dimmed grayscale.
  - **Redesigned title menu** features a Stardew Valley-inspired cycle of seasonal lighting and weather, with Adventure Mode and Survival Mode side by side. Select Adventure Mode to choose a hero and access New Game, Continue, and Eternal Mode.

- **Adventure expansion (v3.1.0)** · [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v3.1.0)
  - **Expanded Adventure Mode** spans ten regions, including the starting camp, on a 240×96 map. It adds bogs, explosive resin barrels, mirror lamps, story relics, and new enemy behaviors.
  - **Save migration** moves characters, enemies, and uncollected loot from the old map into the expanded world while preserving progress.
  - **Map and development tools** include an LDtk adapter, a balance report, and a sprite workbench. The game uses its built-in map by default.

- **Combat feedback and atmosphere (v3.2.0)** · [Version tag](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v3.2.0)
  - Adds enemy attack warnings, hit feedback, slash arcs, and dash afterimages to the main battle scene.
  - Adds flickering torchlight, drifting embers, a low-light vignette, and snow-only footprints. Chinese combat and loot toasts use a bundled pixel font.
  - Centralizes render depths and adds a shared unit-test entry point with `npm test`. Existing saves retain their format.

- **Shared spatial runtime (v4.0.0)** · [Version tag](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v4.0.0)
  - Adventure, Survival, and Eternal modes share line-of-sight checks, local pursuit pathfinding, and spawn-point validation.
  - Survival Mode adds camp projects, cold fronts, and raid warnings. See the [spatial runtime report](docs/SPATIAL_RUNTIME.md) and [Survival balance report](docs/BALANCE_REPORT.md).

## Run Locally

Use Node.js 22.12+ or Node.js 24 and the project’s pinned pnpm version, 10.26.1. Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm --dir src/frontend dev --host 127.0.0.1 --port 5173 --logLevel info
```

Open the [local development page](http://127.0.0.1:5173/). Use WASD or the arrow keys to move, E to interact, Space to attack, and Esc to pause.

```sh
pnpm typecheck
pnpm build
```

The production build is written to `src/frontend/dist/`.

## Survival Mode and data validation

The title screen and pause menu open Survival Mode at `src/frontend/survival.html`, which Vite builds as a separate entry point. The inventory catalog and recipes live in `src/frontend/src/data/survivalCatalog.json` and `src/frontend/src/data/survivalRecipes.json`. Adventure and Survival use separate item IDs. For example, camp projects use `wheat` from the Survival inventory.

At startup, the game checks JSON fields, indexes records by ID, and validates references, quantities, and drop rules. Configuration errors identify the file and field path, such as `regions.json.regions[0].residentSpawns[0].enemyId`. Enemy definitions and encounter rewards live in `enemies.json`. The map console supports editing enemies through its two existing document names.

Survival defaults live under `survival` in `src/frontend/src/data/balance.json`. Edit `src/frontend/public/survival-balance.json` and reload Survival Mode to apply your changes. Include only the fields you want to override. If the request fails, the JSON is malformed, or any field is invalid, the game uses the defaults. Run `node tools/balance-report.mjs --summary` to see the effective day and night durations, hunger rates, resource respawn intervals, and enemy spawn settings.

| Override field | Survival rule |
|---|---|
| `dayDurationMultiplier`, `nightDurationMultiplier` | Scale the default 120-second day and 72-second night, respectively. |
| `fuelConsumptionMultiplier` | Scale the coal cost for campfire recipes. The total cost rounds up. |
| `coldHungerPerSecond` | Extra fullness lost each second during a blizzard when outside a heat source's range. The default is 0. |
| `hungerRateMultiplier` | Scale ongoing fullness loss. The default is 0.30 points per second while idle and 0.42 while moving. |
| `spawnFrequency`, `spawnDensity` | Scale the number of night raid waves and the base number of enemies per wave, respectively. |
| `resourceDensity`, `resourceRefreshMultiplier` | Scale the density of resource tiles and the rate at which wild resources regrow, respectively. |
| `startingSupplyMultiplier` | Scale the starting inventory for a new world. |

See `src/frontend/public/survival-balance.schema.json` for field types and valid ranges. Multipliers default to 1. Day and night duration multipliers and the resource regrowth multiplier must be greater than 0.

### Lighting and enemy spawns

Adventure night raids, Eternal combat, and standalone Survival use the same two-ring spawn rules. Configure these under `survival` in `balance.json`. Standalone Survival also reads `public/survival-balance.json`, where you can override a single category cap.

| Setting | Default | Meaning |
| --- | --- | --- |
| `minSpawnRadius` | 15 tiles | The inner ring extends at least one tile beyond half the current viewport diagonal. |
| `maxSpawnRadius` | 22 tiles | Maximum distance from the player for a spawn candidate. |
| `despawnRadius` | 30 tiles | Normal enemies beyond this range are removed once per in-game second. |
| `categoryCap` | hostile 12, elite 4, neutral 12 | Limits regular hostiles, elites, and neutral wildlife separately. A value of 0 disables spawns for that category. |

The inner radius must be smaller than the outer radius, which must be smaller than the despawn radius. Normal night enemies require skylight of 7 or less and block light of 2 or less. Coal Shades and Shadow Lynxes require skylight of 7 or less and no block light. The game skips a spawn attempt when it finds no valid location. Adventure story enemies use their preset map locations, and scripted night raids try their original entrances first. Eternal Mode switches to night when combat begins and keeps its spawn budget when no valid location is available.

In a development build, open DEV while playing and enable **Show safe lighting and spawn rings**. Gold shows areas protected from normal night enemies, dark purple shows dim light that blocks only shadow enemies, cyan and orange mark the inner and outer spawn rings, and the white outline shows the current viewport.
