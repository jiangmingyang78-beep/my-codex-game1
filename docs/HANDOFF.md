# 三模式空间运行时交接

## 1. 工具与改动文件

- Codex 导入并提交新版。括号内为文件行数，⚠ 标记至少 240 行的文件。
- docs · ARCHITECTURE_REVIEW.md（87）、BALANCE_PLAYTEST.md（45）、BALANCE_REPORT.md（140）、BESTIARY_AND_NOTES_DRAFT.md（376 ⚠）、EASTER_EGGS_BACKLOG.md（105）、HANDOFF.md（52）、MVP_CHECKLIST.md（124）、SPATIAL_RUNTIME.md（61）
- src/frontend/public · survival-balance.schema.json（91）
- src/frontend/src/core · dataTypes.ts（295 ⚠）、dataValidator.ts（241 ⚠）、gameData.ts（79）、itemTypes.ts（91）、messages.ts（41）、run.ts（241 ⚠）、save.ts（219）、snapshot.ts（123）、snapshotReaders.ts（220）、survivalDataValidator.ts（172）、types.ts（200）、vfxBridge.ts（77）
- src/frontend/src/core/schemas · adventure.ts（280 ⚠）、survival.ts（202）
- src/frontend/src/data · balance.json（122）、catalogDefinitions.json（149）、elements.json（12）、enemies.json（706 ⚠）、items.json（334 ⚠）、plants.json（178）、recipes.json（348 ⚠）、survivalCampProjects.json（85）、survivalCatalog.json（207）、survivalRecipes.json（112）、survivalRhythm.json（33）、survivalRockArt.json（89）、survivalSfx.json（73）、weather.json（185）
- src/frontend/src/entities · EnemyEntity.ts（79）、enemySeeds.ts（299 ⚠）
- src/frontend/src/game/atmosphere · SnowFootprintLayer.ts（146）、TorchlightAtmosphereLayer.ts（270 ⚠）、pixelLightMask.ts（42）
- src/frontend/src/game/audio · sfx.ts（257 ⚠）
- src/frontend/src/game/dev · DevToolbar.tsx（227）、renderMetrics.ts（1）
- src/frontend/src/game/scenes · bindSceneCommands.ts（96）
- src/frontend/src/game/session · craftView.ts（141）、eventFeedback.ts（259 ⚠）
- src/frontend/src/game/textures · survivalAnimalArt.ts（129）、survivalCampProjectArt.ts（84）、survivalFarmArt.ts（188）、survivalPlantStages.ts（48）、survivalRainArt.ts（82）、survivalRockArt.ts（101）、survivalShoreArt.ts（155）、survivalTreeArt.ts（147）
- src/frontend/src/game/ui · CraftPanel.tsx（167）、commands.ts（98）、store.ts（184）
- src/frontend/src/game/world · CampFires.ts（87）、ElementMarks.ts（52）、EntityViews.ts（283 ⚠）、NightOverlay.ts（105）、Scenery.ts（129）、SnowClockArt.ts（263 ⚠）、WorldView.ts（168）
- src/frontend/src · main.tsx（8）
- src/frontend/src/systems · EnemyManager.ts（380 ⚠）、buffs.ts（99）、crafting.ts（154）、inventory.ts（168）、movement.ts（260 ⚠）、recipeBook.ts（52）、survival.ts（201）
- src/frontend/src/systems/combat · combatMath.ts（54）、ecology.ts（196）、enemyAi.ts（236）、enemySpawn.ts（136）、loot.ts（173）、projectilePool.ts（27）、skirtLight.ts（101）、spawnPopulation.ts（99）、spawnRules.ts（127）
- src/frontend/src/systems/eternal · eternalDirector.ts（184）、eternalSpawn.ts（142）、eternalWorld.ts（92）
- src/frontend/src/systems/survival · campApproach.ts（37）、campProjects.ts（162）、nightForecast.ts（114）、raidSpawn.ts（87）、rhythm.js（59）、survivalNoise.ts（154）、weatherRenderer.ts（129）、weatherSystem.ts（190）
- src/frontend/src/systems/world · collision.ts（111）、dawn.ts（73）、elementGrid.ts（283 ⚠）、flowField.ts（106）、fovShadowcast.ts（86）、interact.ts（275 ⚠）、lightGrid.ts（211）、regionEffects.ts（156）、runContext.ts（29）、runElements.ts（143）、runLight.ts（60）、worldContext.ts（233）、worldGen.ts（300 ⚠）、worldTypes.ts（103）
- src/frontend/src/vfx · particlePresets.js（112）、particleSimulation.js（143）、particles.js（312 ⚠）
- src/frontend · survival.html（5359 ⚠）
- src/frontend/tests · adventure-regression.js（294 ⚠）、spatial-stress.js（120）
- tests · ecologyRecipeBook.test.ts（211）、elementGrid.test.ts（250 ⚠）、mapConsole.test.js（217）、runtimeRules.test.ts（224）、spatialRuntime.test.ts（166）、winterSurvival.test.ts（221）
- tools · balance-report.mjs（318 ⚠）
- tools/map-viewer/panels · SpawnRulePanel.ts（93）
- tools/map-viewer · verifyLongRun.browser.ts（189）

## 2. 已验证项

- 本次导入复验 TypeScript、Biome 和 Vite 生产构建，155 项单测全部通过。
- 新版原有冒险回归、三模式测试和永夜 84 敌人压测见 SPATIAL_RUNTIME.md。种子 42 的生存新档实玩记录见 BALANCE_PLAYTEST.md。

## 3. 未验证与已知风险

- 本次导入未重跑浏览器实玩与压测。原有压测仍记录到 GC，真机 GPU 时间与跨越 32 格窗口的追击待复测。

## 4. 锁定接口与约束

- VisibilityMask.compute / has、FlowField.compute / step 和适配器 solid、opaque 使用格坐标。IWorldContext.prepare / steer 使用世界像素。
- ISpawnDirector.accepts 汇合容量、亮度、距离与碰撞校验。各模式决定波次。RunState 的 WeakMap 缓存不写入存档。
- 地形通行性变化更新版本，亮度和元素变化更新各自的 revision。复用对象前清除可选目标、威胁和物理状态。生存旧档草药架交付继续通过 legacyCredit 迁移。

## 5. 下一棒任务

1. 在目标硬件复测永夜 84 敌人场景及 GC 暂停。
2. 复测跨越局部窗口的大型障碍追击。
