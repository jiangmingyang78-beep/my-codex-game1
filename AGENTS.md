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
