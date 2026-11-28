# Shared Spatial Runtime and Performance Verification

## First GC optimization with 84 enemies

The test used Chrome 158 on Windows with SwiftShader WebGL, a 1024×640 viewport, and a Vite development build. Each run of `src/frontend/tests/spatial-stress.js` opened a fresh page, spawned 84 pursuing Frost Rats, and triggered one boss-hit spark per frame. After 40 warm-up frames, it recorded another 140. GC and frame timings come from three runs with allocation sampling disabled. P95 values are the medians of the three runs.

| Metric | Before | After the first optimization |
| --- | ---: | ---: |
| Main-thread GC events | 30 | 16 |
| Total GC time | 33.555 ms | 25.833 ms |
| Median of each run's longest GC pause | 4.496 ms | 0.790 ms |
| Longest single GC pause | 9.045 ms | 16.881 ms |
| Render CPU P95 | 2.2 ms | 2.8 ms |
| Frame interval P95 | 64.5 ms | 69.3 ms |

| Run | Before: GC count / total / longest | After: GC count / total / longest |
| --- | ---: | ---: |
| 1 | 10 / 10.903 ms / 4.496 ms | 5 / 2.599 ms / 0.695 ms |
| 2 | 10 / 7.395 ms / 1.199 ms | 5 / 3.036 ms / 0.790 ms |
| 3 | 10 / 15.257 ms / 9.045 ms | 6 / 20.198 ms / 16.881 ms |

Three additional runs recorded 15 individual MinorGC events. The longest wall-clock times per run were 0.810, 0.720, and 0.898 ms. The longest thread CPU time was 0.649 ms. The 16.881 ms peak occurred in the third run of the main comparison and did not recur in the additional runs. Render CPU and frame interval P95 rose in the main comparison.

Three separate V8 allocation profiles sampled every 8 KiB on average and included objects collected by both minor and major GC. Estimated allocations over 420 frames fell from 193.80 to 94.19 MiB (−51.4%). The table attributes allocations by call stack.

| Call stack | Before | After |
| --- | ---: | ---: |
| Telegraph paths and Phaser Graphics drawing | 63.81 MiB | 4.68 MiB |
| React | 39.86 MiB | 7.83 MiB |
| Arcade Physics | 15.33 MiB | No samples |
| Phaser sprite batching | 18.59 MiB | 24.15 MiB |
| VFX | 19.30 MiB | 18.39 MiB |

WebGL charge and lunge telegraphs reuse fill, progress, and outline images in the existing draw order. Canvas uses the original path geometry. Gameplay handles enemy collisions. The hero view updates its sort order when the depth changes. The HUD quick bar, equipment bar, and controls update when their displayed fields change.

- [x] Compared WebGL and Canvas screenshots against the baseline for straight and diagonal telegraphs, progress fill, the final overlay, clearing, reuse, and destruction. The scene's telegraph texture count returned to zero after destruction.
- [x] Checked quick-slot consumption, buckler cooldown and readiness, mute, pause, and resume in the browser.
- [x] Production E2E 5/5 and full Adventure development regression 1/1.
- [x] All 159 unit tests and `pnpm typecheck`, `pnpm fix`, `pnpm check`, and `pnpm build`.

## Spatial runtime changes at baseline b687033

| Area | Implementation and constraints |
| --- | --- |
| Line of sight and firelight | Player perception and individual lights use eight-octant recursive scanning. Walls are visible and block light behind them. Low shrubs let light through. Neutral creatures can see or hear allies calling for help. `LightGrid` tracks changes in 16×16-tile chunks. The night overlay and fire halos query the versions of chunks within the camera. Survival Canvas reuses world-space clipping paths for each light. |
| Night overlay and background | `NightOverlay` uses an offscreen canvas with one texel per tile and nearest-neighbor scaling. It redraws when the day-night palette, visible lighting version, dimensions, or camera tile changes. `WorldView` caches baked terrain and appearance revisions. Trees, entities, and doors sort by world Y. |
| Pathfinding | `FlowField.compute` solves the full four-neighbor 32×32 window in reverse from the player. `update` recomputes when the target enters another tile. On a relevant version change within the same tile, it samples 1,024 costs, marks the changed tiles and dependent paths, and relaxes from unaffected boundaries. If costs match, it stops. Pursuers separate based on neighbor density and try lateral movement near walls. Combat logic handles lunges and knockback. |
| Object lifecycle | The enemy pool preallocates 96 records and the projectile pool defaults to 64. Survival raids initialize borrowed records directly. Death hooks run before release. Clearing a scene, leaving it, reaching dawn, and ending a projectile's lifetime also return records. Sparks and shock rings use pools within their capacity, and rings retain their draw order. |
| Phaser rendering | Empty particle layers are hidden. The combat layer sizes its texture in 128-pixel increments based on visible effects. Enemy sprite and shadow depths update only when their values change. `DevToolbar` samples render CPU, pipeline batches, night-overlay redraws, and light-texture refreshes every half second. |
| Mode contracts | Adventure and Eternal obtain `IWorldContext` from `runContext`. Survival exposes the same queries through a local map adapter. `ISpawnDirector` exposes spawn rings, capacity, tile eligibility, and combined validation. Raids and Eternal draw candidates using those checks. Modes own their objectives, fixed residents, and boss timing. |
| Reloading balance | In development, Alt+Shift+R reloads `survival-balance.json` and applies hearing distance, fire and bright-tile costs, spawn rings, despawn distance, and category limits to the current run. Saves contain gameplay state. Caches, pools, and flow fields stay in memory. |

## Before-and-after comparison with 84 enemies

The comparison used Chrome on Windows, SwiftShader WebGL, a 1024×640 viewport, and a Vite development build. Both groups used the same workload and WebGL call counter. Each fresh page spawned 84 pursuing Frost Rats and triggered one boss-hit spark per frame. Each run lasted 180 frames, including 40 warm-up frames. All three runs still had 84 enemies at the end. CPU time is the wall-clock interval from Phaser prerender to postrender. Frame intervals include simulation and browser scheduling. GC counts include MinorGC and MajorGC within the same main-thread window.

| Metric | Commit baseline | After this change |
| --- | ---: | ---: |
| Render CPU P50 / P95, median of three runs | 1.9 / 2.9 ms | 1.8 / 2.5 ms |
| Frame interval P50 / P95, median of three runs | 63.5 / 75.7 ms | 56.5 / 64.6 ms |
| WebGL draw calls per frame, median of three runs | 4.543 | 4.557 |
| Texture uploads per frame, median of three runs | 4.000 | 4.000 |
| GC count / total time across 420 frames | 30 / 37.885 ms | 30 / 21.725 ms |
| Longest GC pause | 9.047 ms | 1.202 ms |

| Run | Render P95 (ms) | Frame interval P95 (ms) | GC count | GC total / longest (ms) |
| --- | ---: | ---: | ---: | ---: |
| Baseline 1 | 2.8 | 75.7 | 10 | 12.362 / 4.219 |
| Baseline 2 | 3.1 | 75.8 | 10 | 9.423 / 1.971 |
| Baseline 3 | 2.9 | 74.2 | 10 | 16.100 / 9.047 |
| After 1 | 2.2 | 64.6 | 10 | 6.557 / 0.769 |
| After 2 | 2.5 | 63.6 | 10 | 6.962 / 0.926 |
| After 3 | 2.8 | 70.4 | 10 | 8.206 / 1.202 |

Texture counts include both `texImage2D` and `texSubImage2D`. Each upload counts once regardless of size. Timing and the longest pause improved, while draw and upload counts stayed close. Hardware GPU time, uploaded bytes, and low-end device frame rates still need measurement. GC pauses remain. To reproduce, pass a fresh Chromium page and the Vite server URL to the Playwright function in `src/frontend/tests/spatial-stress.js`.

## Correctness and regression checklist

- [x] All 159 unit tests, including `renderDepth`, `runtimeRules`, and `riposte`. Also ran 18 LDtk checks and the balance summary.
- [x] A pursuer navigated around a U-shaped wall. Sixteen pursuers starting on one tile traversed a one-tile passage. After 75 random cost changes, the incremental field matched full Dijkstra tile by tile.
- [x] Checked rock walls, multiple lights, opening doors, hearing through walls, and invalidation for distant lights. Browser WebGL and Canvas samples agreed. Alpha was 74 at the light source, 85 at the wall, 184 behind it, and 97 behind it after opening the door.
- [x] Reused enemies, projectiles, sparks, and shock rings 1,000 times each through production paths. Checked target, speed, health, AI flags, and effect age.
- [x] Node 22 imported the pure TypeScript modules directly. The full 32×32 recomputation used 100 warm-ups and 256 timings. P50 / P95 / max were 0.054 / 0.082 / 0.138 ms when idle and 0.100 / 0.177 / 0.313 ms during the full suite. A run concurrent with browser tests reached 9.918 ms wall-clock, showing the maximum is sensitive to machine load.
- [x] Alt+Shift+R changed `brightCost` from 2 to 19 in all three modes in the browser.
- [x] Full Adventure regression covered legacy and current saves, night raids, region transitions, both Ember Seals, and the victory screen. The first run found that hit stop could consume interaction input early. The rerun passed after correction.
- [x] `pnpm typecheck`, `pnpm fix`, `pnpm check`, and `pnpm build`. The build showed a Browserslist database notice.
- [x] All five configured production Playwright tests passed. The first run found that the Survival enemy list was uninitialized when the page first cleared the scene. The full suite passed after correction. The two Caffeine-generated scripts require an external runner. The local suite covers their new-game and reload-to-title flows.
- The local field is centered on the player. Long detours outside the window and crowded combat on low-end hardware still need playtesting.

## Previous round archive (21ec49e)

The following sections record the previous baseline, implementation, and verification.

Adventure, Survival, and Eternal share occlusion, local pursuit navigation, and spawn-point validation. All 155 unit tests, the Adventure regression, and the production build passed. In the 84-enemy Eternal stress test, render CPU P95 fell from 2.3 to 1.8 ms and total main-thread GC fell from 67.6 to 34.3 ms. GC pauses were still present.

## Spatial queries and rendering

| Subsystem | Implementation | Behavior and limits |
| --- | --- | --- |
| Occluded vision | `VisibilityMask` in `fovShadowcast.ts` uses eight-octant recursion and a reusable byte mask. Perception queries player vision. Each light casts independently. | Wall faces are visible and block light behind them. Low shrubs let light pass. Other lights can illuminate the far side. Doors, obstacles, and lights invalidate the cache when they change. |
| Firelight | `LightGrid` combines clipped light levels. `NightOverlay` cuts graded light areas out of an offscreen canvas. `TorchlightAtmosphereLayer` adds halos over lit tiles. Survival Canvas clips by light source. | Changes to camera tile, viewport scale, lighting version, or palette redraw the night texture. Fire particles can animate every frame. The ground uses baked textures and held lights use tile centers. |
| Pathfinding and perception | `flowField.ts` solves four-neighbor weighted Dijkstra in reverse from the player over 32×32 tiles, reusing distance, heap, and successor arrays. Pursuers follow successors, align before corners, and separate slightly based on neighbor density. | Enemies share the field. After the player moves a tile or obstacles, lighting, fires, or costs change, the next pursuit query recomputes the window. Existing movement applies outside the window. Finding a new target requires line of sight or hearing range. Pursuers remember their target. |
| Objects and views | Enemy records clear on reuse. The projectile pool starts with 64 entries and clears target, speed, damage, and related fields on release. Particles are preallocated to their cap. Enemy views pool by texture, hide, and disable collisions on release. | Covers normal combat, Eternal spawns, projectile completion, and particle updates. The development toolbar shows CPU time between Phaser render events. |
| Mode interfaces | `worldContext.ts` defines `IWorldContext`, `WorldAdapter`, and `ISpawnDirector`. Adventure and Eternal connect via `runContext.ts`. Survival adapts its terrain, buildings, and plants. | Shared queries cover terrain, collision, occlusion, lighting, ignition, freezing, perception, pursuit, and spawn validation. Modes share ring, lighting, and category rules and own waves, objectives, and special units. |

Bright tiles add 2 cost, flames add 12, and hearing reaches 2 tiles by default. The corresponding `brightCost`, `fireCost`, and `hearingTiles` fields live in `balance.json` under `survival` and use the same validation as overrides. Pathfinding distinguishes impassable tiles from traversable high-cost tiles. At this point in the project, invalidation recomputed the whole window.

## Correctness and regression results

| Check | Result |
| --- | --- |
| `pnpm test` | 155/155, including `renderDepth`, `runtimeRules`, `riposte`, and five new spatial runtime tests. The input baseline passed 150/150. |
| New algorithm and pool tests | Checked visible wall faces in eight directions, occlusion behind walls, a second light, and an opening door. A pursuer with a collision radius rounded a U-shaped rock wall and reached the player. Checked same-tile caching, fire weights, and obstacle revisions. Reused projectiles and enemies 1,000 times each and verified that their old state cleared. |
| Node flow-field benchmark | Used a weighted 32×32 obstacle grid with 100 warm-ups and 256 timings. P50 was 0.045 ms, P95 was 0.092 ms, and the maximum was 0.383 ms. The test requires a maximum below 1 ms. Node 24 imported and ran FOV and flow fields without DOM, Phaser, or an external pathfinding library. |
| Adventure browser regression | Passed hero selection, textures and initial inventory, blocking, old and current saves, gathering and raids across regions, both Ember Seals, explosion effects, and the victory screen. |
| Browser E2E | Local Chromium and Playwright ran two repository cases, New Game and reload to title. Survival also created a world with seed 42 and produced the corresponding save. Cloud E2E was pending. |
| Map and runtime | Map tools 11/11, rules and balance 33/33, LDtk 18/18. Real keyboard input produced no errors, and night raids peaked at eight enemies. The default and high-load 900-second simulations both passed. Some tests contribute to both these and the overall counts. |
| Static checks and release | `pnpm typecheck`, `pnpm fix`, and `pnpm build` passed. The build reported stale Browserslist data. |

Regression fixtures were updated for the current menus, hero panel, and save version. An existing perception-radius test uses open terrain to isolate distance, and new tests cover rock walls. The long-run fixture synchronizes spawn position and refreshes perception after teleporting. Standalone map console verification statically imports the same merge function and retains its assertions. Adventure and Eternal also fixed cyclic initialization of a combat-radius constant. Fixed residents and additional spawns follow their respective persistence rules.

## Browser stress test with 84 enemies

The `src/frontend/tests/spatial-stress.js` script spawns 84 pursuing Frost Rats in Eternal Mode and triggers a boss-hit effect at the player each frame. It uses Chromium WebGL with SwiftShader at 1024×640 against a Vite development build. Each version runs on three fresh pages for 180 frames per run, with 40 warm-up frames excluded. Rendering CPU measures Phaser's prerender-to-postrender interval and includes effect triggering. Frame interval includes simulation, rendering, and scheduling. CDP uses user marks to isolate MinorGC and MajorGC events on the same main thread. The input bundle had an initialization-order error. The baseline measurement copy set `CONTACT_PX` to the equivalent literal 14 (6 + 5 + 3) to reach the same Eternal scene.

| Metric | Input baseline | After the update |
| --- | ---: | ---: |
| Render CPU P50, median of three runs | 1.3 ms | 1.1 ms |
| Render CPU P95, median of three runs | 2.3 ms | 1.8 ms |
| Frame interval P50, median of three runs | 44.2 ms | 39.3 ms |
| Frame interval P95, median of three runs | 61.1 ms | 58.7 ms |
| Main-thread GC count across 420 frames | 33 | 28 |
| Main-thread GC time across 420 frames | 67.628 ms | 34.313 ms |
| Longest single GC pause | 9.149 ms | 5.188 ms |

| Version / run | Render P95 (ms) | Frame interval P95 (ms) | GC count | Total GC time (ms) |
| --- | ---: | ---: | ---: | ---: |
| Baseline 1 | 5.6 | 71.7 | 11 | 37.546 |
| Baseline 2 | 2.1 | 61.1 | 11 | 17.898 |
| Baseline 3 | 2.3 | 58.7 | 11 | 12.184 |
| After 1 | 1.8 | 58.7 | 10 | 13.697 |
| After 2 | 4.6 | 62.0 | 9 | 9.567 |
| After 3 | 1.6 | 55.0 | 9 | 11.049 |

The measurements reproduce the trend on software WebGL. The second updated run had a higher render P95 than the second baseline run, and all three runs recorded GC. Hardware GPU time and draw-call counts were not collected, so the results cannot attribute all gains to one batching or pooling change. The U-shaped-wall case validates routes inside the local window. Larger walls outside it and low-end hardware still need separate playtests.

## Reproduction and references

- From the repository root, run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`. For spatial modules only, run `node tests/run-unit-tests.mjs tests/spatialRuntime.test.ts`.
- Start Vite and run `src/frontend/tests/adventure-regression.js` in a fresh Playwright Chromium page. Run `spatial-stress.js` the same way with the server URL to collect JSON frame timings and GC results. The stress test requires Chromium CDP.
- Algorithm references. [rot.js RecursiveShadowcasting](https://ondras.github.io/rot.js/doc/classes/fov_recursive_shadowcasting.default.html) · [rot.js Dijkstra](https://ondras.github.io/rot.js/doc/classes/path_dijkstra.default.html)
- Rendering and resource reuse references. [Phaser 3.90 RenderTexture](https://phaser.io/oss/docs/api-documentation/3.90.0/class/gameobjects-rendertexture) · [Ourcade Phaser 3 Object Pooling](https://github.com/ourcade/phaser3-object-pooling)
