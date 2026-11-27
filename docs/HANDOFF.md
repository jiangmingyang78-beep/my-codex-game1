# 双工具交接 · 生存世界生成源码合并

## 1. 工具与改动文件

Codex 将 `emberwood-survival-worldgen (1).zip` 的增量合入工作区，以 `849d5e4` 为比较基准。同一段冲突优先使用包内实现，本地独有的改动保存在工作区。⚠ 表示至少 240 行。

- `.` · README.md（80）。 `docs` · LDTK_MAP_GUIDE.md（70）、MAP_CONSOLE.md（77）
- `src/frontend/public` · survival-balance.json（3）、survival-balance.schema.json（88）。 `src/frontend/src/core` · dataReferences.ts（51）、dataSchemas.ts（8）、dataTypes.ts（289 ⚠）、dataValidator.ts（233）、gameData.ts（77）、run.ts（231）、save.ts（214）、schemaChecks.ts（96）
- `src/frontend/src/core/schemas` · adventure.ts（270 ⚠）、configuration.ts（115）、encounterPieces.ts（142）、survival.ts（134）。 `src/frontend/src/core` · snapshotReaders.ts（213）、survivalDataValidator.ts（125）、types.ts（182）
- `src/frontend/src/data` · balance.json（119）、encounterLevels.json（82）、encounters.json（486 ⚠）、enemies.json（676 ⚠）、survivalCatalog.json（205）、survivalRecipes.json（100）
- `src/frontend/src/entities` · EnemyEntity.ts（71）、enemySeeds.ts（299 ⚠）
- `src/frontend/src/game/atmosphere` · SnowFootprintLayer.ts（138）、TorchlightAtmosphereLayer.ts（231）
- `src/frontend/src/game/dev` · DevToolbar.tsx（189）、spawnDebug.ts（57）
- `src/frontend/src/game/scenes` · GameScene.ts（371 ⚠）
- `src/frontend/src/game/textures` · encounterProps.ts（65）
- `src/frontend/src/game/ui` · survivalLandmarkMap.ts（71）
- `src/frontend/src/game/world` · CampFires.ts（61）、EntityViews.ts（259 ⚠）、NightOverlay.ts（87）、Scenery.ts（95）、cameraRig.ts（46）、darkness.ts（1）
- `src/frontend/src` · main.tsx（7）
- `src/frontend/src/shared` · metaUnlocks.js（99）、monsterCatalog.js（88）
- `src/frontend/src/systems` · EnemyManager.ts（260 ⚠）、campCircle.ts（68）
- `src/frontend/src/systems/combat` · combat.ts（29）、enemySpawn.ts（158）、enemyValidation.ts（126）、heroAttack.ts（117）、spawnPopulation.ts（66）、spawnRules.ts（119）
- `src/frontend/src/systems/eternal` · eternalDirector.ts（184）、eternalSpawn.ts（148）、eternalTypes.ts（78）
- `src/frontend/src/systems` · movement.ts（242 ⚠）、runtimeRules.ts（9）
- `src/frontend/src/systems/survival` · campProjects.ts（74）、encounterCatalog.ts（23）、encounterPlan.ts（250 ⚠）、landmarks.ts（122）、legacySurvivalGen.ts（208）、plantRegistry.ts（101）、plantSystem.ts（305 ⚠）、survivalBiomes.ts（242 ⚠）、survivalNoise.ts（152）、survivalPasses.ts（325 ⚠）、survivalWorldGen.ts（227）、weatherRenderer.ts（112）、weatherSystem.ts（178）
- `src/frontend/src/systems` · survivalOverrides.js（68）、survivalTuning.ts（34）
- `src/frontend/src/systems/world` · darkness.ts（27）、ldtkAdapter.ts（282 ⚠）、lightGrid.ts（133）、regionEffects.ts（152）、runLight.ts（52）、setPieceStamp.ts（123）、worldTypes.ts（95）
- `src/frontend` · survival.html（5084 ⚠）、tsconfig.json（35）
- `tests` · dataValidator.test.ts（210）、encounterPieces.test.ts（202）、lightSpawn.test.ts（147）、mapConsole.test.js（218）、runtimeRules.test.ts（222）、survivalTuning.test.ts（111）、survivalWorldGen.test.ts（359 ⚠）
- `tools` · balance-report.mjs（303 ⚠）
- `tools/map-viewer/adapters` · survivalAdapter.ts（186）
- `tools/map-viewer` · enemyDocuments.mjs（20）、mapInteraction.ts（247 ⚠）、mapRenderer.ts（238）
- `tools/map-viewer/panels` · SpawnRulePanel.ts（92）
- `tools/map-viewer` · serverApi.mjs（164）
- `tools/map-viewer/state` · documents.ts（71）、ruleConfig.ts（8）、validation.ts（117）
- `tools/map-viewer` · types.ts（99）、vite.config.mjs（35）
- 迁移后退役 · legacyEnemies.json、EnemyEntity.js、enemySeeds.js、EnemyManager.js、enemyValidation.js、plantRegistry.js、plantSystem.js、weatherRenderer.js、weatherSystem.js。
- `docs/HANDOFF.md`（60）。

## 2. 已验证项

- `pnpm typecheck`、地图控制台类型检查、`pnpm fix`、`pnpm build` 通过。`npm test` 129 项通过。
- Chromium 本地验证生存模式、建档种子 42、移动及重新载入同一世界，冒险模式可开局。提交使用包内的生存页面和 TypeScript 天气实现。既有雨滴落地、其他生存美术及 DEV 列表刷新留在工作区。
- 既有横竖屏画布同步、暂停菜单和箭头避让 Toast 源码保留。此前所有验收截图仍在工作区。

## 3. 未验证与已知风险

- 本轮实机未遍历所有奇遇、旧存档、地图控制台和天气组合。包内已有的种子与奇遇测试记录不能替代合并后的完整实机验证。
- 生存模式套用新版目录、配方、区块生成及出生规则。旧天气 JS 文件由 TypeScript 版本取代。

## 4. 锁定接口与约束

- `stampSetPieceIntoWorld(worldGrid, setPiece, originX, originY, rng)` 使用格坐标，LDtk 和手写模板共用变换与盖章。
- 生存世界 v3 的实例 ID 由种子决定，与区块加载顺序无关。旧版世界使用旧布局。
- `encounterProgress.discovered` 和 `encounterProgress.spent` 保存发现与消耗。重载后应防止重复发奖与触发。
- `getToastBounds()` 返回 1:1 屏幕坐标，保留 HUD 排版和箭头避让契约。

## 5. 下一棒任务

1. 用既有 v1/v2 生存存档和新 v3 世界做一次对照读档，核查奇遇状态与奖励持久化。
2. 在生存实机跑完昼夜天气循环并验证地图控制台读写。
