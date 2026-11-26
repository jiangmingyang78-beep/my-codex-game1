# 双工具交接 · v3.2.0 战斗反馈、氛围与测试夹具

## 1. 工具与改动文件（Codex，⚠ 表示 ≥240 行）
- `game/renderDepth.ts`（新增，51）、`game/config.ts`（29）、`game/scenes/GameScene.ts`（378 ⚠）、`game/scenes/ToastScene.ts`（91）。
- `game/atmosphere/atmospherePresets.ts`（46）、`CombatMotionVfxLayer.ts`（284 ⚠）、`TorchlightAtmosphereLayer.ts`（396 ⚠）。
- `game/feedback/CombatFeelController.ts`（565 ⚠）、`combatFeelPresets.ts`（114）、`game/ui/toastTheme.ts`（256 ⚠）。
- `game/world/CampFires.ts`（63）、`EntityViews.ts`（244 ⚠）、`NightOverlay.ts`（106）、`Scenery.ts`（92）、`WorldView.ts`（136）。
- `src/frontend/src/entities/EnemyEntity.js`（132）、`src/frontend/src/vfx/particles.js`（311 ⚠）。
- 新增 `tests/fixtures/testFactories.ts`（100）、`tests/fixtures/it.ts`（9）、`tests/run-unit-tests.mjs`（43）。
- 新增 `tests/mapConsole.test.js`（204）、`runtimeRules.test.ts`（222）、`survivalTuning.test.ts`（48）、`renderDepth.test.ts`（74）。修改 `tests/ldtkAdapter.test.ts`（203）。
- `tests/run-ldtk-test.mjs`（3）、`tools/map-viewer/verify.mjs`（3）、`verifyRuntime.mjs`（6）保留原入口并转调统一运行器。`package.json`（27）增加 `npm test`。
- `README.md`（45）、`package.json`（27）、`src/frontend/package.json`（94）更新到 v3.2.0。`docs/HANDOFF.md`（29）。

## 2. 已验证项
- `pnpm typecheck`、`pnpm fix`、`pnpm build`、`npm run build` 通过。测试 TypeScript 单独检查通过，`npm test` 五份文件共 60 项通过，三个原脚本入口均通过。
- Chrome Canvas 和 WebGL 从生产构建进入主场景，验证角色和敌人 Y 排序、地面掉落与预警、弹丸与挥砍、夜幕和余烬深度、五个 VFX 批次实际绘制，以及场景退出时纹理回收。
- 实体深度测试覆盖冒险、永恒、超高地图和无效地图高度。地图测试使用 `it.each` 覆盖索敌、刷新倍率、地块映射与校验边界。

## 3. 未验证与已知风险
- 浏览器检查覆盖固定场景片段。完整冒险和永恒模式的游玩，以及五个 VFX 批次在低端设备上的长时帧率，尚未验证。

## 4. 锁定接口与约束
- `RENDER_DEPTH` 是 Phaser 渲染深度的统一来源。实体实际坐标仍由规则层控制，视图使用 `entityDepthAt(worldY, worldHeightPx)`。
- 交互框、掉落和预警位于实体下方。旧夜幕保持单层。战斗粒子、火光、气氛粒子使用独立绘制批次，VFX 公共接口和粒子模拟参数保持原样。
- 共享测试系统只读。`createTestRun` 默认种子为 12345，每次构造独立状态。可变地图草稿在用例内复制。规则、平衡数据和存档结构均无改动。

## 5. 下一棒任务
1. 在高粒子负荷的雪夜复核长期帧率与显存。
2. 实玩检查交互框、掉落和火焰遇到地形遮挡时的可读性。
