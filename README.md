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

- **Adventure expansion (v3.1.0)** · [Release](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v3.1.0)
  - **Expanded Adventure Mode** spans ten regions, including the starting camp, on a 240×96 map. It adds bogs, explosive resin barrels, mirror lamps, story relics, and new enemy behaviors.
  - **Save migration** moves characters, enemies, and uncollected loot from the old map into the expanded world while preserving progress.
  - **Map and development tools** include an LDtk adapter, a balance report, and a sprite workbench. The game uses its built-in map by default.

- **Combat feedback and atmosphere (v3.2.0)** · [Version tag](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v3.2.0)
  - Adds enemy attack warnings, hit feedback, slash arcs, and dash afterimages to the main battle scene.
  - Adds flickering torchlight, drifting embers, a low-light vignette, and snow-only footprints. Chinese combat and loot toasts use a bundled pixel font.
  - Centralizes render depths and adds a shared unit-test entry point with `npm test`. Existing saves retain their format.

- **三模式空间运行时 (v4.0.0)** · [版本标签](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v4.0.0)
  - 冒险、生存和永夜共用遮挡视野、局部追击寻路与刷怪落点校验。
  - 生存模式新增营地工程、寒潮和袭营预警。详见[空间运行时报告](docs/SPATIAL_RUNTIME.md)和[生存平衡报告](docs/BALANCE_REPORT.md)。

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

## 生存模式与数据校验

`src/frontend/survival.html` 是标题页和暂停菜单使用的生存模式入口，随 Vite 构建独立输出。它的库存目录和配方分别位于 `src/frontend/src/data/survivalCatalog.json` 和 `survivalRecipes.json`。冒险物品与生存库存各用自己的 ID（例如营地工程使用生存库存中的 `wheat`）。

游戏启动时先检查 JSON 字段，再按 ID 建立索引，最后验证引用、数量与掉落规则。配置错误会显示文件名及字段路径，例如 `regions.json.regions[0].residentSpawns[0].enemyId`。所有怪物和遭遇奖励都在 `enemies.json`。地图控制台仍可通过原有两个文档名分别编辑怪物。

生存数值默认值位于 `src/frontend/src/data/balance.json` 的 `survival` 段。编辑 `src/frontend/public/survival-balance.json` 后刷新生存页即可生效。文件可只填写要覆盖的字段。请求失败、JSON 损坏或任一字段非法时，整份覆写回退到默认值。运行 `node tools/balance-report.mjs --summary` 可查看有效昼夜时长、饥饿速率、资源刷新周期和刷怪数值。

| 覆写字段 | 生存规则 |
|---|---|
| `dayDurationMultiplier`、`nightDurationMultiplier` | 分别调整默认 120 秒白昼和 72 秒夜晚 |
| `fuelConsumptionMultiplier` | 营火配方的耗煤倍率，按整份配方向上取整 |
| `coldHungerPerSecond` | 暴雪中处于热源外时每秒额外消耗的饱食点数。默认 0 |
| `hungerRateMultiplier` | 持续饥饿流失倍率。默认静止每秒 0.30 点、移动每秒 0.42 点 |
| `spawnFrequency`、`spawnDensity` | 分别调整夜袭波次和每波基础敌人数 |
| `resourceDensity`、`resourceRefreshMultiplier` | 分别调整资源格生成密度和野生资源再生速率 |
| `startingSupplyMultiplier` | 新世界初始库存倍率 |

字段类型和取值范围见 `src/frontend/public/survival-balance.schema.json`。倍率默认 1，昼夜时长和资源再生速率倍率必须大于 0。

### 光照与刷怪

冒险夜袭、永恒战斗和独立生存页共用双环选点规则。配置位于 `balance.json` 的 `survival` 段。独立生存页也读取 `public/survival-balance.json`，允许仅覆写一个分类上限。

| 配置 | 默认值 | 含义 |
| --- | --- | --- |
| minSpawnRadius | 15 格 | 实际近环至少比当前视口半对角线多一格 |
| maxSpawnRadius | 22 格 | 候选点距玩家的最远距离 |
| despawnRadius | 30 格 | 每游戏秒回收超距普通敌人 |
| categoryCap | hostile 12、elite 4、neutral 12 | 普通敌对、精英和野生中立动物各自的数量上限，0 表示停止生成该类 |

半径必须满足近环 < 外环 < 回收距离。普通夜怪需要天空光 ≤ 7、方块光 ≤ 2，煤影与暗影猞猁需要天空光 ≤ 7、方块光为 0。无合法位置时本次生成跳过。冒险剧情常驻敌人按原图预置，固定夜袭优先尝试原入口。永恒模式开战后进入夜间，选点失败会保留刷怪预算。

开发版进入游戏后打开 DEV，勾选「显示安全光区与刷怪环」。小图中金色为普通夜怪安全区，暗紫色为仅能阻止暗影怪的微光，青色与橙色分别为近环和外环，白框为实际视口。
