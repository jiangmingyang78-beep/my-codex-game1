# 双工具交接 · Canvas 窄屏与连续战斗复验

## 1. 工具与改动文件

Codex。⚠ 表示至少 240 行。

- `src/frontend/src/game/ui/Hud.tsx`（170）收紧窄屏状态行留白，为条形仪表让出空间。永恒计时按完整字段换行，添加时钟和操作区布局锚点。
- `src/frontend/src/game/feedback/CombatFeelController.ts`（390 ⚠）将 Boss 箭头按 1:1 屏幕像素绘制，避开 HUD，给箭头加 2px 深色边。120ms 内的相邻飘字分行。
- `docs/HANDOFF.md`（32）记录本轮实测。

## 2. 已验证项

- Chrome 禁用 WebGL 后确认 Phaser 使用 Canvas，DPR 1。320×640 永恒模式下，白天与深夜截图显示雪纹和暖色阶梯光。五个快捷位换成两排，16px 中文 Toast 完整折两行，底边距快捷栏 20px。
- 1280×720 连续战斗用开发工具布置雪貂，随后让敌人正常行动，按空格挥砍。逐帧捕捉红色前摇、提交白闪、玩家受击和攻击飘字。同一挥砍的两个 1 可逐个读出。
- 离屏 Boss 箭头出现在右上操作区下方。用开发布置将 Boss 放进视野后，确认箭头消失。
- `pnpm typecheck`、`pnpm fix`、`pnpm build` 通过。 `npm test` 70 项通过。Vite 5184 已关闭。
- 新图保存在 `tmp-visual-audit/canvas-before/` 和 `tmp-visual-audit/canvas-after/`。旧六张 WebGL 对比图保留在 `before/` 和 `after/`。

## 3. 未验证与已知风险

- 本轮聚焦 Chrome Canvas、320×640 HUD 与 1280×720 战斗。Boss 由开发入口放置，未等待自然首领波。其他浏览器与长时间战斗未覆盖。

## 4. 锁定接口与约束

- Toast 继续读 `data-hud-top-left`、`data-hud-hotbar`。Boss 指示器同时用 `data-hud-clock`、`data-hud-actions` 避让顶部 HUD。
- Boss 箭头采用既有 `RENDER_DEPTH.bossPointer`，固定屏幕像素尺寸。场景维持独立 Toast 层与单一 `NightOverlay`。
- 保持 VFX 公开接口、战斗数值与存档结构。

## 5. 下一棒任务

1. 在自然首领波里复测箭头随视野进出，以及多个首领同时离屏的表现。
2. 交叉验证 WebGL 与触屏浏览器的窄屏布局和连续战斗。
