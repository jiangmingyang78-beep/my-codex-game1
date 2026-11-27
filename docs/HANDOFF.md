# 双工具交接 · v3.2.0 冬景细化与矿脉筛选

## 1. 工具与改动文件（Codex，⚠ 表示 ≥240 行）
- 本次将 `emberwood-v3.2.0-latest (2).zip` 的新增功能接入 `11732d4` 上的源码。
- `src/frontend/src/game/textures/worldTexture.ts`（270 ⚠）：冰岸和林道使用双层边缘，补绘内外转角。
- `src/frontend/src/game/textures/snowPine.ts`（124）、`registerTextures.ts`（224）、`../world/WorldView.ts`（161）：4 种环境树冠，各 4 个变体。
- `src/frontend/survival.html`（5036 ⚠）：小地图可筛选 7 种矿物，即时高亮目标并压暗其他矿物。
- `docs/HANDOFF.md`（25）：记录导入范围与验证。

## 2. 已验证项
- `pnpm typecheck`、`pnpm fix`、`pnpm build` 通过。`npm test` 的 60 项现有测试通过。
- Chrome Canvas 生产构建确认注册 16 张覆雪松树贴图、实际绘制树冠，以及绘制冰岸和林道边缘与冰岸内外转角。4 套像素图案均与附件一致。
- Chrome Canvas 生存入口确认 7 个筛选项、目标高亮、其他矿物变暗、清除后恢复原图，以及方向键可切换选项。两个入口均无页面脚本异常。

## 3. 未验证与已知风险
- 冬景尚未在 WebGL、最大缩放和低端设备上实玩。生存检查覆盖初始小地图，未逐个走访 7 种矿物的产地。
- 本轮未复测已有存档迁移和完整冒险流程。

## 4. 锁定接口与约束
- `bakeWorldCanvas(world, art)`、`TileArt`、VFX 公共接口、存档结构不变。永恒模式沿用既有地表和树木。
- 新覆雪松树纹理键由 `TEX.snowPine(form, variant)` 生成。筛选仅影响生存小地图，变化时清空 `miniOrigin`，矿物继续由 `veinAt()` 和 `COAL_VEIN` 判定。

## 5. 下一棒任务
1. 在 WebGL 下走访冒险的营火、密林和冰岸，复核树冠遮挡及岸线连贯性。
2. 在生存中跨生物群系寻找矿脉，复核当前地图范围内的高亮与采集后的刷新。
