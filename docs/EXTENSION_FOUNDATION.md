# 《余烬林》首轮扩展基础

本轮以 A1.txt 的 `src/entities/enemySeeds.js` 作为行为参考，运行入口为本工程的 Phaser/Vite 前端。雪鼬沿用现有 JSON 数值、规则阶段与战斗事件。

| 来源 | 缺口 | 本轮处理 |
| --- | --- | --- |
| A1 的行为种子 | `context.tileSize ?? 16` 和可选回调容易掩盖接入遗漏。 | 核心冲刺显式接收地图格长、移动和命中回调。 |
| A1 的远程怪和守卫 | `" reposition"` 与更新分支不匹配。子种子的 `init` 写入浅拷贝。 | 两种行为接入前分别验证首帧和阶段切换。 |
| 原 `worldGen.ts` | 单一门位、火站位和按区域名写死的资源筛选会影响扩区。 | 地图生成器读取区域布局、地形、门、火站和资源规则。 |
| 原 `enemyAi.ts` | 雪鼬的冲刺执行与通用 AI 混在同一个分支中。 | 以 `attack.type` 调度攻击种子，通用阶段继续由 AI 管理。 |
| 原存档 | 已有 v1，版本必须完全匹配。固定掉落标记和地图变更共用字典。 | v1 和无版本同形旧档迁入 v2，已领取和待领取分别用 `collectedPickups` 与 `groundLoot`。 |

## 可直接交给 DeepSeek 的接口模板

```text
目标工程是 my-codex-game1/src/frontend。保持既有 ID、事件载荷与 src/vfx 公共接口。
优先修改配置，复用已有系统。说明本次 ID、事件、存档的影响以及玩家验收操作。

新增区域
- data/balance.json 的 world.widthTiles/heightTiles/tileSizePx 是地图尺寸和格长。
- data/regions.json 配 id、entry、residentSpawns、nightSpawns、encounterId、relaySocketId。
- systems/world/worldLayout.ts 的 WORLD_LAYOUT.regions 配 bounds 与 terrain。
- bounds 使用包含边界的瓦片坐标。terrain 按顺序覆盖，tile 取 TILE 的键。
- WORLD_LAYOUT.spawns[spawnId] 配出生格。spawnId 必须唯一，enemyId 引用已登记怪物。
- gate.tiles 配碰撞格，gate.interactAt 配交互位置，可用半格。门 ID 取 entry.gateId。
- relay 配火站格，ID 取 relaySocketId。nodes 配 idPrefix、itemId、count、yield。
- 附加区域布局时保持既有布点和稳定 ID。检查可达性、门控和资源数量。

新增怪物变体或种子
- data/enemies.json 配 id、regionIds、maxHp、attackDamage、moveSpeedPxPerSec、attack、drops。
- 雪鼬模板 attack.type 为 lunge，使用 triggerRangeTiles、windupSec、distanceTiles、
  travelSec、recoverySec、intervalSec。距离是格，时间是秒，坐标是世界像素。
- 复用攻击类型时只加数据。新攻击类型增加 AttackMove 类型并登记 attackSeeds。
- 种子执行 update(enemy, dt, player, context)。context 提供 move、tileSize、
  contactRadiusPx、moveBy(dx,dy)、strikeHero()。通用 AI 管理前摇、收招和事件。
- drops 配 itemId、count、probability。固定奖励使用唯一 pickupId 和 oncePerRun: true。

新增配方和物品
- data/recipes.json 配 id、name、stationId、minCampLevel、inputs、output，可选 constraints。
- output 使用 {type:"item",id,count} 或 {type:"camp_level",level}。
- 新物品在 items.json 配 id、name、type、maxStack、effects、description。
- 新区、怪物、配方和新物品同步登记在 data/catalogDefinitions.json。
- 使用现有库存和制作系统。测试缺料、满栈、制作成功和保存重开。

存档和事件
- core/saveMigration.ts 登记逐版迁移。v2 用 collectedPickups 保存已拾取的固定 ID，
  groundLoot 保存待拾取。seals 继续作为炉印门槛，地图变化用 changesByObjectId。
- 事件沿用 {type,x,y,payload}。规则完成后再消费事件，表现层从 VFX 桥接接入。
```

## 玩家验收

1. 新开一局，采集并制作，在营火升到二级后通过磨坊门。检查扣料、门碰撞和位置。
2. 迎战雪鼬，观察前摇后横移。检查冲刺方向、一次命中、收招、受击音效与粒子。
3. 用 v1 存档继续，拾取待领取炉印，保存并刷新。检查营火、门、背包和炉印同时恢复，奖励只有一份。
