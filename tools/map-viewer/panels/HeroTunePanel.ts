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
    "The current hero",
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
  numbers(group(root, "Global battle"), s, file, ["hero"]);
  for (const [k, title] of [
    ["hp", "Life is invincible"],
    ["hunger", "Food consumption"],
    ["light", "The torches are on the line"],
  ])
    numbers(group(root, title, false), s, file, ["stats", k]);
  const fire = group(root, "Campfire ring");
  for (const level of [1, 2, 3])
    numeric(fire, s, file, ["camp", "radiiTilesByLevel", level], "Lv." + level + " Radius (g))");
  const dash = group(root, "Step fast", false);
  dash.append(el("p", "Default distance changes with the speed of the move; you have to hurry with the specified number of cells after filling distance."));
  for (const [k, v] of Object.entries(scenarioDefaults.dash))
    numeric(dash, s, "encounters.json", ["dash", k], k === "distanceTiles" ? "Distance (g))" : "Cool (seconds))", v);
  numbers(group(root, h.name + " · " + h.traitName), s, "heroes.json", [...path, "traits"]);
  const bag = group(root, "Initial carrying of goods");
  for (const [key] of Object.entries(h.startingInventory)) {
    const entry = el("div", "", "bag-entry");
    bag.append(entry);
    choice(
      entry,
      "Carrying things",
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
    numeric(entry, s, "heroes.json", [...path, "startingInventory", key], "Quantity");
    entry.append(button("Remove", () => s.store.field("heroes.json", [...path, "startingInventory", key], undefined)));
  }
  bag.append(
    button("Adds the carrying items", () => {
      const opt = itemOptions.find(([id]) => !(id in h.startingInventory));
      if (opt) s.store.field("heroes.json", [...path, "startingInventory", opt[0]], 1);
    }),
  );
}
