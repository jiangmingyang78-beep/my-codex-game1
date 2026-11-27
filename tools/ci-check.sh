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

printf '# 游戏体检\n\n构建提交：\x60%s\x60\n\n' "$commit" >> "$summary"

check() {
  local id="$1" label="$2"
  shift 2
  printf '\n=== %s ===\n' "$label"
  if "$@" 2>&1 | tee "$logs/$id.log"; then
    printf -- '- ✅ %s\n' "$label" >> "$summary"
  else
    failed=1
    {
      printf -- '- ❌ %s\n\n  <details><summary>失败摘录（最后 35 行）</summary>\n\n  <pre>\n' "$label"
      tail -n 35 "$logs/$id.log" | sed -E $'s/\\x1b\\[[0-9;]*[[:alpha:]]//g' \
        | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/^/  /'
      printf '  </pre>\n  </details>\n\n'
    } >> "$summary"
    return 1
  fi
}

skip() {
  printf -- '- ❌ %s（未运行：%s）\n' "$1" "$2" >> "$summary"
}

build_game() {
  pnpm --dir src/frontend build &&
    test -s src/frontend/dist/index.html &&
    test -s src/frontend/dist/survival.html
}

if check install "安装锁定依赖" pnpm install --frozen-lockfile; then
  check biome "Biome 静态检查" pnpm check
  check types "TypeScript 类型检查" pnpm typecheck
  check unit "游戏逻辑单测" node tests/run-unit-tests.mjs
  check ldtk "LDtk 地图验证" node tests/run-ldtk-test.mjs
  browser_ready=false
  if check browser-install "安装 Chromium 与系统依赖" pnpm exec playwright install --with-deps chromium; then
    browser_ready=true
    check browser-adventure "冒险完整回归" env E2E_TARGET=development pnpm test:e2e || browser_failed=true
  else
    browser_failed=true
    skip "冒险完整回归" "Chromium 安装失败"
  fi
  check balance "数值平衡报告" node tools/balance-report.mjs --summary
  if check build "Vite 生产构建与入口验证" build_game; then
    if "$browser_ready"; then
      check browser-smoke "生产预览浏览器零报错冒烟" pnpm test:e2e || browser_failed=true
    else
      skip "生产预览浏览器零报错冒烟" "Chromium 安装失败"
    fi
  else
    skip "生产预览浏览器零报错冒烟" "生产构建失败"
  fi
else
  for label in "Biome 静态检查" "TypeScript 类型检查" "游戏逻辑单测" "LDtk 地图验证" \
    "安装 Chromium 与系统依赖" "冒险完整回归" "数值平衡报告" \
    "Vite 生产构建与入口验证" "生产预览浏览器零报错冒烟"; do
    skip "$label" "依赖安装失败"
  done
fi

if [[ -n "$GITHUB_OUTPUT" ]]; then
  printf 'browser_failed=%s\n' "$browser_failed" >> "$GITHUB_OUTPUT"
fi
exit "$failed"
