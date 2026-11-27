import { index, keys, reference } from "./dataReferences";
import type { dataFiles } from "./gameData";
import { invalid } from "./schemaChecks";
type Condition =
  | { anyOf: Condition[] }
  | {
      event: string;
      enemyId?: string;
      pickupId?: string;
      itemId?: string;
      plantId?: string;
    };

type Registry = { has(id: string): boolean };
type SurvivalFiles = Pick<
  typeof dataFiles,
  | "weather"
  | "plants"
  | "survivalCampProjects"
  | "survivalCatalog"
  | "survivalRecipes"
  | "survivalRhythm"
  | "metaUnlocks"
>;
export function validateSurvivalReferences(
  files: SurvivalFiles,
  items: Registry,
  enemies: Registry,
  plants: Registry,
  weather: Registry,
  pickups: Registry,
) {
  reference(
    weather,
    files.weather.defaultWeatherId,
    "weather.json.defaultWeatherId",
  );
  files.weather.weathers.forEach((w, i) => {
    const p = `weather.json.weathers[${i}]`;
    keys(weather, w.transitions, `${p}.transitions`);
    if (w.durationSec[1] < w.durationSec[0])
      invalid(`${p}.durationSec[1]`, "maximum below minimum");
  });
  keys(items, files.plants.fertilizers, "plants.json.fertilizers");
  index(
    files.plants.plants,
    (p) => p.seedItemId,
    "plants.json.plants",
    "seedItemId",
  );
  files.plants.plants.forEach((plant, i) => {
    const p = `plants.json.plants[${i}]`;
    reference(items, plant.seedItemId, `${p}.seedItemId`);
    if (plant.preferredWeather)
      reference(weather, plant.preferredWeather, `${p}.preferredWeather`);
    if (plant.harvestMode === "fell" && !plant.stumpHp)
      invalid(`${p}.stumpHp`, "required for fell");
    for (const table of ["drops", "stumpDrops", "digDrops"] as const)
      plant[table]?.forEach((drop, j) => {
        const path = `${p}.${table}[${j}]`;
        reference(items, drop.itemId, `${path}.itemId`);
        if (drop.max < drop.min)
          invalid(`${path}.max`, "maximum below minimum");
      });
  });
  const stock = new Set<string>();
  const builds = new Set<string>();
  const technologies = new Set<string>();
  const contentIds = new Set<string>();
  const contentKeys = new Set<string>();
  for (const [section, rows] of Object.entries(files.survivalCatalog))
    rows.forEach(([id, group, key], i) => {
      const path = `survivalCatalog.json.${section}[${i}]`;
      if (!/^[a-z]+-(?!0000)\d{4}$/.test(id) || contentIds.has(id))
        invalid(`${path}[0]`, "invalid or duplicate content id");
      if (contentKeys.has(`${group}:${key}`))
        invalid(`${path}[2]`, "duplicate content key");
      contentIds.add(id);
      contentKeys.add(`${group}:${key}`);
      if (group === "tech") technologies.add(key);
      if (group === "stock") stock.add(key);
      if (group === "build") builds.add(key);
    });
  const { raid } = files.survivalRhythm;
  if (
    !(
      raid.urgentSec < raid.nearSec &&
      raid.nearSec < raid.warningMinSec &&
      raid.warningMinSec <= raid.warningMaxSec
    )
  )
    invalid("survivalRhythm.json.raid", "invalid warning stages");
  if (raid.jitterDays >= raid.intervalDays)
    invalid(
      "survivalRhythm.json.raid.jitterDays",
      "must be less than intervalDays",
    );
  const projectIds = new Set(Object.keys(files.survivalCampProjects.projects));
  keys(
    stock,
    files.survivalCampProjects.hearth.fuelValues,
    "survivalCampProjects.json.hearth.fuelValues",
  );
  for (const id of ["wellhead", "restCorner", "feedingTrough"]) {
    if (!Object.hasOwn(files.survivalCampProjects.projects, id))
      invalid(
        `survivalCampProjects.json.projects.${id}`,
        "missing camp project",
      );
  }
  for (const [id, project] of Object.entries(
    files.survivalCampProjects.projects,
  )) {
    const path = `survivalCampProjects.json.projects.${id}`;
    keys(stock, project.cost, `${path}.cost`);
    if ("legacyCredit" in project) {
      const materials = new Set(Object.keys(project.cost));
      keys(materials, project.legacyCredit, `${path}.legacyCredit`);
      for (const [item, legacyItem] of Object.entries(project.legacyCredit)) {
        reference(stock, legacyItem, `${path}.legacyCredit.${item}`);
        if (materials.has(legacyItem))
          invalid(
            `${path}.legacyCredit.${item}`,
            "expected a retired material",
          );
      }
    }
    if ("requires" in project)
      for (const parent of project.requires) {
        reference(projectIds, parent, `${path}.requires`);
        const def =
          files.survivalCampProjects.projects[
            parent as keyof typeof files.survivalCampProjects.projects
          ];
        if (!("tier" in def) || def.tier >= project.tier)
          invalid(`${path}.requires`, "expected an earlier tier");
      }
  }
  const unlocks = index(files.metaUnlocks, (r) => r.id, "metaUnlocks.json");
  const survivalRecipes = new Set(Object.keys(files.survivalRecipes));
  for (const [id, recipe] of Object.entries(files.survivalRecipes)) {
    const path = `survivalRecipes.json.${id}`;
    reference(stock, id, path);
    keys(stock, recipe.cost, `${path}.cost`);
    if ("tech" in recipe) reference(technologies, recipe.tech, `${path}.tech`);
    if ("project" in recipe)
      reference(projectIds, recipe.project, `${path}.project`);
    if ("metaUnlock" in recipe)
      reference(unlocks, recipe.metaUnlock, `${path}.metaUnlock`);
  }
  function checkCondition(c: Condition, p: string) {
    if ("anyOf" in c) {
      c.anyOf.forEach((v, i) => checkCondition(v, `${p}.anyOf[${i}]`));
      return;
    }
    if (c.enemyId) reference(enemies, c.enemyId, `${p}.enemyId`);
    if (c.itemId) reference(items, c.itemId, `${p}.itemId`);
    if (c.plantId) reference(plants, c.plantId, `${p}.plantId`);
    if (c.pickupId) reference(pickups, c.pickupId, `${p}.pickupId`);
  }
  files.metaUnlocks.forEach((u, i) => {
    reference(
      u.targetType === "plan" ? builds : survivalRecipes,
      u.targetKey,
      `metaUnlocks.json[${i}].targetKey`,
    );
    checkCondition(
      u.condition as Condition,
      `metaUnlocks.json[${i}].condition`,
    );
  });
}
