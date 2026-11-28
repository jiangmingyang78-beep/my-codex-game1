# v4.1.0 Release Handoff

## 1. Tool and changed files

Codex merged GitHub `main` into the local release history and bumped the version to v4.1.0. The merge retained the locally tested gameplay tree from `0e7f842`.

- `README.md` (88 lines)
- `package.json` (37 lines)
- `src/frontend/package.json` (94 lines)
- `src/frontend/survival.html` (5387 lines ⚠)
- `docs/AI_HANDOFF.md` (39 lines)
- `docs/HANDOFF.md` (36 lines)

⚠ marks files with at least 240 lines.

## 2. Verified items

- `pnpm typecheck`, `pnpm fix`, and `pnpm build` passed.
- Unit tests 167/167, LDtk map checks 18/18, and balance report generation passed.
- Production browser smoke 5/5 and full development Adventure regression 1/1 passed in local Chrome.
- Production Survival header displays `v4.1.0` from the frontend manifest.

## 3. Unverified and known risks

- Portable save import/export UI integration and its use of the observed `savedAt` token are pending.
- Physical-device profiling with 84 enemies has yet to be repeated.

## 4. Locked interfaces and constraints

- Survival displays the frontend manifest version. Keep both package versions aligned when tagging the next release.
- Game runtime and save interfaces follow the archive-sync handoff in `0e7f842`. Existing VFX APIs and save schema remain as before this release bump.

## 5. Next turn tasks

1. Connect the portable save export/import UI and pass the observed `savedAt` token to `saveRun`.
2. Repeat 84-enemy profiling on physical devices.
