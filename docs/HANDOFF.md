# 双工具交接记录（HANDOFF）

## 1. 本棒工具与改动清单（Antigravity — 首页替换为星露谷风四季光影天气循环动画）
- **新增**：`game/ui/SeasonsDiorama.tsx`(143)、`game/ui/seasons/seasonsData.ts`(210)、`seasonsSample.ts`(92)、`seasonsScene.ts`(215)、`seasonsProps.ts`(157)、`seasonsWeather.ts`(247 ⚠️≥240)。
- **修改**：`src/frontend/src/game/ui/TitleScreen.tsx`(238)：初始主菜单（图 2）移除 5 英雄选择卡与详情栏，替换为四季光影天气循环动画，下方仅显示并排「冒险模式」与「生存模式」；点击「冒险模式」（图 1）后完整展示 5 英雄选择与详情栏及「新游戏 / 继续游戏 / 永恒模式」。
- **历史保留警戒文件**：`GameScene.ts`(263 ⚠️≥240)、`meta.ts`(255 ⚠️≥240)、`EntityViews.ts`(250 ⚠️≥240)、`tools/generate-hero-sheet-sample.mjs`(279 ⚠️≥240)。
- **零改动确认**：`core/snapshot*.ts`、`vfx/**`、英雄属性与存档逻辑零改动；`.tsx` 无原始 Hex 色值。

## 2. 已验证项
- 通过 `pnpm fix`、`pnpm typecheck`、`pnpm check`、`pnpm build`（零报错）。
- 四季动画支持 36s 平滑循环（春·融雪樱雨 / 夏·暖风萤夜 / 秋·霜枫雾岚 / 冬·雪夜孤火）及右上角手动点击切换季节预览，包含日月星辰、极光、云山视差、木屋烟囱与暖光窗、季节农田、池塘水波/结冰、风摆树木、动态营火光圈与粒子天气。

## 3. 未验证与已知风险
- 动画在 `prefers-reduced-motion: reduce` 模式下暂停自动轮播，但仍可通过右上角 `春/夏/秋/冬` 按钮手动切换静态预览。
- 警戒行数文件后续扩展前需优先拆分。

## 4. 锁定的接口与约束
- `TitleScreen.tsx` 保留 `data-ocid="title.adventure_button"`、`title.survival_button`、`title.new_game_button`、`title.continue_button`、`title.eternal_button`。
- `SeasonsDiorama` 内部画布锁定为 `320×124` 像素整数比例，CSS 强制 `[image-rendering:pixelated]`。

## 5. 下一棒任务
1. 按 `docs/HERO_SPRITESHEET_GUIDE.md` 补齐其余 4 位英雄的局内 `128×128` 多帧战斗精灵表并在 `heroSprites.json` 中开启。
2. 实机试玩永恒模式与生存模式，按体验微调平衡与动效细节。
