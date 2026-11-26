import { type Session, editable, selected, toolNames } from "../state/selection";
import { changePoint, removePoint, resetPoint } from "../state/mapCommands";
import { button, choice, el, group, itemOptions, numberBox } from "../ui/controls";
export function mapPanel(root: HTMLElement, s: Session) {
  const tools = group(root, "对象工具");
  if (s.mode === "adventure") {
    const strip = el("div", "", "tool-strip");
    toolNames.forEach((name, i) => {
      const b = button(i + 1 + " " + name, () => {
        s.tool = i + 1;
        s.refresh();
      });
      b.classList.toggle("active", s.tool === i + 1);
      strip.append(b);
    });
    tools.append(strip);
    if (s.tool === 2)
      choice(tools, "放置物资", itemOptions, s.itemId, (v) => {
        s.itemId = v;
      });
    if (s.tool === 3)
      choice(
        tools,
        "放置怪物",
        s.store.draft["enemies.json"].enemies.map((e) => [e.id, e.name]),
        s.placeEnemy,
        (v) => {
          s.placeEnemy = v;
        },
      );
  } else tools.append(el("p", "此模式使用独立生成器，可平移、缩放和检视。"));
  const inspect = group(root, "点位检视");
  const points = [...s.map.spawns, ...s.map.objects];
  choice(
    inspect,
    "地图点位",
    [["", "选择点位"], ...points.map((p) => [p.id, p.label + " · " + p.id] as const)],
    s.selected ?? "",
    (id) => {
      s.selected = id || null;
      s.focus();
      const p = selected(s);
      if (p && "enemyId" in p && p.enemyId) s.enemyId = p.enemyId;
      s.refresh();
    },
  );
  const p = selected(s);
  if (!p) {
    inspect.append(el("p", "点击地图选择点位。滚轮缩放，WASD 平移。"));
    return;
  }
  inspect.append(el("div", p.id + " · (" + p.tx + ", " + p.ty + ")", "detail"));
  if (s.mode !== "adventure" || !editable(p)) {
    inspect.append(el("p", p.detail ?? p.label));
    return;
  }
  const update = (key: string, v: unknown) => changePoint(s, p, { [key]: v });
  for (const axis of ["tx", "ty"] as const)
    numberBox(inspect, axis === "tx" ? "横坐标 tx" : "纵坐标 ty", p[axis], (v) => update(axis, v), "1");
  if ("itemId" in p) {
    choice(inspect, "产出物品", itemOptions, p.itemId!, (v) => update("itemId", v));
    numberBox(inspect, "单次产出", p.yield ?? 1, (v) => update("yield", v), "1");
    choice(
      inspect,
      "黎明再生",
      [
        ["0", "关闭"],
        ["1", "开启"],
      ],
      p.renewable ? "1" : "0",
      (v) => update("renewable", v === "1"),
    );
    const o = s.store.draft["worldOverrides.json"];
    const config = o.addedObjects.find((n) => n.id === p.id) ?? o.editedObjects[p.id];
    const rules = s.store.draft["encounters.json"].resources;
    const timing = group(inspect, "单点刷新", false);
    numberBox(
      timing,
      "再生次数上限",
      config?.renewalLimit ?? rules?.renewalLimit ?? 1,
      (v) => update("renewalLimit", v),
      "1",
    );
    numberBox(timing, "刷新冷却（秒）", config?.respawnCooldownSec ?? rules?.cooldownSec ?? 60, (v) =>
      update("respawnCooldownSec", v),
    );
    timing.append(el("p", "单点参数优先于全局设置，适用于可再生物资。"));
  } else if ("enemyId" in p) {
    choice(
      inspect,
      "常驻怪物",
      s.store.draft["enemies.json"].enemies
        .map((e) => [e.id, e.name] as const)
        .concat(s.store.draft["legacyEnemies.json"].enemies.map((e) => [e.id, e.name] as const)),
      p.enemyId!,
      (v) => {
        s.enemyId = v;
        update("enemyId", v);
      },
    );
    choice(
      inspect,
      "所属区域",
      s.map.regions.map((r) => [r.id, r.name]),
      p.regionId!,
      (v) => update("regionId", v),
    );
    inspect.append(
      button("调优这只怪物", () => {
        s.tab = "enemy";
        s.enemyId = p.enemyId!;
        s.refresh();
      }),
    );
  }
  inspect.append(
    button("复原点位", () => resetPoint(s, p)),
    button("删除点位", () => removePoint(s, p)),
  );
}
