# English Localization Handoff

## 1. Tool and changed files

Codex translated repository text on local baseline `617de2e` in commit `66ede10`. The published translation applies that work to remote `main` at `3049eca`. The starting inventory found 165 files with Chinese text and three launchers with Chinese names.

- `README.md` (84), `AGENTS.md` (41), and the guides and reports under `docs/`.
- `src/frontend/index.html` (21), `src/frontend/survival.html` (5387, over 240), and text in the Adventure, Eternal, and Survival UI, diagnostics, and data.
- `.github/workflows/ci.yml` (49) and `.github/workflows/deploy.yml` (97) use the English workflow name `Game Health Check`.
- `tools/run-health-check.bat` (26), `tools/open-map-viewer.bat` (5), and `tools/open-sprite-workbench.bat` (5), plus tool and test messages.
- `docs/AI_HANDOFF.md` records scope, reproduction, results, and source excerpts.

## 2. Verified items

- No Han text or Han file names in the 430 current repository text files examined, including the three renamed launchers.
- Compared 15 translated JSON files with the worktree baseline. Stable keys, numeric values, types, array lengths, and nonlocalized values matched. Survival catalog headings are display labels.
- The combined worktree previously passed TypeScript, Biome, production game and map console builds, 159 unit tests, 18 LDtk checks, and 11 map console checks.
- The isolated publication tree on `3049eca` passed TypeScript, Biome, the production game and map console builds, 155 unit tests, 18 LDtk checks, and 11 map console checks. The pending gameplay and performance work includes the other four tests.
- In the isolated tree, all five Playwright production smoke cases passed. The full Adventure regression covered both save generations, camp and combat interactions, both Ember Seals, and victory.
- The Windows missing-root fixture printed the English error and returned 1. The CI shell script passed `bash -n`.

## 3. Unverified and known limits

- Local browser regression used Windows Chrome. The renamed GitHub workflow has not run for this worktree change.
- Binary art, fonts, screenshot archives, and generated exports are outside the text scan. Low-end GPU performance and the 84-enemy GC peak remain open from the earlier performance work.

## 4. Interfaces and constraints

- Keep save keys and version fields, JSON IDs, game balance, event payloads, and public VFX interfaces stable.
- Pages listens to the test workflow by name. Keep `.github/workflows/ci.yml` and the `workflow_run` filter in `.github/workflows/deploy.yml` synchronized.
- Use English for repository text and future commit subjects. The existing Git history is the archival record.

## 5. Next work

1. Preserve the English terminology in future UI, content, and test updates.
2. Recheck GC peak and low-end hardware performance when the spatial runtime work resumes.
