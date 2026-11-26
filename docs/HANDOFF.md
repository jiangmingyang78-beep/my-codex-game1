# 双工具交接 · 双通道 Stacked Toast 重构

## 1. 工具与改动文件（Antigravity，括号为行数）
- 新增 `src/frontend/src/game/ui/ToastManager.ts`（287，⚠️ ≥240）、`toastTheme.ts`（226）、`toastMotion.ts`（191）、`toastBridge.ts`（107）、`src/frontend/src/game/scenes/ToastScene.ts`（90）。
- 修改 `src/frontend/src/game/config.ts`（38）、`createGame.ts`（70）、`GameScene.ts`（277，⚠️ ≥240）、`bindSceneCommands.ts`（87）、`Hud.tsx`（153）、`Overlays.tsx`（46）、`store.ts`（181）、`eventFeedback.ts`（246，⚠️ ≥240）、`outputHandler.ts`（44）、`eternalCommands.ts`（41）、`DevToolbar.tsx`（164）。
- 更新 `docs/HANDOFF.md`。

## 2. 已验证
- `pnpm typecheck`、`pnpm fix`（0 需修复项）、`pnpm build` 全部通过。
- 所有新增与修改文件均 ≤ 299 行；`src/frontend/src/core/snapshot*`、`src/frontend/src/vfx/`、存档结构与战斗数值零改动。
- 已校验 `ToastScene` 独立 1:1 屏幕坐标与 `GameScene` 启动/重启/返回标题的清理链路。

## 3. 未验证与已知风险
- 仅通过编译与打包验证，尚未在真实浏览器中实机目测动画手感、高 DPI 文字清晰度及极窄屏下的堆叠边距。
- 制作面板（`CraftPanel`）与暂停菜单（`PauseMenu`）采用 `bg-night/60` 半透明遮罩，打开期间 Phaser 画布层提示会透过 60% 遮罩显示（与旧版 `<Toasts />` 层级一致）。

## 4. 锁定接口与约束
- `ToastManager`（`ui/ToastManager.ts`）公开方法：`loot(itemId, label, delta, iconKey)`、`warn(label, key)`、`error(label, key)`、`info(label, key)`、`gain(label, key)`、`show(label, tone)`、`push(...)`、`setAnchors(x, y, fbY)`、`clear()`、`destroy()`。
- `toast` 门面（`ui/toastBridge.ts`）缓冲启动期消息，待 `ToastScene.create` 挂载后自动冲刷；`uiStore.toast(text, tone)` 保留为兼容包装，Phaser 场景就绪时直通 `toast.show`。
- 图标经 `resolveItemIconKey` 优先查 `node_${itemId}` / `loot:${itemId}`，缺失时静默回退为无图标纯色条。

## 5. 下一棒
1. 实机试玩冒险模式与无尽模式，验证连续采集累加弹跳、连按 E 警告抖动、以及多装备环栏与快捷栏避让。
2. 如需在制作面板/暂停菜单打开时让提示完全压在弹窗上方，可评估后续把非玩法期系统提示置顶或保持现状。
