# 英雄多帧精灵表（Spritesheet）接入指南

本项目英雄渲染采用**「多帧 PNG 精灵表 + 程序化贴图自动降级」**混合管线。已启用 PNG 的英雄在场景加载时使用多帧动画；尚未启用或图片缺失时，自动降级为 `heroes.json` 调色板生成的程序化像素贴图，绝不阻塞启动。

---

## 1. 画布与锚点规范

| 属性 | 标准值 | 说明 |
| --- | --- | --- |
| 整表尺寸 | `128 × 128` px | `4 列 × 4 行` 网格，共 16 帧（按行优先索引 `0..15`） |
| 单帧尺寸 | `32 × 32` px | `frameWidth: 32, frameHeight: 32`，透明背景 RGBA PNG |
| 角色身高 | 约 `16 ~ 20` px | 建议头顶约在 `y = 9..11`，留出挥刀高举与特效空间 |
| 脚底锚点 | `(16, 28)` px | 对应配置 `"originX": 0.5, "originY": 0.875`，脚底阴影与火圈判定均对齐此点 |
| 默认朝向 | **面向右侧（`+X`）** | 向左移动时由渲染层自动水平镜像（`flipX = true`） |
| 缩放滤波 | 最近邻（`NEAREST`） | 代码强制开启 `FilterMode.NEAREST`，请勿导出抗锯齿半透明毛边 |

---

## 2. 帧序与动作定义（Row-Major `0..15`）

| 动作键 | 行列位置 | 帧索引 (`start..end`) | 默认帧率 | 循环 | 触发优先级与视觉建议 |
| --- | --- | --- | --- | --- | --- |
| `idle` | 第 1 行（列 0–3） | `0 .. 3` | `5` fps | `-1`（无限） | 最低优先级；建议表现呼吸起伏与围巾/衣摆微动 |
| `walk` | 第 2 行（列 0–3） | `4 .. 7` | `9` fps | `-1`（无限） | 移动距离 `> 0.15px/帧` 时触发；4 帧完整迈步循环 |
| `attack` | 第 3 行（列 0–3） | `8 .. 11` | `16` fps | `0`（单次） | `attackAnimSec > 0` 时触发；蓄力 → 前劈 → 延伸 → 收势 |
| `dash` | 第 4 行（列 0–1） | `12 .. 13` | `14` fps | `0`（单次） | `Shift` 踏雪急步位移期间触发；压低重心前冲姿态 |
| `hurt` | 第 4 行（列 2） | `14 .. 14` | `8` fps | `0`（单次） | 受击瞬间触发；后仰护身姿态（配合既有白闪/闪烁） |
| `dead` | 第 4 行（列 3） | `15 .. 15` | `4` fps | `0`（单次） | 最高优先级（`status === "dead"`）；倒地静止帧 |

> 动画状态机优先级：`dead` > `hurt` > `dash` > `attack` > `walk` > `idle`。

---

## 3. 新增或替换英雄 PNG 的步骤

1. **放置图片**：将导出的透明底 PNG 放入：
   ```text
   src/frontend/public/assets/sprites/heroes/<heroId>.png
   ```
   支持的 `<heroId>`：`lin_tinder`（凛）、`gale_smith`（格雷）、`suheng_herb`（素蘅）、`corvus_hunt`（鸦羽）、`alvin_scribe`（艾尔文）。
2. **启用配置**：打开 `src/frontend/src/data/heroSprites.json`，将对应英雄的 `"enabled"` 改为 `true`（若自定义了帧数或帧率，可同步调整 `frameWidth` / `frameHeight` / `anims`）。
3. **本地验证**：运行 `pnpm --filter @caffeine/template-frontend dev`，在标题页选择该英雄进入冒险模式或永恒模式，依次测试站立、四向行走、空格攻击、`Shift` 急步与受击表现。
4. **重新生成样例图（可选）**：若需重置「凛」的验证精灵表，可在仓库根目录执行：
   ```bash
   node tools/generate-hero-sheet-sample.mjs
   ```
