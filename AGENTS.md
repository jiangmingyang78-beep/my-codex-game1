# Project Guidance

## User Preferences

- 游戏内文字与回复使用中文
- Phaser 3.90.0，纯前端，存档使用 localStorage
- 复用现有 vfx 模块且保持其公开接口不变；物品、配方、敌人、区域、平衡数据以 JSON 为准
- 模块化，单文件职责清晰

## Accepted Requirements

- Build the playable MVP game (gather, craft, night, save and reload) from the handoff zip
- Fully client-side Phaser 3.90.0 game inside the React frontend with localStorage saves and no backend logic
- Reuse vfx modules unchanged in interface
- Deliver architecture review findings and MVP verification checklist as markdown docs in the project and surface them briefly in the final message

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- Game code lives in src/frontend/src/game; core and systems are Phaser-independent under src/frontend/src/core and src/frontend/src/systems; vfx modules under src/frontend/src/vfx stay API-unchanged.
- Biome treats functions named use* as React hooks, so the inventory action is named consumeItem.
- New Game and Continue go through beginRun in session/activeRun.ts, which sets the UI to playing synchronously; GameScene attaches via takePendingRun. Title clicks must not depend on Phaser having booted.
- Headless test browsers may lack WebGL, so the renderer must fall back to canvas and boot must never hang.
- createEffects options type is inferred from JS; cast as Parameters<typeof createEffects>[1] to pass ambientAt and lightStrength.

## 双工具交替交接规范（Codex ↔ Antigravity）
- 本仓库由 Codex 与 Antigravity 交替协作开发，严禁在未确认前随意推翻另一工具刚通过构建的改动。
- **开局接棒**：新会话启动时优先读取 `AGENTS.md` 与 `docs/HANDOFF.md`（如有 Git，再看 `git log -n 3 --stat`），禁止无目的通读全仓与 `survival.html`。
- **收尾交棒**：每完成一个里程碑并通过 `pnpm typecheck && pnpm fix && pnpm build` 后，按以下格式覆写 `docs/HANDOFF.md`（总长度控制在 60 行以内）：
  1. **本棒工具与改动清单**：列出新增/修改的文件及当前行数（标出 ≥ 240 行的警戒文件）。
  2. **已验证项**：列出通过的构建/类型检查及实测通过的功能。
  3. **未验证与已知风险**：明确标出仅过编译、尚未进游戏实测的部分（例如坐标、碰撞、手感）。
  4. **锁定的接口与约束**：本棒新约定且下一棒不得破坏的导出签名或内存 `WeakMap` 约定。
  5. **下一棒任务**：写清下一步最直接的 1–2 个目标。
