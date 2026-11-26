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
