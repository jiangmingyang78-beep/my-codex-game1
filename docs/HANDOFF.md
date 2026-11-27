# GitHub 游戏体检与报错回溯交接

## 1. 工具与改动文件

- Codex。括号内为行数，⚠ 标记至少 240 行的文件。
- 工作流 · .github/workflows/ci.yml（49）、.github/workflows/deploy.yml（62）
- 本地入口 · package.json（30）、pnpm-lock.yaml（5270 ⚠）、playwright.config.ts（38）、tools/ci-check.sh（77）、tools/一键体检.bat（25）
- 浏览器测试 · tests/e2e/browser-fixture.ts（87）、tests/e2e/game.smoke.spec.ts（90）、tests/e2e/adventure-regression.spec.ts（14）、src/frontend/tests/adventure-regression.js（323 ⚠）
- 游戏入口与快照 · src/frontend/src/main.tsx（36）、src/frontend/survival.html（5370 ⚠）、src/frontend/src/core/snapshot.ts（144）
- 诊断 · src/frontend/src/game/diagnostics/config.ts（1）、src/frontend/src/game/diagnostics/report.ts（115）、src/frontend/src/game/diagnostics/listeners.ts（25）、src/frontend/src/game/diagnostics/ErrorBoundary.tsx（33）、src/frontend/src/game/diagnostics/survivalEntry.tsx（20）
- 场景与事件 · src/frontend/src/game/scenes/BootScene.ts（25）、src/frontend/src/game/scenes/GameScene.ts（379 ⚠）、src/frontend/src/game/scenes/TitleScene.ts（81）、src/frontend/src/game/session/activeRun.ts（74）、src/frontend/src/game/session/outputHandler.ts（54）
- 界面 · src/frontend/src/game/ui/ErrorScreen.tsx（75）、src/frontend/src/game/ui/GameUi.tsx（43）、src/frontend/src/game/ui/store.ts（186）
- docs/HANDOFF.md（37）

## 2. 已验证项

- 本机 pnpm check:all、pnpm fix 和冻结锁文件离线安装通过。155 项单测、18 项单独 LDtk 测试及平衡摘要通过。
- Chrome/SwiftShader 完整冒险回归及 5 项生产冒烟通过，包含 VITE_COMMIT_SHA、快照、25 条面包屑及剪贴板。独立注入 React 渲染错误验证了组件堆栈。
- 注入实际 pageerror、console.error 与 WebGL 创建失败，确认 Playwright 非零退出并保留截图、trace 和 console-errors.log。
- actionlint 校验两份工作流。Bash 失败探针验证中文节点、失败摘录和退出码。Windows 批处理验证成功态及暂停。

## 3. 未验证与已知风险

- 首次云端体检的 Chromium 安装因 Ubuntu 26.04 与 Playwright 1.58.2 不兼容而失败。安装日志已归档，CI 固定使用 Ubuntu 24.04。
- Ubuntu 24.04 已通过 Chromium 安装和 5 项生产冒烟。完整冒险回归通过 Vite 开发模块探针确认键盘输入被游戏处理，避免软件渲染低帧率漏掉固定时长的按键。

## 4. 锁定接口与约束

- CI 以短 SHA 注入 VITE_COMMIT_SHA。Pages 只下载对应成功体检的 main 提交与运行尝试编号，发布前确认仍对应 main 最新提交。手动发布通过在 main 运行「游戏体检」触发。
- 诊断环仅存内存并最多保留 25 条。快照摘要使用白名单字段，现有存档结构与玩法数值保持原状。
- Issue 仓库在 diagnostics/config.ts 配置。Issue URL 限 7500 字符，剪贴板保留完整 Markdown。
- Caffeine 生成用例保留在 tests/e2e，Playwright 运行同目录的确定性 spec。失败制品路径为 .cache/ci-playwright。

## 5. 下一棒任务

1. 推送后检查 Actions 的中文体检看板和 Pages 部署关联。
2. 此前空间运行时和生存平衡实测见 SPATIAL_RUNTIME.md 与 BALANCE_PLAYTEST.md。
