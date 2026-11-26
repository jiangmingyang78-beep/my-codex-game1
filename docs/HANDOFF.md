# 双工具交接记录（HANDOFF）

## 1. 本棒工具与改动清单（Antigravity — 生存模式地图生成模块抽离与单一真源收敛）
- **新增**：
  - `src/frontend/src/systems/survival/survivalBiomes.ts`（214）：9 种群系定义、经典树/石初始点位、区块/边界常量与坐标键编解码。
  - `src/frontend/src/systems/survival/survivalNoise.ts`（151）：确定性哈希 `seededValue`、双线性插值噪声 `terrainNoise`、FNV-1a `seedFromText`、外域 `expandedBiome` 与 LRU `getOrCreateSurvivalChunk`。
  - `src/frontend/src/systems/survival/survivalWorldGen.ts`（234）：经典底图 `buildBaseClassicWorld`、生存旧林地叠加 `applyClassicSurvivalTerrain`、十字通道 `carveCampPassages`、种子核心盆地 `generateSurvivalTerrain` 与生态回退 `resolveEcologyBiome`。
- **修改**：
  - `src/frontend/survival.html`（5005 ⚠️≥240，由 5157 行精简 152 行）：移除内联地图/群系/噪声生成实现，统一改为导入 `systems/survival/*`。
  - `tools/map-viewer/adapters/survivalAdapter.ts`（179，由 236 行精简 57 行）：移除重复地形算法副本，直接复用 `@/systems/survival/*` 单一真源。
- **同工作区保留未提交前棒改动**：`pixelFilter.ts`（16）、`createGame.ts`（69）、`GameScene.ts`（265 ⚠️）、`EntityViews.ts`（249 ⚠️）、`heroSprites.json`（82）、`tools/generate-hero-sheets.mjs` 及 5 张英雄 `128×128` PNG 原样保留未触碰。
- **零改动确认**：`src/frontend/src/core/snapshot*`、`src/frontend/src/vfx/**` 与生存存档格式（`SAVE_VERSION = 8`）零改动。

### Codex 发布复核
- 生存地图预览适配器补齐资源密度参数。核心盆地和外域都从控制台取值并调用共享生成器。
- 本次将上列生存模块、前棒英雄贴图与生成工具一并提交。远端 Pages 工作流和 CNAME 一并保留。

## 2. 已验证项
- Codex 重跑 pnpm typecheck、pnpm fix、pnpm build、控制台独立 tsc、verify.mjs 和 verifyRuntime.mjs，均通过。
- 通过 `pnpm fix`、`pnpm typecheck`、`pnpm check`（198 文件 0 告警）、`pnpm build`（含 `index.html` 与 `survival.html` 双入口构建）。
- 通过 `pnpm bal -- --summary`（9 项健康度检查 0 严重 / 0 警告）。
- 通过 `pnpm map` 无头启动烟雾验证（`/adapters/survivalAdapter.ts` 与 `survivalWorldGen.ts` 编译响应 HTTP 200）。
- 新增 TS 模块全部 < 240 行。

## 3. 未验证与已知风险
- `survival.html` 在浏览器内的实机游玩（旧林地 `classic` 存档读取、自定义种子新开局、跨 Chunk 移动卸载与野外植物刷新）仅完成静态构建校验，尚未人工实机试玩。
- `survival.html` 仍保留渲染、UI 与配方制作逻辑（5005 行 ⚠️），后续可按子域继续渐进拆分。

## 4. 锁定的接口与约束
- `survivalCellKey(x, y)` 与 `survivalCellCoordinates(id)` 的编码规则必须保持不变（`0..49 × 0..31` 内用整数索引 `y * 50 + x`，越界用 `"x,y"`），以兼容既有 `emberwood-survival-1` 存档。
- `seededValue`、`terrainNoise`、`seedFromText`、`generateSurvivalTerrain` 的盐值与计算顺序锁定，保证同一种子地形 100% 一致。

## 5. 下一棒任务
1. 启动前端或双击 `tools/打开地图浏览器.bat`，实机验证生存模式 `classic` 与自定义种子的进入、建造、存档读档表现。
2. 按需继续渐进抽离 `survival.html` 中的野生动物/配方科技表至 `src/frontend/src/systems/survival/`，或调优 `charcoal` / `iron_scrap` 冒险经济曲线。
