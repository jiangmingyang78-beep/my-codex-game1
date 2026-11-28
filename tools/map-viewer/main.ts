import { adventureSource, buildEternalSnapshot } from "./adapters/adventureAdapter";
import { buildSurvivalSnapshot } from "./adapters/survivalAdapter";
import { mapInteraction } from "./mapInteraction";
import { OBJ_COLOR } from "./mapRenderer";
import { enemyPanel } from "./panels/EnemyTunePanel";
import { heroPanel } from "./panels/HeroTunePanel";
import { mapPanel } from "./panels/MapEditPanel";
import { rulePanel } from "./panels/SpawnRulePanel";
import { ConsoleStore } from "./state/consoleStore";
import { type Session, type Tab } from "./state/selection";
import { actions, api } from "./ui/actions";
import { el } from "./ui/controls";
import { monitor } from "./ui/monitor";
import type { MapMode } from "./types";
const id = (k: string) => document.getElementById(k)!;
async function boot() {
  const { data, baseline } = await api("data"),
    store = new ConsoleStore(data, baseline);
  const make = adventureSource(),
    base = make();
  const s: Session = {
    store,
    base,
    map: base,
    mode: "adventure",
    tab: "map",
    tool: 1,
    selected: null,
    itemId: "ore",
    placeEnemy: "snow_weasel",
    enemyId: "snow_weasel",
    heroId: data["heroes.json"].defaultHeroId,
    leash: true,
    phase: 0,
    focus: () => {},
    draw: () => {},
    refresh: () => {},
  };
  const view = mapInteraction(s);
  s.draw = view.draw;
  s.focus = view.focus;
  const updateActions = actions(s);
  const panels = { map: mapPanel, enemy: enemyPanel, hero: heroPanel, rules: rulePanel };
  const seed = id("seedInput") as HTMLInputElement;
  let prevOverrides: unknown, prevBalance: unknown, prevRegions: unknown, prevEnemies: unknown, prevLegacy: unknown;
  let survivalDensity = 1;
  function syncMap() {
    const density = store.draft["survival-balance.json"].resourceDensity ?? 1;
    if (s.mode === "survival" && density !== survivalDensity) {
      survivalDensity = density;
      s.map = buildSurvivalSnapshot(seed.value, density);
    }
    const d = store.draft;
    if (
      s.mode === "adventure" &&
      (prevOverrides !== d["worldOverrides.json"] ||
        prevBalance !== d["balance.json"] ||
        prevRegions !== d["regions.json"] ||
        prevEnemies !== d["enemies.json"] ||
        prevLegacy !== d["legacyEnemies.json"])
    ) {
      s.map = make(d["worldOverrides.json"], d);
      prevOverrides = d["worldOverrides.json"];
      prevEnemies = d["enemies.json"];
      prevLegacy = d["legacyEnemies.json"];
      prevBalance = d["balance.json"];
      prevRegions = d["regions.json"];
    }
  }
  function status() {
    monitor(s);
    s.draw();
    updateActions();
    id("mapMeta").textContent = s.map.width + " × " + s.map.height + " tiles";
  }
  s.refresh = () => {
    if (s.tab !== "map") s.tool = 1;
    syncMap();
    const root = id("panelBody");
    root.replaceChildren();
    panels[s.tab](root, s);
    id("mapLayers").hidden = s.tab !== "map";
    document.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === s.tab);
      b.setAttribute("aria-selected", String(b.dataset.tab === s.tab));
    });
    status();
  };
  store.addEventListener("change", s.refresh);
  store.addEventListener("preview", () => {
    syncMap();
    status();
  });
  function load(mode: MapMode) {
    s.mode = mode;
    s.tool = 1;
    s.selected = null;
    prevOverrides = null;
    if (mode === "survival") s.map = buildSurvivalSnapshot(seed.value, survivalDensity);
    if (mode === "eternal") s.map = buildEternalSnapshot();
    document
      .querySelectorAll<HTMLElement>("[data-mode]")
      .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    id("seedBox").hidden = mode !== "survival";
    syncMap();
    const legend = id("legendList");
    legend.replaceChildren();
    for (const [color, label] of [
      ...Object.values(s.map.palette).map((p) => [p.color, p.name]),
      [OBJ_COLOR.campfire, "Campfire"],
      [OBJ_COLOR.ore, "Minerals"],
      [OBJ_COLOR.herb, "Vegetation"],
      ["#4ade80", "Hero"],
      ["#fb923c", "Stay with the monster"],
      ["#c084fc", "Night Monster"],
      ["#ff3b5c", "Boss"],
    ]) {
      const r = el("div", "", "legend-row"),
        chip = el("i", "", "chip");
      chip.style.background = color;
      r.append(chip, el("span", label));
      legend.append(r);
    }
    id("mapTitle").textContent = s.map.title;
    s.refresh();
    view.fit();
  }
  document
    .querySelectorAll<HTMLElement>("[data-mode]")
    .forEach((b) => (b.onclick = () => load(b.dataset.mode as MapMode)));
  document.querySelectorAll<HTMLElement>("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        s.tab = b.dataset.tab as Tab;
        s.refresh();
      }),
  );
  id("leash").onchange = (e) => {
    s.leash = (e.target as HTMLInputElement).checked;
    s.draw();
  };
  id("btnGenSeed").onclick = () => load("survival");
  id("btnRndSeed").onclick = () => {
    seed.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    load("survival");
  };
  load("adventure");
}
boot().catch((e) => {
  id("validation").hidden = false;
  id("validation").textContent = "Failed to load the control table  ·  " + e.message;
  id("diskState").textContent = "Connection failed";
});
