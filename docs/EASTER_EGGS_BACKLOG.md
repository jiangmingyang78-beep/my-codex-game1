# 《余烬林：最后一炬》彩蛋扩展索引与接入清单（Backlog）

> 本文档为纯策划与工程接入清单草案，未修改 `src/frontend/src/` 下任何代码。供主线封板后集中分批接入表现层。

---

## 一、架构总则与「零存档污染」硬约束

为保证现有 `localStorage` 存档与双模式数值绝对纯净，后续所有彩蛋接入必须遵守以下三条铁律：

1. **严禁修改存档 Schema**：
   - 不得向 `emberwood-torch:run:v1`（局内快照）、`emberwood-torch:run:v1:backup` 或 `emberwood-torch:meta:v1` 写入任何彩蛋专属字段、布尔标记或计数器。
   - `core/snapshot*.ts` 与 `core/saveMigration.ts` 保持零改动。
2. **使用 `WeakMap` 与纯表现层局部态**：
   - 所有“本局仅触发一次 / 冷却计时 / 连击或静止统计”均由模块级私有 `WeakMap<object, EggRuntimeState>`（以当前 `runState` 或 `scene` 实例为键）或 React 组件局部 `useRef` 维护；页面刷新或开新局后自动垃圾回收，零持久残留。
   - 跨局联动彩蛋仅允许**只读**既有 `meta` 字段（例如 `meta.unlockedHeroes`、`meta.notes`、`meta.survivalUnlocks`）。
3. **仅表现层与可降级原则**：
   - 仅触发 Toast 短句、现有 `vfx` 公共粒子/闪光接口（严禁改动 `src/frontend/src/vfx/**` 函数签名）、音效微调或 UI 装饰。
   - 必须响应 `prefers-reduced-motion: reduce` 与 Canvas 渲染降级，不得阻塞主循环或战斗判定。

---

## 二、标准化彩蛋接入清单模板

```markdown
### [EE-XX] 彩蛋标题
- **分类**：英雄剧情 / 怪物生态 / 物品营火 / 双模式联动 / UI 与浏览器
- **前置条件**：只读数据条件（如 heroId / regionId / inventory / meta 只读状态）
- **预期触发事件**：游戏内事件名或 UI 交互钩子（如 `enemy.defeated`、`item.crafted`、`scene.idle`）
- **数据对齐**：引用的精确 JSON ID（不新增/篡改平衡数值）
- **表现层效果**：Toast 文本 / 粒子色值 / 音效 / CSS 动画（含 `reduced-motion` 回退）
- **零存档污染方案**：`WeakMap` 键名与字段，或纯 UI 组件局部态说明
- **验收步骤**：1-2-3 步可复现手动验证流程
- **当前状态**：`[ ] 待接入` / `[x] 已接入`
```

---

## 三、五大分区彩蛋索引与接入 Backlog（共 18 项）

### 分区 A：英雄剧情（Hero Lore）

| ID | 标题 | 前置条件与对齐 ID | 预期触发事件 | 表现层效果 | 零存档污染方案 |
| --- | --- | --- | --- | --- | --- |
| `EE-H01` | 铁匠的旧账 | 使用 `gale_smith` 击败 `mill_overseer` | `enemy.defeated` (`enemyId === "mill_overseer"`) | 延迟 0.6s 弹出格雷专属 Toast：「铁凉了，可你的炉锤还热着。」并伴随橙金余烬粒子 | `WeakMap<RunContext, Set<string>>` 记录 `"EE-H01"` |
| `EE-H02` | 橙巾余温 | 使用 `lin_tinder` 在 `main_campfire` 火圈内静止超过 `8s` | `camp.idle_tick`（在火圈内无移动/攻击输入） | 凛角色头顶浮现 1 次暖橙呼吸微光，`Toast` 轻声提示：「风雪停在火圈外面。」 | `WeakMap<Scene, { idleSec: number; shown: boolean }>` |
| `EE-H03` | 采药人的警示 | 使用 `suheng_herb` 首次进入 `deep_woods` 且背包持有 `herb` | `region.entered` (`regionId === "deep_woods"`) | 覆盖一次轻微草绿微光粒子，弹出短句：「苦草的根还在发苦，别碰沼泽里的紫雾。」 | `WeakMap<RunContext, Set<string>>` |
| `EE-H04` | 书吏的页脚落款 | 使用 `alvin_scribe` 且 `meta.notes`（只读）数量 ≥ 2 | `run.started` 或 `hud.notes_opened` | 营地笔记弹窗末尾多出一行淡墨批注：「——抄录自灰烬书吏第五本手抄。」 | 纯 UI 根据只读 `heroId` 条件渲染，无任何写入 |

---

### 分区 B：怪物生态（Enemy Ecology）

| ID | 标题 | 前置条件与对齐 ID | 预期触发事件 | 表现层效果 | 零存档污染方案 |
| --- | --- | --- | --- | --- | --- |
| `EE-E01` | 怕火的雪林兽 | `snow_weasel` 或 `frost_rat` 靠近 `main_campfire` 火圈边界 0.5 格内 | `enemy.ai_tick`（与营火距离触发退避瞬间） | 怪物头顶短暂闪出 1 帧惊叹像素点，并发出轻脆雪地抓挠声（无数值改动） | `WeakMap<EnemyEntity, { lastFlinchAt: number }>` 冷却 12s |
| `EE-E02` | 灰雪微雨里的火星 | 天气为 `ember_rain` 时攻击 `rotted_woodcutter` 或 `cinder_husk` | `enemy.damaged` (`weatherId === "ember_rain"`) | 受击点额外溅出 3 颗 `#ffd166` 火星粒子（复用既有受击特效接口） | 无状态纯事件监听 |
| `EE-E03` | 磨坊蛛的笔记呼应 | `meta.notes` 只读包含 `first_ember_seal` 时，闪避 `mill_spider` 丝团擦肩 1 格内 | `projectile.grazed`（或玩家在丝团蓄势期横移躲开） | 屏幕角落轻微闪出文字：「横移一步——正如笔记所写。」 | `WeakMap<RunContext, Set<string>>` 每局仅触发 1 次 |
| `EE-E04` | 余烬共鸣 | 持有 `ember_lantern` 迎战 `summit_pyre_warden` 进入 30% 三阶段 | `boss.phase_changed` (`phaseIndex === 2`) | 守炬者周身黑雾短暂被青金与橙红双色余烬环扫亮（纯视觉演出） | `WeakMap<EnemyEntity, boolean>` 标记是否已演出 |

---

### 分区 C：物品与营火（Items & Campfire）

| ID | 标题 | 前置条件与对齐 ID | 预期触发事件 | 表现层效果 | 零存档污染方案 |
| --- | --- | --- | --- | --- | --- |
| `EE-I01` | 冻肉伤胃的忠告 | 使用快捷栏食用 `raw_meat` | `item.consumed` (`itemId === "raw_meat"`) | 在扣 1 点血的同时弹出冷幽默 Toast：「冰碴卡在喉咙里……真该丢到火上烤一烤。」 | `WeakMap<RunContext, { rawMeatWarned: boolean }>` |
| `EE-I02` | 矛刃双鸣 | 同时持有 `iron_spear` 与 `iron_blade` 时完成任意一次铸造 | `item.crafted`（检测背包同时具备两件武器） | 触发一声清脆双声部打铁共鸣音效，并提示：「长矛守距，短刃破甲。」 | `WeakMap<RunContext, Set<string>>` |
| `EE-I03` | 火站指东 | 在 `old_mill_relay` 成功放置 `relay_kit` | `relay.ignited` (`relaySocketId === "old_mill_relay"`) | 火焰腾起时飘出 4 颗慢速金色火星，朝东端 `final_beacon` 方向飘散 1.5s | 纯一次性 VFX 触发，无状态 |
| `EE-I04` | 满抗光暖边 | 同时生效 `warm_stew` buff 与 `lantern` 或 `ember_lantern` | `hud.stats_render` | HUD 火炬条外框短暂呈现淡金色暖边光泽（纯 CSS class 切换） | React 组件派生状态（不写存储） |

---

### 分区 D：双模式联动（Adventure ↔ Survival）

| ID | 标题 | 前置条件与对齐 ID | 预期触发事件 | 表现层效果 | 零存档污染方案 |
| --- | --- | --- | --- | --- | --- |
| `EE-D01` | 炉印蓝图开局低语 | 进入生存模式时只读检测到 `unlock_ember_brazier` 已解锁 | `survival.run_started` | 营火旁浮现一句旁白：「旧磨坊的炉温，似乎也跟着来到了这片雪林。」 | `WeakMap<RunContext, boolean>` + 只读 `meta.survivalUnlocks` |
| `EE-D02` | 黑雾里的冷光菌 | 生存模式 `freezing_fog` 天气下，`glow_cap` 或 `charred_ancient` 成熟瞬间 | `plant.matured` (`plantId === "glow_cap" \| "charred_ancient"`) | 植株周围泛起一圈柔和冷蓝/余烬光晕，提示：「它在黑雾里反而醒过来了。」 | `WeakMap<PlantEntity, boolean>` |
| `EE-D03` | 远山烽星 | 只读检测到 `meta.notes` 包含 `beacon_restored`（已通关过冒险模式） | `title.seasons_render`（冬季预览阶段） | `SeasonsDiorama` 冬季雪夜远山脊顶多出 1 颗微弱跳动的 `#ff7a2f` 烽火像素点 | 纯 Canvas 绘制，只读 `meta` |

---

### 分区 E：UI 与浏览器（UI & Browser）

| ID | 标题 | 前置条件与对齐 ID | 预期触发事件 | 表现层效果 | 零存档污染方案 |
| --- | --- | --- | --- | --- | --- |
| `EE-U01` | 四季巡礼烟囱火星 | 在 `SeasonsDiorama` 右上角依次手动点遍「春 → 夏 → 秋 → 冬」 | `ui.season_manual_click` | 集齐四季的瞬间，木屋烟囱向上喷出一小簇金色暖光火星 | 组件 `useRef(new Set())` 局部状态，关闭页面即重置 |
| `EE-U02` | 控制台火炬致意 | 任意页面打开浏览器 DevTools 控制台 | `app.mounted` | 打印 1 段克制的 ASCII 像素火炬与台词：「火还在，就还能回家。——《余烬林：最后一炬》」 | 单次模块加载执行，零内存与存储开销 |
| `EE-U03` | 切出标签页的等候 | 游戏进行中（冒险/生存）页面切至后台 | `document.visibilitychange` (`document.hidden === true`) | 浏览器标签页标题临时改为 `🔥 火光仍在等候… · 余烬林`，切回时恢复原标题 | 模块级局部变量保存 `originalTitle` |

---

## 四、主线封板后集中接入顺序与回归校验清单

### 推荐分批节奏
1. **第一批（P0 · 零风险表现层）**：接入 `EE-U01` ~ `EE-U03` 与 `EE-D03`（仅涉及 UI/TitleScreen/浏览器事件，不触碰游戏核心循环）。
2. **第二批（P1 · 英雄与物品演出）**：接入 `EE-H01` ~ `EE-H04`、`EE-I01` ~ `EE-I04`（挂接在现有事件总线或 HUD 派生状态上）。
3. **第三批（P2 · 怪物生态与双模式）**：接入 `EE-E01` ~ `EE-E04`、`EE-D01` ~ `EE-D02`（确保每个实体均有 `WeakMap` 冷却保护，不增加每帧 GC 压力）。

### 回归验收标准
- [ ] **存档零字节差异**：接入彩蛋前后分别读取 `localStorage["emberwood-torch:run:v1"]` 与 `localStorage["emberwood-torch:meta:v1"]`，确认键名集合与序列化字段结构完全一致。
- [ ] **VFX 接口不变性**：未修改 `src/frontend/src/vfx/**` 任何导出函数名与参数签名。
- [ ] **降级与无障碍合规**：在 `prefers-reduced-motion: reduce` 与无 WebGL 纯 Canvas 模式下，彩蛋不报错、不产生卡顿，视觉动效按预期跳过或静默退化。
- [ ] **构建检查**：全部接入后通过 `pnpm typecheck && pnpm fix && pnpm build`。
