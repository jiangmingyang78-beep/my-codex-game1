# Emberwood: Last Torch AI Development Handoff

Upload this one file and ask the web AI to continue the task below. If the task is already complete, give the new task, game mode, and acceptance criteria in the same message.

## Current task

- **Task and mode** — Package English localization for Adventure, Eternal, and Survival with the standalone web AI handoff.
- **Baseline and worktree** — 2026-11-28. The original local translation commit was `66ede10` on `617de2e`. The published translation applies to remote `main` at `3049eca`. The local worktree also contained uncommitted gameplay, performance, and test changes.
- **Reproduction and acceptance** — Check out the localization commit in an isolated copy and run the checks below. The commit should contain localized text, launchers, and handoff documentation. Open this attachment on its own to locate the relevant entry point and test.
- **Scope** — The published translation preserves the remote HUD and rendering implementations. Local gameplay, performance, and test work remains in the workspace. For subsequent tasks, record any verified behavior to preserve.
- **Previous verification** — The localization handoff records passing type checks, Biome, 159 unit tests, production builds, Playwright smoke, and the full Adventure regression with both save generations. Low-end GPU behavior and the 84-enemy GC peak still need retesting. See `docs/HANDOFF.md` for localization and `git show 3049eca:docs/AI_HANDOFF.md` for the dependency audit.

## How to take over

1. Verify the baseline. With workspace access, read `AGENTS.md`, `docs/HANDOFF.md`, and `git status --short`. On GitHub, use the task's commit. For uncommitted changes, use the supplied files or diff.
2. Start at the relevant row below and follow callers and tests. If code is missing, give a provisional diagnosis and request the smallest set of paths, symbols, or line ranges together. For a Survival raid, start with the `raidSpawnPoints` call, its implementation, and the relevant balance fields. Use symbol search for large files such as `survival.html`.
3. Report affected paths and symbols. When supplying code in chat, use a unified diff or a short replacement with surrounding lines for context. Include the commands or player steps that verify the change, with observed results and remaining checks.
4. Use English for game text and new commits, and Chinese when replying to the user. Keep gameplay client-side and use JSON for data. Preserve public VFX interfaces, render depth, save compatibility, scene restart behavior, and Canvas fallback. Keep `core/` and `systems/` independent of Phaser. Preserve previously verified work by other tools.

## Game and code map

Emberwood is a browser-based top-down pixel survival adventure built with React, Vite, TypeScript, and Phaser 3.90.0. In Adventure, gather, craft, maintain the campfire, and explore the Old Mill. Eternal shares the Phaser frontend and runs arena waves, rotating bosses, and separate scores. Survival is a separate Canvas page for camp management, hunger, cold fronts, and raids. It has its own inventory IDs and save slots. Progress lives in `localStorage`. [Project repository](https://github.com/jiangmingyang78-beep/my-codex-game1)

Paths starting with `game/`, `systems/`, `core/`, `data/`, or `vfx/` are relative to `src/frontend/src/`. Test and HTML paths are relative to the repository root.

| Task | Start here | Verify with |
| --- | --- | --- |
| Title, new game, continue, Adventure | `game/ui/TitleScreen.tsx`. `game/session/activeRun.ts` (`beginRun`) → `game/scenes/GameScene.ts` (`takePendingRun`) → `game/session/RunSession.ts`. | `tests/e2e/game.smoke.spec.ts`, `tests/e2e/adventure-regression.spec.ts` |
| Survival, camp, raids | `src/frontend/survival.html` → `systems/survival/raidSpawn.ts`. Check `data/survival*.json` and `src/frontend/public/survival-balance.json`. | `tests/winterSurvival.test.ts` |
| Eternal waves and bosses | `game/session/RunSession.ts`, `systems/eternal/eternalWorld.ts`, `systems/eternal/eternalDirector.ts`. | In-game waves and boss rotation, plus `src/frontend/tests/spatial-stress.js` for load |
| Light, pursuit, spawn rules | `systems/world/worldContext.ts`, `systems/world/lightGrid.ts`, `systems/world/flowField.ts`, `systems/combat/spawnRules.ts`. | `tests/lightSpawn.test.ts`, `tests/spatialRuntime.test.ts` |
| Items, recipes, enemies, regions, balance | `data/items.json`, `data/recipes.json`, `data/enemies.json`, `data/regions.json`, `data/balance.json`. Validation starts in `core/gameData.ts`. | `tests/dataValidator.test.ts` |
| Saves and migrations | `core/save.ts`, `core/saveMigration.ts`, `core/storage.ts`. Search for `worldSlot` on the Survival page. | `tests/runtimeRules.test.ts`, `tests/dataValidator.test.ts` |
| Visual feedback and rendering | `game/feedback/TelegraphLayer.ts`, `game/world/EntityViews.ts`, `game/renderDepth.ts`, `vfx/`. | `tests/renderDepth.test.ts`, `docs/SPATIAL_RUNTIME.md` |

## Local commands

Run from the repository root with Node.js 22.12+ or 24 and pnpm 10.26.1. Play at `/` or `/survival.html`.

```sh
pnpm install --frozen-lockfile
pnpm --dir src/frontend dev --host 127.0.0.1 --port 5173
node tests/run-unit-tests.mjs tests/winterSurvival.test.ts
pnpm check:all
pnpm test:e2e
git rev-parse --short HEAD
git status --short
git diff HEAD -- src/frontend/src/systems/survival/raidSpawn.ts
```

Substitute the file relevant to your task in the targeted test and diff commands. Include needed untracked files as excerpts in this attachment. Playwright uses the production build by default. Set `E2E_TARGET` to `development` for the full Adventure regression. Use `docs/MVP_CHECKLIST.md` for player-facing acceptance and follow `AGENTS.md` for milestone validation and handoff.

## Relevant source and verification

- **Source excerpt** — The launcher in `tests/run-unit-tests.mjs` calls `await runUnitTests(process.argv.slice(2));` and accepts root-relative test paths. On the next handoff, attach the relevant functions, callers, config fields, or minimal diff here. If the reader cannot access the baseline, include the surrounding source.
- **Checked on the isolated localization tree** — TypeScript, Biome, and the production build passed. The baseline's 155 unit tests, 18 LDtk checks, 11 map console checks, five production Playwright smoke cases, and one full Adventure regression passed. The shell health-check script passed `bash -n`.
- **Still to verify** — The renamed GitHub Actions workflow has yet to run for this commit. Low-end hardware and the 84-enemy GC peak remain open in the separate performance work.
