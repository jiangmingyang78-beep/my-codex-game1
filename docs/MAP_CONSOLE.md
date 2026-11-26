# 余烬林 · 地图与数值控制台

在仓库根目录运行 `pnpm map`，打开终端显示的本机地址。地图工具和主游戏各自启动，只有地图工具的 Vite 开发服务提供写回接口。主游戏仍是纯前端，玩家存档继续使用 localStorage。

## 操作

- 冒险地图使用主游戏生成器。按 1 选择、2 放物资、3 放常驻怪物、4 拖动点位、5 删除。滚轮以鼠标为中心缩放，双击居中，中键拖拽或 WASD 平移。阻挡格显示红框。
- 在点位下拉框选中对象可定位。选中怪物后切换到怪物调优，滑动时即可观察指标和画布，松开滑块记一步。首领可切换预览阶段。英雄调优在出生位置显示攻击扇形及三级营火半径。
- Ctrl+Z 撤销，Ctrl+Y 或 Ctrl+Shift+Z 重做，历史最多 50 步。预设包含八份配置，导入前检查版本、结构、外键与点位。物品表作为只读字典。
- 「查看 Diff 并保存」按文件展示路径、基准和草稿，点击 ↺ 可撤回单项。「保存并运行数值体检」经过同样的预览后保存，再展示 TTK 排名、告警与材料供需。
- 游戏运行状态和旧存档各自保存已采集、已击败等进度。验证改图可刷新主游戏后开新档。

## 真实字段映射

| 面板或指标 | 文件和字段 | 单位与实际作用 |
| --- | --- | --- |
| 物资点 | worldOverrides.json 的 addedObjects、removedObjectIds、movedObjects、editedObjects | id、tx、ty、itemId、yield、renewable。新增和移动裁剪到地图内，换算为格中心像素，同步 objects 与 objectList |
| 常驻刷怪 | 同文件的 addedSpawns、removedSpawnIds、movedSpawns、editedSpawns | 点位 id 对应世界 spawnId。enemyId 选择怪物，按新坐标推导 regionId，也可手工指定归属。运行时区域常驻表同步更新 |
| 数量上限与再生物资 | balance.json 的 limits.activeEnemies、limits.activeProjectiles；regions.json 的 dawnRenewal.renewableItemIds | 同屏个数、黎明可再生的物品 ID |
| 区域刷怪 | regions.json 的 regions[].residentSpawns[]、nightSpawns[] | spawnId 与 enemyId。地图覆写调整常驻表，规则面板可编辑夜间敌种 |
| 怪物基础与掉落 | enemies.json、legacyEnemies.json 的 enemies[].maxHp、attackDamage、moveSpeedPxPerSec、drops[] | 生命、单击伤害、像素/秒。掉落表使用 itemId、count、probability |
| 近战与突进 | attack.reachTiles、triggerTiles、distanceTiles、windupSec、cooldownSec、dashDurationSec、recoverSec | 格与秒。突进循环使用前摇、突进时长和恢复，不额外添加近战冷却 |
| 远程与旧版攻击 | attack.preferredTiles、radiusTiles、projectileSpeedPxPerSec、projectileLifetimeSec、triggerRangeTiles、rangeTiles、arcDegrees、activeSec、travelSec、recoverySec、intervalSec | 施法距离、爆发半径、弹速/寿命、横扫角度或攻击周期，按敌种显示现有字段 |
| 分阶段和交替攻击 | phases[].hpThreshold、phases[].overrides.attack、attack.moves[]、attack.enrage | 分阶段 DPS 按生命比例加权。交替招式按平均动作时长，狂暴按其生命阈值计入 |
| 全局英雄数值 | balance.json 的 hero.moveSpeedPxPerSec、attackDamage、attackRangeTiles、attackArcDegrees、attackCooldownSec | 像素/秒、伤害、格、角度、秒 |
| 生存与营火 | stats.hp.initial/max/damageImmunitySec、stats.hunger.dayDrainPerMinute/nightDrainPerMinute、stats.light.nightDrainPerSec、camp.radiiTilesByLevel | 生命、无敌秒数、饱食/分、火炬/秒、分级半径 |
| 五位英雄 | heroes.json 的 heroes[].traits 与 startingInventory | 编辑该英雄实际具有的修正。初始背包使用物品 ID 作键、正整数数量作值 |
| TTK、DPS 和容错 | 上述敌我数值，以及 items.json 的 iron_spear、iron_blade、iron_armor 的 effects | 首击时刻为 0，耗时为（刀数 − 1）× 英雄间隔。容错显示受到几次峰值攻击后仍存活。英雄有效 DPS 计入初始装备 |
| 独立生成方案 | encounters.json 的 waves.intervalSec/count、resources.renewalLimit/cooldownSec、weights[regionId] | 黄昏为首波，后续按游戏秒计时，仍受同屏上限约束；权重乘以所在区域的夜间刷点数，小数部分按日和波次确定性取整 |
| 单点刷新方案 | worldOverrides.json 的 renewalLimit、respawnCooldownSec | 物资点单独设定的次数与冷却优先于全局设置。缺省时可再生物资在黎明刷新、次数不限 |
| 范围参考与急步方案 | encounters.json 的 perception.aggroTiles/leashTiles、dash.distanceTiles/cooldownSec | 蓝灰圈对应常驻怪索敌和脱战距离。夜袭怪沿用追击规则。默认急步随移速变化，显式距离按格数计算，仍经过碰撞检测 |
| 生存独立覆盖 | public/survival-balance.json 的 resourceDensity、spawnFrequency、startingSupplyMultiplier | 生存页启动时读取，缺省均为 1。密度影响程序生成的矿木格；频率控制每夜波数；补给倍率只应用于新世界 |

固定点位覆写作用于程序生成的冒险世界。生存的核心盆地与 Chunk 预览、永恒竞技场使用各自原有适配器。生存既有存档保留背包；重新生成的基础地形应用当前密度。

## 架构审查

- 世界生成与显示分离。冒险适配器使用与游戏相同的 applyWorldOverrides。空覆写直接返回输入对象。独立的 WeakMap 保存区域原始常驻定义，重复生成时仍能找到原布局坐标。
- ConsoleStore 保存基准和草稿，可逆命令同时覆盖地图与字段编辑。面板提交命令，派生指标为纯函数。地图地形采用缓存画布，编辑点位不重画每个地形格。
- 服务端从固定文件名表解析目标，拒绝链接、异源请求与未知文件，复用前端的结构、外键与真实阻挡格校验。写入使用同目录临时文件和原子重命名。每个文件独立提交并检查磁盘基准，失败后保留未提交草稿。
- 体检通过 execFile 运行现有脚本，传入解析后的世界物资和刷点，经济摘要包含手编覆写。默认 summary 模式不写报告。接口接收 `{"full":true}` 时运行完整模式。

## 30 秒调优验收

| 操作 | 本次无头 Edge 实测 |
| --- | --- |
| 放 1 个铁矿，撤销、重做 | 冒险地图 (18, 26)，ID 唯一，重做恢复同一对象 |
| 选择迷雾朽木人，拖动攻击间隔 | 0.85 → 1.35 秒，敌方 DPS 0.87 → 0.61，英雄击杀刀数保持 4 |
| 调近战距离与生命 | 近战 1.2 → 2 格触发画布像素变化。生命 4 → 5，徒手 4 刀 / 1.26 秒 → 5 刀 / 1.68 秒 |
| 查看 Diff，确认保存并体检 | 两个文件、四处改动。校验通过，固定矿从 16 增至 17，接口返回材料结论与 TTK 排名 |
| 刷新主游戏，新游戏按 E | 世界对象位于像素 (296, 424)，读取攻击间隔 1.35 秒，屏幕实际显示「获得 铁矿 ×1」 |

自动化从两页就绪到实机采集约 4 秒。测试后按原始字节还原数值和空覆写。验收临时服务与无头浏览器均已退出。

## 验证清单

- [x] `pnpm typecheck`、`pnpm fix`、`pnpm build`，以及控制台独立 TypeScript 检查与 Vite 构建。
- [x] `node tools/map-viewer/verify.mjs` 验证边界裁剪、常驻登记、跨区迁移、保留原布局、外键、阻挡格、命令栈上限和复原。
- [x] 与改动前 HEAD 生成结果深度相等，覆盖 23,040 个地块、104 个世界对象、38 个刷点，以及区域、门表和出生点。
- [x] 本地四个接口、八份基准、副本校验、非法结构、非白名单文件、旧基准冲突。实测两文件落盘均为两空格缩进加结尾换行。
- [x] 三模式切换、四标签、快捷键、滑块实时更新、预设往返、字段复原，以及 1440 × 576 冒险全景 PNG。
- [ ] 每只怪物的实际命中、追击路径、完整夜袭及长期材料平衡仍待试玩。本次运行时对照见下表。
- [ ] 主游戏开发服热重载时，无头 Edge 出现过 AudioContext 已关闭的告警。手动刷新后进入新档并采集成功，控制台页面未发现运行时异常。

## 运行时对照验收

运行 `node tools/map-viewer/verifyRuntime.mjs` 可复测冒险逐帧逻辑。对照只修改测试进程内的配置。

| 项目 | 基准 → 改值后 |
| --- | --- |
| 凛在平地急步 | 1.88 格 / 1.6 秒 → 3 格 / 2 秒 |
| 普通与旧版敌人 | 索敌 8 → 11 格，10 格距离由待机变为追击。脱战 16 → 12 格，13 格距离由追击变为待机 |
| 营地夜袭 | 默认 1 波 2 只；设 2 波共 4 只。第二波间隔从 0.25 秒改为 0.1 秒后提前抵达；区域权重 1 → 0.5 时首波 2 → 1 只 |
| 再生 | 缺省连续两个黎明都再生。全局冷却 10 秒，第 9 秒仍未刷新；单点设 2 秒、上限 1 次后，读档仍在第 2 秒刷新，第二次采完不再刷新 |
| 生存生产页，无头 Edge | 同为种子 42，三项倍率 1 → 2。核心地形资源格 285 → 546，开局木材 3 → 6，静止玩家一夜触发 1 → 2 波。观测钩子仅加载在测试浏览器响应中 |

资源计时采用游戏内经过时间，暂停期间不推进。生存固定道路、营地保底补给格与剧情地形继续优先于资源密度。构建发布后，冒险 JSON 修改需要重新构建；生存公开 JSON 在页面加载时读取。
