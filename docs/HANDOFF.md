# 84 敌人 GC 首轮优化交接

## 1. 工具与改动文件

Codex。括号为当前行数，⚠ 表示至少 240 行。
- src/frontend/src/entities/EnemyEntity.ts（65）
- src/frontend/src/game/feedback/TelegraphDrawing.ts（221，新增）
- src/frontend/src/game/feedback/TelegraphLayer.ts（270 ⚠）
- src/frontend/src/game/ui/EquipmentRingRail.tsx（179）
- src/frontend/src/game/ui/Hud.tsx（203）
- src/frontend/src/game/ui/QuickSlots.tsx（75）
- src/frontend/src/game/world/EntityViews.ts（287 ⚠）
- docs/SPATIAL_RUNTIME.md（152）
- docs/HANDOFF.md（37）

## 2. 已验证项

- pnpm typecheck、fix、check、build、全量单测 159/159。生产 E2E 5/5，冒险完整回归 1/1。
- WebGL 和 Canvas 像素对照覆盖充能进度、普通与末段顺序、直向及斜向预警、清屏、复用和销毁。浏览器实测快捷消耗、圆盾冷却与就绪、静音、暂停和继续。
- 同场景三轮估算分配量 193.80→94.19 MiB。独立三轮 GC 30→16 次，累计 33.555→25.833 ms，各轮最长暂停的中位数 4.496→0.790 ms。逐轮和补测指标见 SPATIAL_RUNTIME.md。

## 3. 未验证与已知风险

- 主对比最长 GC 9.045→16.881 ms，渲染 CPU P95 2.2→2.8 ms，帧间隔 P95 64.5→69.3 ms。后补三轮 15 次 MinorGC，最大 0.898 ms，峰值来源待复现。
- 低端硬件 GPU、超出 32×32 流场窗口的封闭地形以及 Caffeine 云端回放待验证。

## 4. 锁定接口与约束

- TelegraphLayer.syncFromState 与 destroy 负责场景预警。WebGL 纹理和视图池归场景所有，Canvas 使用原路径几何。普通预警先画，末段预警随后画。
- 敌人位置、移动碰撞与伤害由玩法层负责，视图负责渲染和归还。HUD 等值比较受快捷栏、装备显示字段约束，添加字段时同步更新。
- FlowField.compute 完整求解，update 同格修复受影响路径。WorldContext 的光照与导航缓存只在内存。ISpawnDirector.hasRoom 和 allowsLocation 可以按批调用，accepts 组合执行。
- 死亡钩子在敌人归还前运行。遵循 VFX 公开接口、渲染深度、存档和 CI 诊断契约。开发版 Alt+Shift+R 重读已校验的空间平衡参数。

## 5. 下一棒任务

1. 前后版本交错复测 84 敌人场景，保存每次 GC 的事件类型、墙钟和线程 CPU 时间。
2. 在低端硬件 GPU 上复现，核对精灵批处理、VFX 和纹理上传字节数。
