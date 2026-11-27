# 双工具交接 · 暮色预警、营地修缮与地标

## 1. 工具与改动文件（Codex，⚠ 表示 ≥240 行）

- `src/frontend/survival.html`（5179 ⚠）接入夜袭 HUD、研究台修缮、修缮奖励、世界地标和本地存档。
- `src/frontend/src/data/survivalCampProjects.json`（22）、`src/frontend/src/systems/survival/campProjects.ts`（73）定义三项修缮及交付规则。
- `src/frontend/src/systems/survival/nightForecast.ts`（17）计算下一定时波次。
- `src/frontend/src/systems/survival/landmarks.ts`（84）、`src/frontend/src/game/ui/survivalLandmarkMap.ts`（58）处理地标、方位和小地图标记。
- `src/frontend/src/game/textures/survivalCampProjectArt.ts`（27）绘制井架、织垫和料槽。
- `tests/survivalCampNavigation.test.ts`（61）覆盖预警、分批交付、旧档坐标和箭头投影。
- `docs/ARCHITECTURE_REVIEW.md`（80）、`docs/MVP_CHECKLIST.md`（105）、`docs/HANDOFF.md`（32）记录实现和验收。

## 2. 已验证项

- `pnpm typecheck`、`pnpm fix`、`pnpm build` 和 64 项单元测试通过。
- Chrome 生产构建使用测试存档走查首波和次波提示、火苗变暗、烽火台压制和离开保护范围。
- Chrome 验证旧档载入、分批交付及刷新恢复、三项装饰和收益，以及地标更新、箭头、删除与世界隔离。
- Chrome 验证 375 像素触屏模拟和冒险入口启动。

## 3. 未验证与已知风险

- 实际手机、从黎明自然游玩至整夜结束、修缮材料长期获取节奏尚未实玩走查。

## 4. 锁定接口与约束

- 夜袭生成和预警共用 `nightWaves`、`waveSlot` 及同一入夜时间。`inBeaconProtection` 同时用于 HUD 和夜袭生成。
- 本地存档仍用版本 8。世界对象新增三个可选字段 `campProjects`、`landmarks` 和 `landmarkTarget`。地标用 `x,y` 标识，`camp` 保留给篝火营地。
- 修缮进度按工程 ID 和材料键持久化，收齐即完成。VFX 公开接口沿用现有版本。

## 5. 下一棒任务

1. 用实际手机走查采集、分批修缮和天黑返营，观察视口内提示和地标操作。
