# 《余烬林：最后一炬》架构评审（基础任务）

评审对象：`GDD_AND_SPEC.md`、`MVP_HANDOFF.md`、`src/data/*.json`、`tools/validate-mvp.cjs`、`src/vfx/*.js`。
结论：`node tools/validate-mvp.cjs` 通过（15 物品、9 配方、5 敌人、4 区域、2 驻守奖励、VFX 导入）。该脚本只校验引用，不校验运行时规则，下列条目是读文档、读 JSON 和读 VFX 源码时发现的不一致与风险。路径均相对 `src/frontend/src/`。

## 一、不一致与修复

| # | 问题 | 修复 | 落点 |
| --- | --- | --- | --- |
| 1 | GDD 规定 Vite + 原生 JS，本项目是 React 19 + TypeScript strict，且 `allowJs` 为 false，7 个 VFX 模块是纯 JS，也不满足本项目 lint 规则。 | `tsconfig.json` 开启 `allowJs`、关闭 `checkJs`，保留 `resolveJsonModule`。`biome.json` 忽略 `src/vfx/**`。VFX 文件内容与公开签名未改。 | `tsconfig.json`、`biome.json` |
| 2 | 交接文档把 `step` 签名写成 `step(state, {sec,input,frame,commands}, systems)`，而 `createRun(config, snapshot?)` 的 `config` 内容未定义。 | `step(state, request, systems?)`，`systems` 缺省取 `getSystems()`。`createRun(config?: {systems?, seed?, runId?}, snapshot?)`，快照经校验和深拷贝后使用。 | `core/run.ts`、`core/systems.ts`、`core/types.ts` |
| 3 | GDD 称系统函数为 `inventory.use`，函数名 `use*` 被 React hooks lint 规则判为 Hook，在条件分支里调用会报错。 | 改名为 `consumeItem`，其余名称保持，面板命令里的类型仍是 `use`。 | `systems/inventory.ts`、`core/commands.ts` |
| 4 | 地图文件 `snowland.json` 与 Tiled 图集缺失，而 regions.json 的对象 ID 与 spawnId 需要坐标。 | 按固定种子程序生成 96×64 瓦片网格和碰撞，只含 `camp_edge`（x 0–47）与 `old_mill`（x 48–95，y 0–47）。对象 ID 全部取自 regions.json，坐标集中在 `worldLayout.ts`，将来换成 Tiled 时只需替换该层。 | `systems/world/worldLayout.ts`、`worldGen.ts` |
| 5 | regions.json 中的 `relaySocketId` 含 `ice_gorge_relay`，该区域不在本阶段范围，若直接统计会误算「未点亮插槽」。 | 配方上限与火圈计算只统计存在于当前世界的插槽。 | `systems/crafting.ts`（`unlitRelaySlots`）、`systems/campCircle.ts` |
| 6 | 昼夜相位、天数既可存也可推导，存档里存旧值会和 `elapsedSec` 冲突。 | 相位和天数一律由 `elapsedSec` 推导，读档时丢弃存档里的值并重算。 | `core/clock.ts`、`core/snapshot.ts` |
| 7 | 饱食流失按「每分钟」配置，其余指标按秒，容易用错单位。 | 统一在 survival 里换算为每秒并累加，小数保留在状态里。 | `systems/survival.ts` |
| 8 | 受伤无敌 0.65 秒由玩家受击、饥饿和黑暗三类伤害共享，GDD 没写被无敌挡住的饥饿、黑暗伤害是否丢失。 | 被挡住的饥饿和黑暗伤害不清零计时，下一帧重试，避免伤害被无敌窗口吞掉。 | `systems/survival.ts`（`damageHero`） |
| 9 | 胜负同帧冲突只说「死亡优先」，没有覆盖「风暴失守」与死亡同帧。 | HP ≤ 0 判死亡优先，其后才判 `elapsedSec ≥ runLimitSec`；终局后 `step` 不再推进。 | `core/run.ts`（`checkEnd`） |
| 10 | 事件的 `x`、`y` 允许为 `null`，而 VFX 对非有限坐标会抛错。 | `toVfxEvent` 对无位置或非有限坐标的事件返回 null；`camp.upgraded` 映射为点火爆发。 | `core/vfxBridge.ts` |
| 11 | 局外笔记「结算按 runId 幂等」没有数据结构支撑。 | meta 存 `settledRunIds`（最多 20 条），同一 `runId` 的 `run.ended` 不重复触发笔记；笔记存于独立 `metaKey`，不与局内存档混写。 | `core/meta.ts` |
| 12 | 存档损坏、版本不符、存储被禁用三种情形的提示未区分。 | `loadRun` 返回 `empty/ok/recovered_backup/fallback_new/unavailable` 和中文提示；主档失败时尝试备份；`saveRun` 写入前先把当前有效主档复制到备份键，失败不破坏上一次好档。 | `core/save.ts`、`core/storage.ts` |
| 13 | 固定战利品（炉印）的「待拾取」状态：背包满时拾取被拒，不能丢失。 | 炉印以 `pickupId` 写入 `changesByObjectId[...].loot`，状态为 `pending` 或 `picked`，拾取被拒时留在地面。`seals` 保存已拾取的 `pickupId`，读档时按它重建背包里的 `ember_seal` 数量。 | `systems/combat/loot.ts`、`core/snapshot.ts` |
| 14 | 夜袭实例 ID 文档只说「由轮次与出生点共同派生」。 | 规定为 `night{round}_{spawnId}`，同时写入 `nightRound`，天亮按 `nightRaid.spawnedIds` 撤离。 | `systems/combat/enemySpawn.ts` |
| 15 | 读档时英雄坐标可能落在碰撞格内（地图改版或存档被改）。 | 读档校验坐标有限并在地图范围内，落在实体格时重置到 `heroStart`。 | `core/snapshot.ts` |
| 16 | 存档里的数量、血量、计时没有范围校验，非有限值会污染计时。 | 所有数值字段做有限值与范围检查，不合格整份存档视为损坏。库存数量不得超过 `maxStack`，物品 ID 必须存在。 | `core/snapshot.ts` |

## 二、缺失的边界情况（已补）

- 背包满时采集：拒绝并返回原因，节点 `gathered` 保持 false，资源不丢失（`systems/inventory.ts` 的 `pickUp`）。
- 绷带在满血时拒绝，不消耗物品（`consumeItem`，`requiresBelowMax`）。
- 配方缺料时按材料逐项返回缺口，不消耗任何输入（`systems/crafting.ts`）。
- 唯一装备（提灯、铁矛）已持有时拒绝再次制作；火盆一次最多制作「未点亮插槽数」个。
- 暖汤重复使用刷新时长，不叠层；提灯与暖汤的火光消耗倍率相乘（`systems/buffs.ts`）。
- 单帧 `sec` 为负、NaN、过大时被夹到 `[0, maxStepSec]`（`core/clock.ts`）。
- 磨坊门在营火 1 级时拒绝，原因码 `camp_level_too_low`，由 `reasonMessage` 转为中文。

## 三、性能风险

| 风险 | 事实 | 处理 |
| --- | --- | --- |
| 粒子预算 | `particles.js` 在减弱动效时硬编码 `Math.min(30, maxParticles)`，与 `balance.limits.reducedMotionMaxParticles` 是两处独立常量。冲击环数量上限同样等于 `maxParticles`（`particleSimulation.js` 中 `rings.length>=maxParticles`），最坏情况可达 120 个环；环境粒子上限为 `min(150, 60%)`。 | VFX 公共接口不可改，因此在 `core/vfxBridge.ts` 提供 `particleBudget(data, reducedMotion)`，让场景传入一致的上限；场景应同时限制每帧事件数。 |
| 冲击环数组 | 超限时用 `rings.shift()`，每次 O(n)。 | 上限 120，可接受，不修改 VFX。 |
| Canvas 纹理缓存 | `setBounded` 默认上限 256 项，先进先出淘汰。`registerCanvasTexture` 已注册到 Phaser 的纹理不会随之释放。 | 启动阶段只生成本次使用的纹理（GDD 已要求）；场景销毁时调用 `fx.destroy()`。 |
| 逐帧分配 | `step` 在 `input` 缺省时才创建空对象；碰撞移动复用同一输出对象；敌人遍历用 `for...in`，不建数组；`buildHudModel` 会分配，所以仅用于 HUD 刷新频率。 | 场景侧应复用同一个 `request` 对象，HUD 以约 10 Hz 刷新。 |
| 同屏实体 | 活动敌人上限 8、弹体 12。 | 夜袭生成与弹体发射均检查 `balance.limits`（`enemySpawn.ts`、`enemyAi.ts`）。 |
| 单帧步长 | 规则步长封顶 0.05 秒，帧率低于 20 FPS 时游戏时间慢于现实。 | 与 GDD 一致，视为有意的设计（等同于卡顿时暂停）。 |
| 文件长度 | GDD 规定每文件不超过 299 行。 | 当前最长文件为 272 行（`core/snapshot.ts`）。 |

## 四、已知未实现或待确认

- GDD 提到的「开发环境 30 秒昼夜验证开关」本阶段未实现；`RunConfig` 尚无时钟倍率，可在后续任务中加入。
- 冰角兽、煤影、烽台守卫的数据已加载，但它们所在区域不在本阶段范围内，不会在 `camp_edge`、`old_mill` 出现。
- `legacyAssetReferences` 只作迁移参考，运行时不读取。
- `core` 与 `systems` 之间存在仅类型层面的相互导入（`RunState` 引用 `World`），运行时无循环依赖。

## 五、占位资源假设

1. 瓦片地图：用程序生成的瓦片类型网格代替 `snowland.json`；地面纹理由 VFX 的 `createTileTextures` 提供，坐标常量在 `worldLayout.ts`。
2. 角色、敌人、物品、图标：无图集，场景任务用 `proceduralTextures` 生成的纹理或简单几何形状作占位。
3. 音效：无音频文件；事件流（`GameEvent`）是后续合成音效的唯一入口。
4. 旧版 `outputs/Emberwood.html` 不在交接包内，因此 `legacyAssetReferences` 无法核对，新游戏全部使用新 ID。
5. 界面文字全部为中文，机器原因码通过 `reasonMessage` 映射。
