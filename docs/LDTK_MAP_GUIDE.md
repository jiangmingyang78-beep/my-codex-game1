# LDtk 240×96 地图制作与接入指南

> 对应适配器：[ldtkAdapter.ts](../src/frontend/src/systems/world/ldtkAdapter.ts)
>
> 切换入口：`getWorld(data, ldtkMap)`（未传 `ldtkMap` 时保持默认程序生成 `240×96` 地图）

## 1. 画布与基础尺寸
- **网格大小（Grid Size）**：`16` px（与 `balance.json` 中 `tileSize: 16` 一致）
- **关卡尺寸**：`240 × 96` 格（`3840 × 1536` px）
- 入口：`buildWorldFromLdtk(ldtk, data, levelIndex = 0)` 默认读取 `levels[0]`。

## 2. 必需图层（Layer Names）
| 图层名 (`__identifier`) | 图层类型 (`__type`) | 必需 | 说明 |
| --- | --- | --- | --- |
| `Terrain` | `IntGrid` | 是 | 地形网格（导出 `intGridCsv`），1-based 编号 |
| `Entities` | `Entities` | 是 | 出生点、篝火、区域、大门、火站、资源与事件实体 |

## 3. `Terrain` IntGrid 编号对照表
适配器映射公式：`raw > 0 ? raw - 1 : TILE.wall`（`0` 为未涂刷空单元格，自动回落为 `TILE.wall`）。

| IntGrid 编号 | 目标 `TILE` 枚举 | 内部值 | 用途与物理特性 |
| --- | --- | --- | --- |
| `0`（空） | `TILE.wall` | `3` | 未涂刷默认墙体，阻挡移动 |
| `1` | `TILE.snow` | `0` | 普通雪地，可通行 |
| `2` | `TILE.path` | `1` | 木栈道/小径（在冻沼中可豁免减速） |
| `3` | `TILE.tree` | `2` | 树木碰撞与树冠绘制格，阻挡移动 |
| `4` | `TILE.wall` | `3` | 岩壁/边界墙体，阻挡移动 |
| `5` | `TILE.floor` | `4` | 营地/废墟地面，可通行 |
| `6` | `TILE.door` | `5` | 门格（通常由 `Gate` 实体自动覆盖写入） |
| `7` | `TILE.ice` | `6` | 滑冰路面（配合 `slippery_ice` 产生惯性滑行） |
| `8` | `TILE.fireBase` | `7` | 火堆底座（`Campfire` / `RelaySocket` 会自动写入） |
| `9` | `TILE.bog` | `8` | 冻沼泥地（配合 `dense_fog_bog` 触发 `0.65×` 减速） |

## 4. `Entities` 实体名与字段对照
| 实体标识 (`__identifier`) | 必填字段 | 可选字段 | 映射说明 |
| --- | --- | --- | --- |
| `HeroStart` | 无 | 无 | 设置玩家出生点 `heroStart` |
| `Campfire` | 无 | `regionId` | 主篝火并写格为 `TILE.fireBase` |
| `Region` | `regionId` | 无 | 按实体宽高划分 `RegionBounds`（闭区间） |
| `Spawn` | `spawnId` | `regionId` | 刷怪锚点 `spawns` |
| `Gate` | `gateId` | `regionId` | 按覆盖格数填充 `TILE.door` 与 `gateTiles` |
| `RelaySocket` | `relayId` | `regionId` | 中继火盆并写格为 `TILE.fireBase` |
| `ResourceNode` | 无 | `objectId`, `itemId`, `yield`, `regionId` | 资源采集点（默认 `wood` ×1） |
| `StoryProp` | 无 | `objectId`, `toast`, `unlockNoteId`, `regionId` | 叙事遗物 |
| `ExplosiveBarrel` | 无 | `objectId`, `regionId` | 松脂桶（攻击/按 E 爆燃） |
| `MirrorLamp` | 无 | `objectId`, `regionId` | 折镜铜灯 |

## 5. 最小单元测试
运行以下命令校验 LDtk JSON 到 `World` 的全字段映射与 `getWorld` 切换行为：
```bash
node tests/run-ldtk-test.mjs
```

## 6. 生存奇遇微关卡

`encounters.json.setPieces` 定义每种布景的名称、地图像素图标、允许群系编号、距营地和同类布景的最小格数、世界配额与抽取权重。群系编号按 `survivalBiomes.ts` 的顺序从零开始。每一格都必须位于允许的群系。每个 32×32 道路分区最多容纳一处奇遇，出生营地分区留空。同类最小间距按两处布景的中心计算。

| 字段 | 含义 |
| --- | --- |
| footprint、tiles | 宽、高各 1–15 格。每个字符串是一行生存地形编号，按从上到下、从左到右排列。盖章会平整占地，保留原主路 |
| props | 使用局部格坐标 x、y，kind 对应布景像素图。每处有一个 interactive 为真的主要调查物 |
| entities | kind 为 plant 或 enemy，ref 引用植物表或生存可用的共享敌人。植物随探索出现，守卫在调查时出场 |
| lootTable | 每项给出 itemId、count、probability。使用同时存在于物品表和生存库存的物品，各项独立按种子抽取 |
| triggerEvent | cache 发放物资，trap 踩下或调查时扣一点生命，heal 恢复两点生命，ambush 触发预置敌人。每处实例只结算一次 |
| rotate、mirror | 开启后可按 90° 旋转或水平镜像。地形、物件、实体和事件坐标共同变换 |
| ldtkLevelRef | 可选。按 identifier 读取 encounterLevels.json 中的微关卡，以其中的地形、物件和实体作为实际盖章内容。尺寸须与 footprint 一致 |

雪橇模板使用 `IceSled` 微关卡。制作同类关卡时以 16 像素为一格，添加 `SurvivalTerrain` IntGrid 图层与 `Entities` 实体图层。IntGrid 数值为生存瓦片 ID 加一，每格都需要涂刷。实体支持 `Prop`（kind、interactive）、`Plant`（ref）与 `Enemy`（ref），位置读取实体的 __grid。物品、触发效果和投放约束仍由奇遇模板管理。

生成器按种子排序候选分区，在营地周围最多检查 440 个分区，每区最多尝试 4 个合格模板。盖章后以四向 BFS 从调查物验证到主路出口及布景内部的通行性。耗尽候选且仍有未填名额时输出一次告警。进入新种子世界后，玩家距中心 6 格即可解锁地图图标和名称，按 E 调查。旧种子和经典存档继续使用原布局。
