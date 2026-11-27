# 双工具交接 · v3.2.0 冒险昼夜地表效果

## 1. 工具与改动文件（Codex，⚠ 表示 ≥240 行）
- 本次将下载目录中最新版发布包相对 `(2).zip` 的更新接入 `19b6ca1` 上的源码。
- `src/frontend/src/game/world/SnowClockArt.ts`（新增，226）、`Scenery.ts`（100）、`darkness.ts`（27）：晨光雪脊、黄昏树影、夜间林道，以及视口缓存和时钟接入。
- `src/frontend/src/game/textures/worldTexture.ts`（271 ⚠）、`game/renderDepth.ts`（52）、`game/scenes/GameScene.ts`（384 ⚠）：共享地表配色、深度和冒险启用条件。
- `tests/renderDepth.test.ts`（75）覆盖新深度。`docs/HANDOFF.md`（24）记录本次交接。

## 2. 已验证项
- `pnpm typecheck`、`pnpm fix`、`pnpm build` 通过。`npm test` 的 60 项现有测试通过。
- Chrome Canvas 用测试存档验证白天、黄昏、深夜、黎明切换，确认镜头静止时复用缓存、窗口尺寸变化后重绘，且永恒模式不生成地表效果。
- Chrome WebGL 验证三张地表贴图上传。Canvas 和 WebGL 均验证了返回标题后重开冒险。

## 3. 未验证与已知风险
- WebGL 验证覆盖上传和场景切换，各时段外观在 Canvas 下检查。尚未在低端设备上测量移动时的帧率。
- 本轮未从头游玩一个完整昼夜，也未走访地图最东端。

## 4. 锁定接口与约束
- `RENDER_DEPTH.snowAccents` 放在地面和脚印之间。`SnowClockArt` 使用共用的 `DAWN_SEC`、`DUSK_SEC` 和冬景配色。
- `Scenery` 可选参数 `showSnowClock` 默认关闭，仅在冒险开启。销毁场景时解除镜头监听并移除三张贴图。VFX 公共接口和存档结构保持兼容。

## 5. 下一棒任务
1. 用 WebGL 实玩一轮昼夜，复核营地与冰岸附近的晨光、树影和林道边缘。
2. 在低端设备上检查连续移动跨越多个视口缓存块时的帧率。
