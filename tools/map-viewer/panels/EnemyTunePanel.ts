import { bossEnemy } from "../state/derivedMetrics";
import { scenarioDefaults } from "../state/ruleConfig";
import type { Session } from "../state/selection";
import { button, choice, el, group, itemOptions, numbers, numeric } from "../ui/controls";
let query = "",
  region = "",
  rank = "";
export function enemyPanel(root: HTMLElement, s: Session) {
  const list = group(root, "怪物名录");
  const catalog = (["enemies.json", "legacyEnemies.json"] as const).flatMap((file) =>
    s.store.draft[file].enemies.map((e, index) => ({ e, file, index })),
  );
  const search = el("input");
  search.type = "search";
  search.placeholder = "按名称或 ID 查找";
  search.ariaLabel = "怪物名称";
  search.value = query;
  list.append(search);
  const redraw = () => {
    s.refresh();
  };
  choice(
    list,
    "区域",
    [
      ["", "全部区域"],
      ...(s.map.mode === "adventure"
        ? s.map.regions.map((r) => [r.id, r.name] as const)
        : s.base.regions.map((r) => [r.id, r.name] as const)),
    ],
    region,
    (v) => {
      region = v;
      redraw();
    },
  );
  choice(
    list,
    "分类",
    [
      ["", "全部"],
      ["normal", "普通"],
      ["boss", "首领"],
    ],
    rank,
    (v) => {
      rank = v;
      redraw();
    },
  );
  const matches = catalog.filter(({ e }) => {
    const boss = bossEnemy(e.id);
    return (
      (e.name + e.id).includes(query) &&
      (!region || e.regionIds.includes(region)) &&
      (!rank || rank === (boss ? "boss" : "normal"))
    );
  });
  search.oninput = () => {
    query = search.value;
    s.refresh();
    const next = document.querySelector<HTMLInputElement>('[aria-label="怪物名称"]');
    next?.focus();
    next?.setSelectionRange(query.length, query.length);
  };
  if (!matches.length) {
    list.append(el("p", "没有匹配的怪物"));
    return;
  }
  const current = matches.find(({ e }) => e.id === s.enemyId) ?? matches[0];
  const { e, file, index } = current;
  s.enemyId = e.id;
  if (!s.map.spawns.some((p) => p.id === s.selected && p.enemyId === e.id))
    s.selected = s.map.spawns.find((p) => p.enemyId === e.id)?.id ?? null;
  choice(
    list,
    "怪物",
    matches.map(({ e }) => [e.id, e.name]),
    e.id,
    (v) => {
      s.enemyId = v;
      redraw();
      s.focus();
    },
  );
  const sites = s.map.spawns.filter((p) => p.enemyId === e.id);
  if (sites.length)
    choice(
      list,
      "预览刷点",
      sites.map((p) => [p.id, p.id]),
      s.selected ?? "",
      (v) => {
        s.selected = v;
        s.focus();
      },
    );
  else list.append(el("p", "当前地图没有该怪物的刷点。"));
  const monitor = el("section", "", "monitor");
  monitor.id = "monitor";
  root.append(monitor);
  const path = ["enemies", index];
  const base = group(root, "基础属性");
  for (const [k, label] of [
    ["maxHp", "生命上限"],
    ["attackDamage", "单次伤害"],
    ["moveSpeedPxPerSec", "移速（像素/秒）"],
  ])
    numeric(base, s, file, [...path, k], label);
  const view = group(root, "索敌与脱战预览", false);
  view.append(el("p", "蓝灰圈显示怪物进入追击和脱战的距离。橙圈使用当前怪物的攻击数据。"));
  for (const [k, v] of Object.entries(scenarioDefaults.perception))
    numeric(view, s, "encounters.json", ["perception", k], k === "aggroTiles" ? "索敌（格）" : "脱战（格）", v);
  if ("phases" in e && e.phases) {
    s.phase = Math.min(s.phase, e.phases.length - 1);
    choice(
      view,
      "预览阶段",
      e.phases.map((p, i) => [String(i), "阶段 " + (i + 1) + " · " + p.hpThreshold * 100 + "%"]),
      String(s.phase),
      (v) => {
        s.phase = Number(v);
        s.draw();
      },
    );
  }
  if (e.attack) numbers(group(root, "攻击距离与节奏"), s, file, [...path, "attack"]);
  if ("phases" in e && e.phases) numbers(group(root, "阶段攻击"), s, file, [...path, "phases"]);
  const drops = group(root, "掉落表");
  e.drops.forEach((d, i) => {
    const box = group(drops, "掉落 " + (i + 1)),
      p = [...path, "drops", i];
    choice(box, "物品", itemOptions, d.itemId, (v) => s.store.field(file, [...p, "itemId"], v));
    numeric(box, s, file, [...p, "count"], "数量");
    numeric(box, s, file, [...p, "probability"], "概率");
    box.append(
      button("移除掉落", () =>
        s.store.edit(file, (doc) => {
          doc.enemies[index].drops.splice(i, 1);
        }),
      ),
    );
  });
  drops.append(
    button("添加掉落", () =>
      s.store.edit(file, (doc) => {
        Object.assign(doc.enemies[index], {
          drops: [...doc.enemies[index].drops, { itemId: "wood", count: 1, probability: 1 }],
        });
      }),
    ),
  );
}
