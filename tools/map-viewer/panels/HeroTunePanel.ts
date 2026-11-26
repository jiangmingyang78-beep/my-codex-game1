import type { Session } from "../state/selection";
import { button, choice, el, group, itemOptions, numbers, numeric } from "../ui/controls";
import { scenarioDefaults } from "../state/ruleConfig";
export function heroPanel(root: HTMLElement, s: Session) {
  const file = "balance.json",
    heroes = s.store.draft["heroes.json"].heroes;
  const i = Math.max(
      0,
      heroes.findIndex((h) => h.id === s.heroId),
    ),
    h = heroes[i],
    path = ["heroes", i];
  choice(
    root,
    "当前英雄",
    heroes.map((h) => [h.id, h.name + " · " + h.epithet]),
    h.id,
    (v) => {
      s.heroId = v;
      s.refresh();
    },
  );
  const mon = el("section", "", "monitor");
  mon.id = "monitor";
  root.append(mon);
  numbers(group(root, "全局战斗"), s, file, ["hero"]);
  for (const [k, title] of [
    ["hp", "生命与无敌"],
    ["hunger", "饱食消耗"],
    ["light", "火炬续航"],
  ])
    numbers(group(root, title, false), s, file, ["stats", k]);
  const fire = group(root, "营火光圈");
  for (const level of [1, 2, 3])
    numeric(fire, s, file, ["camp", "radiiTilesByLevel", level], "Lv." + level + " 半径（格）");
  const dash = group(root, "急步", false);
  dash.append(el("p", "默认距离随移速变化；填写距离后按指定格数急步。"));
  for (const [k, v] of Object.entries(scenarioDefaults.dash))
    numeric(dash, s, "encounters.json", ["dash", k], k === "distanceTiles" ? "距离（格）" : "冷却（秒）", v);
  numbers(group(root, h.name + " · " + h.traitName), s, "heroes.json", [...path, "traits"]);
  const bag = group(root, "初始携带物品");
  for (const [key] of Object.entries(h.startingInventory)) {
    const entry = el("div", "", "bag-entry");
    bag.append(entry);
    choice(
      entry,
      "携带物品",
      itemOptions.filter(([id]) => id === key || !(id in h.startingInventory)),
      key,
      (v) => {
        s.store.edit("heroes.json", (doc) => {
          const inventory = doc.heroes[i].startingInventory as Record<string, number | undefined>;
          inventory[v] = inventory[key];
          delete inventory[key];
        });
      },
    );
    numeric(entry, s, "heroes.json", [...path, "startingInventory", key], "数量");
    entry.append(button("移除", () => s.store.field("heroes.json", [...path, "startingInventory", key], undefined)));
  }
  bag.append(
    button("添加携带物品", () => {
      const opt = itemOptions.find(([id]) => !(id in h.startingInventory));
      if (opt) s.store.field("heroes.json", [...path, "startingInventory", opt[0]], 1);
    }),
  );
}
