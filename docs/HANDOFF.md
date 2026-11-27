# 双工具交接 · 光影与 HUD 实机验收

## 1. 工具与改动文件

Codex。下列源码路径以 `src/frontend/` 为起点。⚠ 表示至少 240 行。

- 夜幕与暖光 · `src/game/atmosphere/TorchlightAtmosphereLayer.ts`（387 ⚠）、`src/game/atmosphere/atmospherePresets.ts`（46）、`src/game/atmosphere/pixelLightMask.ts`（26，新增）、`src/game/world/NightOverlay.ts`（113）、`src/game/world/Scenery.ts`（97）、`src/game/ui/GameUi.tsx`（42）。
- 战斗预警 · `src/game/feedback/TelegraphLayer.ts`（282 ⚠）、`src/game/feedback/combatFeelPresets.ts`（116）。
- Toast 与状态栏 · `src/game/scenes/ToastScene.ts`（103）、`src/game/ui/pixelFont.ts`（35）、`src/game/ui/toastTheme.ts`（256 ⚠）、`src/game/ui/toastMotion.ts`（218）、`src/game/ui/Hud.tsx`（156）、`src/game/ui/QuickSlots.tsx`（62）。
- 其他界面 · `src/game/ui/CraftPanel.tsx`（134）、`src/game/ui/EquipmentRingRail.tsx`（161）、`src/game/ui/EternalPrepPanel.tsx`（190）、`src/game/ui/HeroPortrait.tsx`（40）、`src/game/ui/SeasonsDiorama.tsx`（143）、`src/game/ui/TitleScreen.tsx`（236）、`src/index.css`（264 ⚠）、`tailwind.config.js`（140）。
- 仓库交接 · `docs/HANDOFF.md`（35）。

## 2. 已验证项

- `pnpm typecheck`、`pnpm fix`、`pnpm build`、`npm run build` 通过。`npm test` 70 项通过。构建提示 Browserslist 数据已有 8 个月。
- 本地 Chrome 使用 SwiftShader WebGL，视口 1280×720，DPR 1。冒险营火边缘复拍确认暗处仍有雪纹、火光呈暖色阶梯，拾取流距状态区 16px。
- 营火交互图中，四角高亮和双行 16px PixelZH 提示完整显示。Toast 底边距快捷栏顶边 20px。
- 永恒亮雪及暗夜复验均能区分红色前摇与白色提交帧，挥砍、角色和顶部 HUD 无互相遮挡。暗夜拾取流距状态区 16px。
- 六张图保留在本机 `tmp-visual-audit/before/` 和 `tmp-visual-audit/after/`。两处 Vite 服务已关闭，临时脚本与基线副本已清理。

## 3. 未验证与已知风险

- 战斗复拍用开发命令布置敌人并固定取样帧。仍待通过连续自然战斗复核提交窗口、伤害飘字和 Boss 指示器。
- 本轮实机覆盖桌面 WebGL。Canvas 回退、窄屏快捷栏换行和长时间动态光晕仍待复验。

## 4. 锁定接口与约束

- `makePixelHole(): HTMLCanvasElement` 提供 48×48 四档挖孔纹理。夜幕最近邻采样，峰值透明度 0.72。主场景使用 `NightOverlay`，切勿同时启用 `TorchlightAtmosphereLayer` 的选用夜幕。
- `data-hud-top-left` 与 `data-hud-hotbar` 是 Toast 的布局锚点。Toast 在独立 1:1 场景绘制，文字 16px，盒子按 4px 网格对齐。
- 使用既有 `RENDER_DEPTH` 次序。地表与脚印 → 地面提示 → 实体 → 挥砍 → 光影 → HUD。VFX 公共接口、战斗规则和存档结构沿用现有契约。

## 5. 下一棒任务

1. 用 Canvas 和窄屏复测昼夜光照、双行 Toast 与快捷栏换行。
2. 用连续战斗复测提交白闪、伤害飘字和 Boss 指示器。
