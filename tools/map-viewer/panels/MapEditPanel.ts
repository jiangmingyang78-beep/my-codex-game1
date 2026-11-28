import { type Session, editable, selected, toolNames } from "../state/selection";
import { changePoint, removePoint, resetPoint } from "../state/mapCommands";
import { button, choice, el, group, itemOptions, numberBox } from "../ui/controls";
export function mapPanel(root: HTMLElement, s: Session) {
  const tools = group(root, "Object tool");
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
      choice(tools, "Putting the material in place", itemOptions, s.itemId, (v) => {
        s.itemId = v;
      });
    if (s.tool === 3)
      choice(
        tools,
        "Put the monster in",
        s.store.draft["enemies.json"].enemies.map((e) => [e.id, e.name]),
        s.placeEnemy,
        (v) => {
          s.placeEnemy = v;
        },
      );
  } else tools.append(el("p", "This mode uses an independent generator that can be scaled, scaled and reviewed."));
  const inspect = group(root, "Organisation");
  const points = [...s.map.spawns, ...s.map.objects];
  choice(
    inspect,
    "Map site",
    [["", "Select the point"], ...points.map((p) => [p.id, p.label + " · " + p.id] as const)],
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
    inspect.append(el("p", "Click the map to select a point. Rolling wheels zoom, wadissing."));
    return;
  }
  inspect.append(el("div", p.id + " · (" + p.tx + ", " + p.ty + ")", "detail"));
  if (s.mode !== "adventure" || !editable(p)) {
    inspect.append(el("p", p.detail ?? p.label));
    return;
  }
  const update = (key: string, v: unknown) => changePoint(s, p, { [key]: v });
  for (const axis of ["tx", "ty"] as const)
    numberBox(inspect, axis === "tx" ? "tx" : "Vertical coordinates ty", p[axis], (v) => update(axis, v), "1");
  if ("itemId" in p) {
    choice(inspect, "Output items", itemOptions, p.itemId!, (v) => update("itemId", v));
    numberBox(inspect, "Single output", p.yield ?? 1, (v) => update("yield", v), "1");
    choice(
      inspect,
      "Dawn reborn",
      [
        ["0", "Close"],
        ["1", "Turn it on"],
      ],
      p.renewable ? "1" : "0",
      (v) => update("renewable", v === "1"),
    );
    const o = s.store.draft["worldOverrides.json"];
    const config = o.addedObjects.find((n) => n.id === p.id) ?? o.editedObjects[p.id];
    const rules = s.store.draft["encounters.json"].resources;
    const timing = group(inspect, "Single-point refresher", false);
    numberBox(
      timing,
      "The maximum number of rebirths",
      config?.renewalLimit ?? rules?.renewalLimit ?? 1,
      (v) => update("renewalLimit", v),
      "1",
    );
    numberBox(timing, "Refresh cooling (seconds))", config?.respawnCooldownSec ?? rules?.cooldownSec ?? 60, (v) =>
      update("respawnCooldownSec", v),
    );
    timing.append(el("p", "Single point parameters take precedence over global settings and apply to renewable materials."));
  } else if ("enemyId" in p) {
    choice(
      inspect,
      "Stay with the monster",
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
      "Region",
      s.map.regions.map((r) => [r.id, r.name]),
      p.regionId!,
      (v) => update("regionId", v),
    );
    inspect.append(
      button("Get this monster", () => {
        s.tab = "enemy";
        s.enemyId = p.enemyId!;
        s.refresh();
      }),
    );
  }
  inspect.append(
    button("Restores the point", () => resetPoint(s, p)),
    button("Deletes the point", () => removePoint(s, p)),
  );
}
