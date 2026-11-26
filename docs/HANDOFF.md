# 双工具交接记录（HANDOFF）

## 1. 本棒工具与改动清单（Codex · v3.1.0 发布）
- 更新 `README.md`（40 行）、根 `package.json`（25 行）、`src/frontend/package.json`（94 行）和 `src/frontend/src/game/ui/TitleScreen.tsx`（236 行）的版本信息。
- 更新 `tools/balance-report.mjs`（268 行 ⚠️≥240），读取新版地图中的 `pt(...)` 和 `node(...)`，重新生成 `docs/BALANCE_REPORT.md`（81 行）。
- 更新 `docs/HANDOFF.md`（27 行）和 `docs/LDTK_MAP_GUIDE.md`（52 行）。本次发布打包此前的 10 区域冒险地图、旧存档迁移、LDtk 适配器和精灵工作台（单文件版 1873 行 ⚠️≥240）。

## 2. 已验证项
- 通过 `pnpm typecheck`、`pnpm fix`、`pnpm build`、`node tests/run-ldtk-test.mjs`。
- 通过 `pnpm bal`，核对报告覆盖 10 个区域。验证精灵工作台首页、资源列表及 PNG 请求。
- 用 `v2.0.0` 和 `v3.0.0` 发布代码生成旧档并成功读取。用 Edge 实测从 `v3.0.0` 的霜脊档继续游戏，保存为结构版本 4，再次刷新继续游戏。
- 回归覆盖地形碰撞、守卫血量与击败记录、待拾取炉印、开门进度、备份恢复，以及已使用扩展地图的结构版本 3 存档保留原坐标。

## 3. 未验证与已知风险
- 尚未完成扩展冒险全流程和真实 LDtk 导出地图的实机测试。LDtk 的 `StoryProp` 尚未映射一次性奖励字段。
- 数值报告按地图配置计算固定矿点共 16 矿，最多熔 8 锭。完整唯一/进度配方合计需求 13 锭，实际通关路线及废铁替代供给待试玩。
- 警戒行数文件（≥240）：`worldGen.ts`(291)、`worldLayout.ts`(270)、`dataTypes.ts`(269)、`GameScene.ts`(263)、`interact.ts`(260)、`meta.ts`(255)、`EntityViews.ts`(250)、`seasonsWeather.ts`(247)。

## 4. 锁定的接口与约束
- `sanitizeRunState(raw, sys)` 负责坐标迁移。结构版本 4 表示已使用当前地图坐标。版本 3 的开发存档通过新增刷怪点或对应击败记录识别。
- `loadRun` 在内存中迁移，下一次正常保存才写结构版本 4，仍保留上一个有效存档作为备份。localStorage 键名沿用原值。
- `ldtkAdapter.ts` 锁定导出 `LdtkProjectJson` 与 `buildWorldFromLdtk(ldtk, data, levelIndex = 0): World`。
- `worldGen.ts` 锁定 `getWorld(data: GameData, ldtkMap?: LdtkProjectJson): World`（未传 `ldtkMap` 时命中 `worldsByData` 缓存并返回程序生成世界）。

## 5. 下一棒任务
1. 从新档完整试玩冒险流程直到点燃烽台，核对关卡路线、碰撞和制作材料供给。
2. 按 `docs/LDTK_MAP_GUIDE.md` 导出并试玩完整地图，按需要补齐 `StoryProp` 奖励字段。
