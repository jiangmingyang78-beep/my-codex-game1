import { bossEnemy } from "../state/derivedMetrics";
import { scenarioDefaults } from "../state/ruleConfig";
import type { Session } from "../state/selection";
import { button, choice, el, group, itemOptions, numbers, numeric } from "../ui/controls";
let query = "",
  region = "",
  rank = "";
export function enemyPanel(root: HTMLElement, s: Session) {
  const list = group(root, "The list of monsters");
  const catalog = (["enemies.json", "legacyEnemies.json"] as const).flatMap((file) =>
    s.store.draft[file].enemies.map((e, index) => ({ e, file, index })),
  );
  const search = el("input");
  search.type = "search";
  search.placeholder = "Finds by name or IX";
  search.ariaLabel = "The name of the monster";
  search.value = query;
  list.append(search);
  const redraw = () => {
    s.refresh();
  };
  choice(
    list,
    "Region",
    [
      ["", "All regions"],
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
    "Classification",
    [
      ["", "All of it"],
      ["normal", "Normal"],
      ["boss", "Boss"],
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
    const next = document.querySelector<HTMLInputElement>('[aria-label="The name of the monster"]');
    next?.focus();
    next?.setSelectionRange(query.length, query.length);
  };
  if (!matches.length) {
    list.append(el("p", "No match for the monster"));
    return;
  }
  const current = matches.find(({ e }) => e.id === s.enemyId) ?? matches[0];
  const { e, file, index } = current;
  s.enemyId = e.id;
  if (!s.map.spawns.some((p) => p.id === s.selected && p.enemyId === e.id))
    s.selected = s.map.spawns.find((p) => p.enemyId === e.id)?.id ?? null;
  choice(
    list,
    "Monster",
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
      "Previews the brushpoint",
      sites.map((p) => [p.id, p.id]),
      s.selected ?? "",
      (v) => {
        s.selected = v;
        s.focus();
      },
    );
  else list.append(el("p", "The current map does not have the finger of the monster."));
  const monitor = el("section", "", "monitor");
  monitor.id = "monitor";
  root.append(monitor);
  const path = ["enemies", index];
  const base = group(root, "Base attributes");
  for (const [k, label] of [
    ["maxHp", "Life cap"],
    ["attackDamage", "Single injury"],
    ["moveSpeedPxPerSec", "Speeds of movement (pixels/sec))"],
  ])
    numeric(base, s, file, [...path, k], label);
  const view = group(root, "Enemy and off-war preview", false);
  view.append(el("p", "Blue gray rings show the distance from the monster to the chase and to the battle. Orange rings use the current monster attack data."));
  for (const [k, v] of Object.entries(scenarioDefaults.perception))
    numeric(view, s, "encounters.json", ["perception", k], k === "aggroTiles" ? "Soyuz)" : "Get out of the war)", v);
  if ("phases" in e && e.phases) {
    s.phase = Math.min(s.phase, e.phases.length - 1);
    choice(
      view,
      "Preview phase",
      e.phases.map((p, i) => [String(i), "Phase " + (i + 1) + " · " + p.hpThreshold * 100 + "%"]),
      String(s.phase),
      (v) => {
        s.phase = Number(v);
        s.draw();
      },
    );
  }
  if (e.attack) numbers(group(root, "Attack distance and rhythm"), s, file, [...path, "attack"]);
  if ("phases" in e && e.phases) numbers(group(root, "Stage attack"), s, file, [...path, "phases"]);
  const drops = group(root, "Drop the watch");
  e.drops.forEach((d, i) => {
    const box = group(drops, "Fall " + (i + 1)),
      p = [...path, "drops", i];
    choice(box, "Items", itemOptions, d.itemId, (v) => s.store.field(file, [...p, "itemId"], v));
    numeric(box, s, file, [...p, "count"], "Quantity");
    numeric(box, s, file, [...p, "probability"], "Probability");
    box.append(
      button("Removes the fall", () =>
        s.store.edit(file, (doc) => {
          doc.enemies[index].drops.splice(i, 1);
        }),
      ),
    );
  });
  drops.append(
    button("Adds drop", () =>
      s.store.edit(file, (doc) => {
        Object.assign(doc.enemies[index], {
          drops: [...doc.enemies[index].drops, { itemId: "wood", count: 1, probability: 1 }],
        });
      }),
    ),
  );
}
