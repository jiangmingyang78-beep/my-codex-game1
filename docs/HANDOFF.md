# 双工具交接 · v3.2.0 雪夜地表与生存矿纹

## 1. 工具与改动文件（Codex，⚠ 表示 ≥240 行）
- 导入前将当前游戏的 7 个源文件改动保存到 Git `31cbe03`。
- `src/frontend/src/game/textures/worldTexture.ts`（228）：连续积雪、冰面边缘和林道绘制。
- `src/frontend/src/game/textures/snowPine.ts`（新增，51）、`registerTextures.ts`（215）、`../world/WorldView.ts`（140）：覆雪松树绘制、注册和选择。
- `src/frontend/survival.html`（5013 ⚠）：为石英、铜矿、黏土、铁矿、霜晶矿、盐和煤炭接入独立像素图案。
- `docs/HANDOFF.md`（25）：记录导入范围与验证。

## 2. 已验证项
- `pnpm typecheck`、`pnpm fix`、`pnpm build` 通过。`npm test` 的 60 项现有测试通过。
- Chrome Canvas 生产构建进入冒险，捕获积雪、覆雪松枝和冰边的绘制，保存后重新进入页面可以继续。
- Chrome Canvas 生产构建进入生存，确认初始化 7 种矿纹且初始视野实际绘制矿纹。存档后刷新恢复相同地图种子，两个入口均无页面脚本异常。

## 3. 未验证与已知风险
- 雪夜尚未在 WebGL、最大缩放和低端设备上实玩。生存冒烟检查覆盖初始视野，未逐个走访 7 种矿物的产地。
- 仅复跑了仓库现有 60 项测试。附件截图提到的 130 项回归未随发布包提供。

## 4. 锁定接口与约束
- `bakeWorldCanvas(world, art)`、`TileArt`、VFX 公共接口、存档结构不变。
- 用 `ETERNAL_TEXTURE_KEY` 保留永恒模式的原有地表和松树。矿纹只接入 `tiles()` 的绘制路径，矿物判定仍走 `veinAt()` 与 `COAL_VEIN`。

## 5. 下一棒任务
1. 在 WebGL 下实玩冒险雪夜，复核冰岸、路径与营火附近的可读性。
2. 在生存地图中走访 7 种矿物，确认原始缩放与夜间光照下仍可辨认。
