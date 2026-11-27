# 双工具交接 · 保护性代码精简与双轨表现层合并

## 1. 工具与改动文件（Antigravity，⚠ 表示 ≥240 行）
- `systems/combat/combatMath.ts`（53）：新增 `safeUnit`、`ratio01`。`game/session/RunSession.ts`（190）：新增 DEV 坐标断言。
- `core/dataTypes.ts`（288 ⚠）：补齐 `EnemyAttack`、`EnemyPhaseStage` 与 `EnemyDef.phases`。`systems/eternal/eternalSpawn.ts`（172）：移除 `phases` 强转。
- `entities/EnemyEntity.js`（57）：剥离重复 `drawTelegraph`（-75），保留 `special.renderOverlay` 护盾/光环。
- `game/feedback/TelegraphLayer.ts`（276 ⚠，-60）、`CombatFeelController.ts`（354 ⚠，-262）、`atmosphere/CombatMotionVfxLayer.ts`（454 ⚠，-1）、`scenes/GameScene.ts`（375 ⚠，-39）。
- `tests/combatMath.test.ts`（19，新增）、`docs/HANDOFF.md`。`src/frontend/src/` 净精简 391 行。

## 2. 已验证项
- `pnpm typecheck`、`pnpm fix`（Biome 231 文件）、`npm test`（70 项全过，含 `combatMath.test.ts`）、`npm run build` 全部通过。
- 浏览器实机战斗（`http://localhost:5173`，`frost_shield_bearer` + `snow_weasel`）：地面前摇预警（无重复绘制）、冻木盾卫正面弧形护盾、圆盾格挡 110ms 暖金闪光持续、金色 `"格挡!"`、2 颗火星、`余烬反势！` Toast、130ms 穿刺光束与 2 个暖金残影均正常显示，0 控制台报错。
- Codex 用 Chrome 的 WebGL（SwiftShader）和 Canvas 验证北境哨卡镜灵（`mirror_wisp`）。青色光环在点灯前后可见，随镜灵位置更新，并在前摇和受击时保留。暗处及灯圈外免伤，点灯后灯圈内可受伤。击败后光环随实体销毁，两个渲染器均无控制台错误。

## 3. 未验证与已知风险
- `Overlays.tsx` 仍保留用于兼容无 Phaser 场景的旧 `<Toasts />`。

## 4. 锁定接口与约束
- `CombatFeelController` 构造函数精简为 `{ reducedMotion?, shakeEnabled? }`，直接绑定 `EVT`；保留 `setHeroTarget` 与 `triggerHitstop(..., force)`；移除未使用的 `CombatEventTypeMap`、`flashObject` 与 `resolveTarget`。
- `EnemyEntity.js` 仅负责常驻机制覆盖层（`special.renderOverlay`），前摇预警统一归口 `TelegraphLayer`。

## 5. 下一棒任务
1. 若继续推进瘦身，可评估将 `EnemyManager.js`、`EnemyEntity.js` 渐进迁移至 TypeScript。
