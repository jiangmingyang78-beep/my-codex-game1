# Emberwood 三模式空间运行时：架构与验收报告

冒险、生存、永夜现可共用遮挡、局部追击导航和刷怪落点校验。全量 155 项单测、冒险回归和生产构建通过。永夜 84 敌人压测显示，渲染 CPU P95 从 2.3 降到 1.8 ms，主线程 GC 总时间从 67.6 降到 34.3 ms。仍记录到 GC 暂停，零抖动目标尚未达成。

## 空间查询与渲染

| 子系统 | 实现与接入 | 行为与边界 |
| --- | --- | --- |
| 遮挡视野 | `fovShadowcast.ts` 的 `VisibilityMask` 用八象限递归扫描和可复用的字节掩码。玩家视野供感知查询，每个光源独立计算投影。 | 墙面可见，后方进入阴影。低灌木透光。另一侧的独立光源可以照亮本侧。门、障碍和光源变化更新缓存。 |
| 火光 | `LightGrid` 汇合裁剪后的光级。`NightOverlay` 在离屏画布擦出分级亮区，`TorchlightAtmosphereLayer` 按亮格生成光晕。生存 Canvas 按光源裁剪。 | 夜色纹理在相机跨格、视口缩放、光照版本或色阶变化时重绘。火焰粒子仍可逐帧动画，地面沿用烘焙纹理。手持光源按格心定位。 |
| 寻路与感知 | `flowField.ts` 从玩家反向求解 32×32 四邻接加权 Dijkstra，复用距离、堆及后继数组。在追击时沿后继格走，转角先对齐，邻格密度提供小幅分离。 | 同一局部场供多名敌人使用。玩家跨格、障碍、灯光、火焰或权重变更后，首次追击查询才重算当前窗口。窗口外沿用现有移动逻辑。新发现目标需 LOS 或进入听距，追击中的敌人保留已有目标记忆。 |
| 对象与视图 | 敌人记录复用时清除旧字段；投射物池预热 64 项，归还时清理目标、速度、伤害等字段。核心粒子按上限预热，敌人视图按纹理复用；归还时隐藏并停用碰撞体。 | 覆盖常规战斗与永夜刷怪、弹体结束和粒子更新路径。开发工具栏显示 Phaser 渲染前后事件间的 CPU 耗时。 |
| 模式接口 | `worldContext.ts` 定义 `IWorldContext`、`WorldAdapter` 和 `ISpawnDirector`。冒险与永夜通过 `runContext.ts` 接入，生存为自身地形、建筑与植物提供适配。 | 共用地形、碰撞/遮光、亮度、元素点燃/冻结、感知、追击引导及落点校验。生成环、亮度与类别容量采用同一套规则；各模式继续决定波次、目标和特殊单位。 |

默认亮格额外代价为 2，火焰额外代价为 12，听距为 2 格。三项对应 `brightCost`、`fireCost`、`hearingTiles`，配置位于 `balance.json` 的 `survival` 节点，与覆盖配置共用校验。寻路区分实体不可通过与高代价可通过。当前失效策略会重算整个局部窗口；未实现仅更新变化节点的最短路径修复。

## 正确性与回归

| 验证 | 结果 |
| --- | --- |
| `pnpm test` | 155/155，含 renderDepth、runtimeRules、riposte 和 5 项新增空间运行时测试。输入源码基线 150/150。 |
| 新增算法与池测试 | 验证八个方向墙面可见、墙后遮光、第二光源与开门更新；有碰撞半径的追击者绕出 U 形岩壁并抵达玩家；同格缓存、火险权重和障碍版本；弹体和怪物分别连续复用 1,000 次，检查旧状态清理。 |
| Node 流场基准 | 32×32 加权障碍图，100 次预热，256 次逐次计时。P50 0.045 ms、P95 0.092 ms、最慢 0.383 ms；测试检查最大值 < 1 ms。FOV 与流场均以 Node 24 直接导入、执行，无 DOM、Phaser 或外部寻路库依赖。 |
| 冒险浏览器回归 | 标题选人、贴图与初始背包、格挡、旧版与当前版存档、跨区采集与夜袭、双炉印、爆炸特效和胜利页通过。 |
| 浏览器 E2E | 本地 Chromium / Playwright 执行两份仓库 E2E 用例，覆盖开新游戏和刷新返回标题；另进入生存模式，以种子 42 创建世界并观察到对应存档。云端 E2E 服务未运行。 |
| 地图及运行时 | 地图工具 11/11，运行规则与平衡 33/33，LDtk 18/18；真实键盘回归无错误、夜袭峰值 8。默认和高压各 900 秒模拟均无失败。上述工具的单测与全量统计有重叠。 |
| 静态检查与发布 | `pnpm typecheck`、`pnpm fix`、`pnpm build` 均成功。构建提示 Browserslist 数据陈旧。 |

回归夹具同步到了当前菜单、英雄面板和存档版本。原有感知半径用例改用无遮挡地面，以隔离距离规则；新增用例单独验证岩壁。长跑夹具传送后同步出生坐标并触发重新感知。地图控制台独立验证改为静态导入同一个合表函数，断言保持原样。冒险/永夜入口还修复了战斗半径常量循环初始化，区域固定驻民与额外生成单位分别按持久化规则处理。

## 同屏 84 个敌人实测

仓库脚本 `src/frontend/tests/spatial-stress.js` 在永夜场景生成 84 只追击的霜鼠，每帧在玩家处触发一次首领命中特效。Chromium WebGL（SwiftShader），1024×640，Vite 开发构建。每个版本使用三个新页面，每轮共 180 帧，跳过前 40 帧。渲染 CPU 用 Phaser 的 prerender→postrender 区间，含该帧特效触发；帧间隔包括模拟、渲染和浏览器调度。CDP 使用用户标记截取同一主线程的 MinorGC/MajorGC 事件。输入包存在初始化顺序错误；仅在基线测量副本中把 CONTACT_PX 写为等值的 14（6+5+3），以便进入同一永夜场景。

| 指标 | 输入基线 | 升级后 |
| --- | ---: | ---: |
| 渲染 CPU P50，三轮中位数 | 1.3 ms | 1.1 ms |
| 渲染 CPU P95，三轮中位数 | 2.3 ms | 1.8 ms |
| 帧间隔 P50，三轮中位数 | 44.2 ms | 39.3 ms |
| 帧间隔 P95，三轮中位数 | 61.1 ms | 58.7 ms |
| 主线程 GC 次数，420 帧合计 | 33 | 28 |
| 主线程 GC 时间，420 帧合计 | 67.628 ms | 34.313 ms |
| 最长一次 GC | 9.149 ms | 5.188 ms |

| 版本 / 轮次 | 渲染 P95（ms） | 帧间隔 P95（ms） | GC 次数 | GC 总耗时（ms） |
| --- | ---: | ---: | ---: | ---: |
| 基线 1 | 5.6 | 71.7 | 11 | 37.546 |
| 基线 2 | 2.1 | 61.1 | 11 | 17.898 |
| 基线 3 | 2.3 | 58.7 | 11 | 12.184 |
| 升级 1 | 1.8 | 58.7 | 10 | 13.697 |
| 升级 2 | 4.6 | 62.0 | 9 | 9.567 |
| 升级 3 | 1.6 | 55.0 | 9 | 11.049 |

这组测量可以复现软件 WebGL 上的整体趋势。升级后第二轮渲染 P95 高于基线第二轮，三轮都有 GC。未采集硬件 GPU 时间和 draw call 数；现有数据无法将全部收益归因到某一项合批或池化改动。U 型墙测试覆盖局部窗口内的可通行路线，超出窗口的大型围墙和低端真机手感仍需单独验证。

## 复现入口与参考

- 在仓库根目录运行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm typecheck`、`pnpm build`。单独验证空间模块可运行 `node tests/run-unit-tests.mjs tests/spatialRuntime.test.ts`。
- 启动前端 Vite 服务，在 Playwright 的新 Chromium 页面上执行 `src/frontend/tests/adventure-regression.js`。同样执行 `spatial-stress.js` 并传入服务地址，可获得 JSON 格式的帧时间与 GC 结果。测试需要 Chromium CDP。
- 算法参考：[rot.js RecursiveShadowcasting](https://ondras.github.io/rot.js/doc/classes/fov_recursive_shadowcasting.default.html)、[rot.js Dijkstra](https://ondras.github.io/rot.js/doc/classes/path_dijkstra.default.html)。
- 渲染与资源复用参考：[Phaser 3.90 RenderTexture](https://phaser.io/oss/docs/api-documentation/3.90.0/class/gameobjects-rendertexture)、[Ourcade Phaser 3 Object Pooling](https://github.com/ourcade/phaser3-object-pooling)。
