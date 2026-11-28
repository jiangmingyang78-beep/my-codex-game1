# 余烬林：最后一炬 AI 开发接手指南

填好本次交付后，把这一个文件上传到网页端 AI，再发一句 `请按附件中的本次任务接手。`。如果手里是通用模板，上传后直接在消息里补充任务和验收标准。

## 本次任务

- **任务**　修复 pnpm 工作区的 Critical/High 依赖告警，并配置 Dependabot 每周按生产和开发依赖分组更新。
- **基线与改动**　`HEAD` 为 `67390141d483fc9451a7074ad73c79686c8bb7d1`。开工前两个 `package.json`、`pnpm-lock.yaml` 和 `.github/dependabot.yml` 范围干净。工作区已有空间运行时、光照、VFX、生存入口、测试及 Windows 一键体检改动。此次依赖修改集中于两个清单、锁文件和新增配置。
- **复现与验收**　从根目录对照基线和当前锁文件分别运行 `pnpm audit`、`pnpm audit --prod --audit-level=high`。用 `pnpm -r why seroval lodash lodash-es sharp js-cookie browserslist` 核实依赖树。当前锁文件须能冻结安装，两套审计须为 0 Critical、0 High，项目构建、现有测试及 5 张肖像的处理须通过。
- **验证**　`pnpm install --no-frozen-lockfile`、冻结复装、类型检查、Biome、159 项单测、生产构建、生产冒烟 5/5、冒险完整回归 1/1 及肖像脚本通过。全量告警 23 → 6，生产审计 14 → 3。GitHub 仓库告警 API 返回 401，默认分支告警状态待复核。

## 依赖审计与处置

| 依赖路径 | 告警与通过审计的版本 |
| --- | --- |
| `sharp` | 直接开发依赖 0.34.5 → 0.35.5，覆盖 3 条 High。libvips、libheif、librsvg 的公告修复下限分别是 0.35.0、0.35.4、0.35.5。本机实际加载的预编译版本为 libvips 8.18.7、libheif 1.23.5、librsvg 2.63.2。[libvips 公告](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) · [libheif 公告](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) · [librsvg 公告](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) |
| `@tanstack/react-router` → `@tanstack/router-core` → `seroval` | 父包 1.131.50 → 1.170.46，`router-core` 1.171.39，`seroval` 1.5.1 → 1.8.2。覆盖 2 条 Critical（`GHSA-mv8w-475r-vwqw`、`GHSA-p6vx-979v-rg4c`）和 4 条 High（`GHSA-jp82-f5mq-hwhp`、`GHSA-97r2-qh9m-474h`、`GHSA-wp97-x4hv-qvhp`、`GHSA-7rv5-mrxv-xcr9`）。这些公告中最高修复下限为 1.6.8。 |
| `recharts` → `lodash`；`react-quill-new` 和 `quill` → `lodash-es` | 三条精确覆写将两包从 4.17.23 升至 4.18.1，覆盖 2 条 High 和 2 条 Moderate。`recharts` 2.x 的最新版本仍为 2.15.4，移除 `lodash` 的版本位于 3.x。`react-quill-new` 3.8.3 和 `quill` 2.0.3 仍声明 `lodash-es` 为 `^4.17.21`，pnpm 10 定向 `up lodash lodash-es` 后仍保留旧锁。父包提高安全下限或移除相应包后，可移除对应覆写并重跑审计。[High 公告](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) · [Moderate 公告](https://github.com/advisories/GHSA-f23m-r3pf-42rh) |
| `react-use` → `js-cookie` | 父包 17.6.0 → 17.6.1，`js-cookie` 2.2.1 → 3.0.8（修复下限 3.0.7）。覆盖 1 条 High。[公告](https://github.com/advisories/GHSA-qjx8-664m-686j) |
| `autoprefixer` → `browserslist` → `baseline-browser-mapping` | 父包 10.4.27 → 10.7.1，`browserslist` 4.28.1 → 4.29.6（修复下限 4.28.7），`baseline-browser-mapping` 2.10.12 → 2.11.40（修复下限 2.11.0）。覆盖 2 条 High 和 1 条 Moderate。[High 公告一](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) · [High 公告二](https://github.com/advisories/GHSA-73wf-gq98-2v4g) · [Moderate 公告](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) |

| 审计命令 | 修改前 | 修改后 |
| --- | --- | --- |
| `pnpm audit` | 23（2 Critical、12 High、7 Moderate、2 Low） | 6（4 Moderate、2 Low），退出码 1 |
| `pnpm audit --prod --audit-level=high` | 14（2 Critical、7 High、4 Moderate、1 Low） | 3（2 Moderate、1 Low），退出码 0 |

| 剩余告警 | 暴露面与 Dismiss 建议 |
| --- | --- |
| `quill@2.0.3`（1 Low） | 公告无修复版本。源码无编辑器或 HTML 导出调用。生产构建的 13 个 JS chunk 均未包含 Quill，可按 `Vulnerable code is not actually used` 评估关闭。[公告](https://github.com/advisories/GHSA-v3m3-f69x-jf25) |
| `fflate@0.8.2`、`fflate@0.6.10`（2 Moderate） | 来自 `@types/three` 与 `@react-three/drei → three-stdlib`。生产 chunk 没有 `fflate` 或 `three-stdlib`，当前游戏没有 ZIP 解包入口，可按 `Vulnerable code is not actually used` 评估临时关闭。修复目标分别为 0.8.3 和 0.6.11。[公告](https://github.com/advisories/GHSA-px8p-9vwx-vf98) |
| `postcss-selector-parser@6.0.10`、`postcss-selector-parser@6.1.2`（2 Moderate、1 Low） | 通过 Tailwind 与 Typography 在构建时解析 CSS。建议保留告警，定向跟进 6.1.5 或更新的兼容版本，因为 CI 会执行这条路径。仅在团队依据可信源码构建的场景接受风险时考虑 `Risk is tolerable to this project`。[Moderate 公告](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) · [Low 公告](https://github.com/advisories/GHSA-w9m9-85wc-3x92) |

Vite 和 Astro 都用 Renovate 执行每周分组更新。本仓库使用 Dependabot 的 `npm` 生态处理 pnpm 10 的根工作区，每周分别合并生产、开发依赖的 minor／patch 版本更新，打开的版本更新 PR 上限为 5。[Vite 配置](https://github.com/vitejs/vite/blob/main/.github/renovate.json5) · [Astro 配置](https://github.com/withastro/astro/blob/main/.github/renovate.json5) · [GitHub Dependabot 选项](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)

## 游戏与开发版本

这是俯视角像素生存冒险游戏。冒险模式在雪林采集、制作、强化营火、度过夜晚，再探索旧磨坊等区域推进剧情。生存模式经营独立营地，面对饥饿、寒潮和袭营。永夜模式在营火竞技场配装、迎战敌群与轮换首领，单独记录成绩。

开发线为 `main`，使用 React、Vite、TypeScript 和 Phaser 3.90.0。玩法在浏览器运行，存档使用 `localStorage`。冒险、永夜共用 Phaser 前端。生存是独立的 Canvas 页面，复用部分玩法模块，有自己的库存 ID 和存档。可尝试通过 GitHub 读取已提交文件。[项目仓库](https://github.com/jiangmingyang78-beep/my-codex-game1)

**2026-11-28 接手快照。** 本地 `HEAD` 为 `6739014`，提交内容是降低 84 敌人压测的 GC 分配。本机的 `origin/main` 跟踪引用为 `b687033`。工作区还有空间运行时、光照、VFX、生存入口和测试等改动。最近交接记录为 Windows 一键体检修复，记录了类型检查、Biome、单测 159/159 和生产构建通过。84 敌人 GC 峰值与低端 GPU 表现仍待复测。当前任务以用户提供的实际版本及文件为准。

## 按任务定位源码

下表中的 `game/`、`systems/`、`core/`、`data/` 和 `vfx/` 均位于 `src/frontend/src/`。从最相关的一行查起，再沿调用者与测试补证据。

| 任务 | 首查入口 | 验证入口 |
| --- | --- | --- |
| 标题、新开局、继续、冒险 | `main.tsx` → `App.tsx` / `game/GameCanvas.tsx`。从 `game/ui/TitleScreen.tsx` 查菜单，`game/session/activeRun.ts` 的 `beginRun` 准备本局，`game/scenes/GameScene.ts` 通过 `takePendingRun` 取得会话，`game/session/RunSession.ts` 管理运行状态。 | `tests/e2e/game.smoke.spec.ts` 和 `tests/e2e/adventure-regression.spec.ts`。 |
| 生存、营地、袭营 | `src/frontend/survival.html` 是实际入口。按函数名找局部，例如 `raidSpawnPoints`，再查 `systems/survival/raidSpawn.ts`、`data/survival*.json` 和 `src/frontend/public/survival-balance.json`。 | `tests/winterSurvival.test.ts` 覆盖波次结算、可通行落点和光照限制。 |
| 永夜、波次、首领 | `game/session/RunSession.ts`、`systems/eternal/eternalWorld.ts`、`systems/eternal/eternalDirector.ts`。 | 在游戏里验证开战、刷怪或首领轮换。拥挤性能用 `src/frontend/tests/spatial-stress.js`。 |
| 通用光照、追击、刷怪 | `systems/world/worldContext.ts`、`runContext.ts`、`lightGrid.ts`、`flowField.ts`，以及 `systems/combat/spawnRules.ts`。各模式仍各自决定波次和特殊单位。 | `tests/lightSpawn.test.ts` 和 `tests/spatialRuntime.test.ts`。 |
| 物品、制作、怪物、地图、平衡 | `data/items.json`、`recipes.json`、`enemies.json`、`regions.json`、`balance.json`，校验入口为 `core/gameData.ts`。生存库存和配方从 `data/survivalCatalog.json`、`data/survivalRecipes.json` 查起。 | `tests/dataValidator.test.ts` 校验目录与数据引用。 |
| 存档、迁移 | `core/save.ts`、`core/saveMigration.ts`、`core/storage.ts`。生存从独立页面里的 `worldSlot` 和读写调用查起。 | `tests/runtimeRules.test.ts` 验证读档恢复规则，`tests/dataValidator.test.ts` 检查旧存档迁移。 |
| 攻击反馈、渲染、性能 | `game/feedback/TelegraphLayer.ts`、`game/world/EntityViews.ts`、`game/renderDepth.ts`、`vfx/`。 | `tests/renderDepth.test.ts` 校验深度约定。实机和压测步骤见 `docs/SPATIAL_RUNTIME.md`。 |

## 网页端 AI 的接手方式

1. 已给具体任务时直接定位，用简短的回复说明所依据的代码位置和预期修复。可以访问工作区时，先看根目录 `AGENTS.md`、`docs/HANDOFF.md` 和 `git status --short`，再用符号或日志关键字搜索。可通过 GitHub 读源码时，核对提交号。本地工作区改动以用户提供的文件或差异为准。
2. 只有本附件时，可以先分析玩法、影响范围和验收方式。需要看代码时，一次列出定位所需的最少文件、函数或行段，并写明各自用途。例如生存夜袭可先要 `survival.html` 中调用 `raidSpawnPoints` 的一段、`raidSpawn.ts` 和相关平衡字段。有本地 Git 时，用 `git diff HEAD -- <相关路径>` 提取相关已跟踪差异，并单独附上任务所需的新文件。
3. 游戏文字和回复用中文。依据 JSON 修改数据，保持 `vfx/` 的公开接口和深度约定，保留旧存档兼容、场景重启和 Canvas 回退。保持 `core/` 与 `systems/` 独立于 Phaser。专项优化保留现有玩法，并保护其他工具已通过验证的改动。
4. 用本次任务的复现和验收验证修改。能运行时报告实际结果。网页端只能提供代码时，在确认过版本及上下文后给出最小补丁，并把构建或实机测试标为待验证。继续交棒时更新本次任务、开发快照和末尾源码，记录实际验证与剩余问题。

## 运行与验收

从仓库根目录运行。按项目 README 使用 Node.js 22.12+ 或 24，以及仓库锁定的 pnpm 10.26.1。

```sh
pnpm install --frozen-lockfile
pnpm --dir src/frontend dev --host 127.0.0.1 --port 5173
pnpm check:all
pnpm test:e2e
```

开发入口为 `/` 和 `/survival.html`。`pnpm check:all` 串联类型检查、Biome、单测和构建。`pnpm test:e2e` 默认用生产构建产物跑烟测，冒险开发版完整回归由 `E2E_TARGET=development` 选择。涉及玩法时按 `docs/MVP_CHECKLIST.md` 中相关条目实测。仓库里完成代码里程碑后，依 `AGENTS.md` 运行 `pnpm typecheck`、`pnpm fix`、`pnpm build`，并按该约定更新 `docs/HANDOFF.md`。

## 采用的开源交接做法

- 把目录、项目约定和验证入口写成可供模型直接读取的短指南。[OpenAI Codex 的 AGENTS.md 指令规范](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md#agentsmd-spec)
- 用最小复现和版本信息收敛问题，按任务补必要文件。[Godot 贡献指南](https://github.com/godotengine/godot/blob/master/CONTRIBUTING.md#reporting-bugs)
- 写出可运行的命令，并区分开发、构建和集成验证。[Vite 贡献指南](https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md#running-tests)

## 本次相关源码

根 `package.json` 的安全版本和覆写

```json
{
  "devDependencies": { "sharp": "^0.35.5" },
  "pnpm": {
    "overrides": {
      "recharts@2>lodash": "^4.18.1",
      "react-quill-new>lodash-es": "^4.18.1",
      "quill@2.0.3>lodash-es": "^4.18.1"
    }
  }
}
```

`src/frontend/package.json` 的三个已更新声明

```diff
  "devDependencies": {
-   "autoprefixer": "^10.4.20",
+   "autoprefixer": "^10.7.1",
  "dependencies": {
-   "@tanstack/react-router": "~1.131.8",
+   "@tanstack/react-router": "~1.170.46",
-   "react-use": "~17.6.0",
+   "react-use": "~17.6.1",
```

`.github/dependabot.yml` 完整配置

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
```

`pnpm-lock.yaml` 由 pnpm 10.26.1 重新解析。验证时在工作区缓存中复制原有 `tools/process-hero-portraits.mjs` 与肖像备份，脚本把 5 张 2048×2048 JPEG 转成 512×512 PNG。生产包检查通过 Vite `generateBundle` 读取两个入口共 13 个 JS chunk 的模块清单。
