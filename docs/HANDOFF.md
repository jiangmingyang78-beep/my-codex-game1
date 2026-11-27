# 双工具交接 · 触屏布局与永恒长局复验

## 1. 工具与改动文件

Codex。⚠ 表示至少 240 行。

- `game/createGame.ts`（88）观察画布宿主尺寸，同步 Phaser Scale Manager。退出时断开观察器。
- `game/ui/Hud.tsx`（170）粗指针的暂停、静音热区增至 44px 高。
- `game/ui/PauseMenu.tsx`（65）限制暂停面板最大高度，面板内可滚动。
- `game/ui/ToastManager.ts`（318 ⚠）、`game/ui/toastBridge.ts`（111）、`game/feedback/CombatFeelController.ts`（423 ⚠）提供并消费 1:1 Toast 实际矩形，供离屏箭头避让。
- `docs/HANDOFF.md`（35）记录本轮复验。源码路径以 `src/frontend/src/` 为起点。

## 2. 已验证项

- Chrome SwiftShader WebGL 触屏模拟完成 320×640 → 568×320 → 320×640。画布随视口重排，快捷栏两排 → 一排 → 两排，竖屏双行 Toast 安全间距 20px。
- 检查五个快捷栏按钮和两个 HUD 按钮角落的命中区域。点击距边 3px 的模拟触点可静音和暂停，继续按钮可恢复游戏。横屏暂停面板完整留在视口内。
- 永恒时钟未加速。第 2、4、6、8 分钟各自然刷出一只首领，8:02 确认四只共存，第三波为烽台守卫。
- 四首领同向离屏分别测试竖屏右侧、竖屏上侧及横屏下侧。截图像素均识别出四枚独立箭头，横屏 Toast 可见时仍能辨认。
- `pnpm typecheck`、`pnpm fix`、`pnpm build` 与 `npm test`（70 项）通过。Vite 5184 已关闭。
- 复验图保存在 `tmp-visual-audit/endurance-before/`、`endurance-after/` 和 `endurance-natural/`，之前的 39 张截图均保留。

## 3. 未验证与已知风险

- Windows 报告 0 个触点，且未发现可控制的实体触屏设备。本轮触点证据来自浏览器模拟。
- 使用开发无敌保护角色以便等待首领。自然刷出后在浏览器中统一摆位测试同向箭头。未测长局通关及实体设备帧率。

## 4. 锁定接口与约束

- `getToastBounds(): DOMRect[]` 返回当前 Toast 场景中的屏幕坐标，供 Boss 箭头避让。Toast 独立场景保持 1:1。
- 保持既有 `RENDER_DEPTH`、VFX 公开接口、战斗数值与存档结构。画布尺寸以宿主元素为准。

## 5. 下一棒任务

1. 连接实体触屏设备，复测方向切换、HUD 角落点按和短屏暂停菜单滚动。
2. 在低性能设备复测长局渲染帧率及更拥挤场景中的箭头可读性。
