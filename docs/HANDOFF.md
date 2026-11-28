# pnpm 安全告警修复交接

## 1. 工具与改动文件

Codex。括号内为当前行数，⚠ 表示至少 240 行。

- `.github/dependabot.yml`（18，新增）
- `package.json`（37）和 `src/frontend/package.json`（94）
- `pnpm-lock.yaml`（5299 ⚠）
- `docs/AI_HANDOFF.md`（136）和 `docs/HANDOFF.md`（34）

## 2. 已验证项

- `pnpm install` 更新锁文件，冻结复装通过。全量审计 23 → 6，生产审计 14 → 3，两者 Critical/High 均为 0。全量审计仍因低、中危返回 1，生产高危阈值审计返回 0。
- `pnpm typecheck`、`pnpm check`、`pnpm fix`、`pnpm build` 通过。Biome 未改写源码。
- 单测 159/159，生产浏览器冒烟 5/5，开发版冒险完整回归 1/1。
- Windows 加载 Sharp 0.35.5 预编译包，确认 librsvg 2.63.2、libheif 1.23.5。肖像脚本在缓存目录生成 5 张 512×512 PNG。

## 3. 未验证与已知风险

- 本地审计已确认，高危告警在 GitHub 默认分支上的状态待复核。仓库告警 API 返回 401。
- 剩余 `quill`、`fflate` 和 `postcss-selector-parser` 告警的修复目标与 Dismiss 建议见 `docs/AI_HANDOFF.md`。
- 84 敌人场景的 GC 峰值与低端 GPU 表现仍待复测。数据见 `docs/SPATIAL_RUNTIME.md`。

## 4. 锁定接口与约束

- `pnpm.overrides` 只约束 Recharts 2.x、`react-quill-new` 和 Quill 2.0.3 到 Lodash 4.18.1 或同主版本的更新。父包提高安全下限或移除相关依赖后可清理对应覆写。
- 仓库体检入口继续从自身位置定位项目根目录，运行 `pnpm check:all` 并传播退出码。上一轮验证过桌面入口和缺少根清单时的错误提示，移动仓库时需更新桌面入口路径。
- 保留 VFX、渲染深度、存档与 CI 诊断契约。空间运行时交接见提交 `6739014` 中的 `docs/HANDOFF.md`。

## 5. 下一棒任务

1. 修复进入默认分支后，复核 GitHub 告警和首次 Dependabot 分组运行，并跟进剩余中危。
2. 前后版本交错复测 84 敌人场景的 GC 峰值，同时在低端 GPU 核对精灵批处理、VFX 和纹理上传。
