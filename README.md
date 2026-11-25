# Emberwood: Last Torch

Emberwood: Last Torch is a top-down pixel-art survival adventure you can play in your browser. Gather resources in the snowy woods, upgrade your campfire, and venture into the Old Mill to recover the Ember Seal.

## About Me

I have a deep love for video games—they have given me the courage to face life. In the past, I often wrote game reviews and impressions, though that was as far as I could go. Now, AI has empowered me to finally try creating something of my own. What I want to pass on is the boundless joy I felt the very first time I played Minecraft.

## Versions

- **First version (v1.9.0)** · *Emberwood: Pixel Adventure* ships as a single HTML file. [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v1.9.0) · [Source branch](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v1) · [Play on Caffeine](https://emberwood-visual-effects-m6k.caffeine.xyz/)
- **Second version (v2.0.0)** · *Emberwood: Last Torch* uses Phaser 3.90.0 and Vite and is developed on `main`. This MVP covers the snowy woods and the Old Mill and saves progress in the browser’s `localStorage`. [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v2.0.0)
- **Third version (v3.0.0)** · [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v3.0.0)
  - **Eternal Mode** takes place in a compact 32×32 campfire arena. You have 20 seconds to set up your loadout using a standard allowance or free selection. Standard loadouts get another chance to choose gear every 90 seconds. Enemy spawns use a credit budget that grows faster as combat progresses, three bosses rotate at 120-second intervals, and the mode tracks its own personal best between runs.
  - **Hero animations** use a hybrid rendering pipeline configured in `heroSprites.json`. Lin has 128×128 sprites with 16-frame idle, walk, attack, dash, hit, and knockdown animations. The other heroes use procedurally generated textures.
  - **Hero portraits** feature 128×128 pixel art for all five heroes. Nearest-neighbor scaling keeps the pixels crisp. Unlocked heroes appear in full color and locked heroes appear in dimmed grayscale.
  - **Redesigned title menu** features a Stardew Valley-inspired cycle of seasonal lighting and weather, with Adventure Mode and Survival Mode side by side. Select Adventure Mode to choose a hero and access New Game, Continue, and Eternal Mode.

## Run Locally

Use Node.js 22.12+ or Node.js 24 and the project’s pinned pnpm version, 10.26.1. Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm --dir src/frontend dev --host 127.0.0.1 --port 5173 --logLevel info
```

Open the [local development page](http://127.0.0.1:5173/). Use WASD or the arrow keys to move, E to interact, Space to attack, and Esc to pause.

```sh
pnpm typecheck
pnpm build
```

The production build is written to `src/frontend/dist/`.
