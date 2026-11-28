#!/usr/bin/env bash
set -o pipefail

logs=.cache/ci-logs
mkdir -p "$logs" || exit 1
summary="$logs/summary.md"
if [[ -n "$GITHUB_STEP_SUMMARY" ]]; then summary="$GITHUB_STEP_SUMMARY"; fi
commit="$(git rev-parse --short HEAD)" || exit 1
export VITE_COMMIT_SHA="$commit"
failed=0
browser_failed=false

printf '# Game Health Check\n\nBuild commit \x60%s\x60\n\n' "$commit" >> "$summary"

check() {
  local id="$1" label="$2"
  shift 2
  printf '\n=== %s ===\n' "$label"
  if "$@" 2>&1 | tee "$logs/$id.log"; then
    printf -- '- ✅ %s\n' "$label" >> "$summary"
  else
    failed=1
    {
      printf -- '- ❌ %s\n\n  <details><summary>Failure log (last 35 lines)</summary>\n\n  <pre>\n' "$label"
      tail -n 35 "$logs/$id.log" | sed -E $'s/\\x1b\\[[0-9;]*[[:alpha:]]//g' \
        | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/^/  /'
      printf '  </pre>\n  </details>\n\n'
    } >> "$summary"
    return 1
  fi
}

skip() {
  printf -- '- ❌ %s (skipped because %s)\n' "$1" "$2" >> "$summary"
}

build_game() {
  pnpm --dir src/frontend build &&
    test -s src/frontend/dist/index.html &&
    test -s src/frontend/dist/survival.html
}

if check install "Install locked dependencies" pnpm install --frozen-lockfile; then
  check biome "Biome static checks" pnpm check
  check types "TypeScript type checking" pnpm typecheck
  check unit "Game logic unit tests" node tests/run-unit-tests.mjs
  check ldtk "LDtk map validation" node tests/run-ldtk-test.mjs
  browser_ready=false
  if check browser-install "Install Chromium and system dependencies" pnpm exec playwright install --with-deps chromium; then
    browser_ready=true
    check browser-adventure "Full Adventure regression" env E2E_TARGET=development pnpm test:e2e || browser_failed=true
  else
    browser_failed=true
    skip "Full Adventure regression" "Chromium installation failed"
  fi
  check balance "Balance report" node tools/balance-report.mjs --summary
  if check build "Vite production build and entry-point validation" build_game; then
    if "$browser_ready"; then
      check browser-smoke "Production browser smoke tests" pnpm test:e2e || browser_failed=true
    else
      skip "Production browser smoke tests" "Chromium installation failed"
    fi
  else
    skip "Production browser smoke tests" "the production build failed"
  fi
else
  for label in "Biome static checks" "TypeScript type checking" "Game logic unit tests" "LDtk map validation" \
    "Install Chromium and system dependencies" "Full Adventure regression" "Balance report" \
    "Vite production build and entry-point validation" "Production browser smoke tests"; do
    skip "$label" "dependency installation failed"
  done
fi

if [[ -n "$GITHUB_OUTPUT" ]]; then
  printf 'browser_failed=%s\n' "$browser_failed" >> "$GITHUB_OUTPUT"
fi
exit "$failed"
