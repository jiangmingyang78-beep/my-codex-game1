# Emberwood: Last Torch v4.1.0 AI Handoff

- **Task** — Publish the latest game to GitHub as v4.1.0 and synchronize the workspace, frontend, and Survival version display.
- **Baseline** — Local gameplay commit `0e7f842` and GitHub `main` at `df84e77`. Merge commit `b3a4912` includes both histories. The remote localization and dependency changes were already represented in the local tree, so the merge retained the tested local gameplay source.
- **Uncommitted changes at pickup** — The tracked worktree and index were clean. Local archives, visual audit output, and assistant files were untracked.
- **Reproduction** — From the repository root run `pnpm typecheck && pnpm fix && pnpm test && pnpm build`, then `pnpm test:e2e`. Set `E2E_TARGET=development` to run the full Adventure regression. Open `/survival.html` from the production preview and check the header.
- **Acceptance** — Both package manifests and the Survival header show v4.1.0. The GitHub `main` branch and annotated `v4.1.0` tag point to the same release commit, which includes both baselines.

## Release contents

- English localization across the three modes and repository documentation.
- Portable run save import and export APIs, including protections for newer save slots and stale writes from other tabs. The APIs are covered by unit tests.
- Shared lighting and pathfinding updates, fewer allocations in combat rendering, and GitHub health checks for the production build and Adventure gameplay.
- See `docs/SPATIAL_RUNTIME.md` for measured performance and the previous archive-sync handoff at `git show 0e7f842:docs/AI_HANDOFF.md` for implementation excerpts.

## Minimal diff

- `package.json` and `src/frontend/package.json` advance from `4.0.0` to `4.1.0`.
- `src/frontend/survival.html` derives the displayed release from the frontend manifest.

```js
import {version} from "./package.json";

$("version").textContent="v"+version;
```

- `README.md` lists v4.1.0 and links to its Git tag.

## Tests performed and results

- `pnpm typecheck`, `pnpm fix` (281 files, no fixes), `pnpm build`, and `git diff --check` passed.
- `pnpm test` passed 167 tests. LDtk map validation passed 18 tests. The balance report completed with zero configuration warnings or critical errors.
- Production browser smoke passed five cases in Chrome. Development Adventure regression passed and covered save generations v2 and v4, both Ember Seals, and victory.
- A direct Playwright check confirmed the production Survival header renders `v4.1.0` and both manifests agree.

## Still to verify

- The portable save UI and its use of the observed `savedAt` token remain pending.
- The 84-enemy performance check on physical devices remains pending.
