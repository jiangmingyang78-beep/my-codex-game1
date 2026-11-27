import { loadDataFiles } from "@/core/gameData";
const config = loadDataFiles().survivalCampProjects;

export const { projects: campProjects, ...campProjectEffects } = config;
export type CampProjectId = keyof typeof campProjects;
type Stock = Record<string, number>;
type Contributions = Partial<Record<CampProjectId, Stock>>;

export function normalizeCampProjects(saved: unknown): Contributions {
  if (!saved || typeof saved !== "object") return {};
  const progress = saved as Contributions;
  const normalized: Contributions = {};
  for (const id of Object.keys(campProjects) as CampProjectId[]) {
    const materials = progress[id];
    if (!materials || typeof materials !== "object") continue;
    const project = campProjects[id];
    const legacyCredit: Record<string, string> =
      "legacyCredit" in project ? project.legacyCredit : {};
    normalized[id] = Object.fromEntries(
      Object.entries(project.cost).map(([item, needed]) => {
        const legacyItem = legacyCredit[item];
        const count =
          materials[item] ?? (legacyItem ? materials[legacyItem] : 0);
        return [
          item,
          Number.isFinite(count)
            ? Math.max(0, Math.min(needed, Math.floor(count)))
            : 0,
        ];
      }),
    );
  }
  return normalized;
}

export function campProjectComplete(
  progress: Contributions,
  id: CampProjectId,
) {
  return Object.entries(campProjects[id].cost).every(
    ([item, needed]) => (progress[id]?.[item] ?? 0) >= needed,
  );
}

export function missingCampProjects(
  progress: Contributions,
  id: CampProjectId,
) {
  const project = campProjects[id];
  return "requires" in project
    ? (project.requires as CampProjectId[]).filter(
        (parent) => !campProjectComplete(progress, parent),
      )
    : [];
}

export function campTier(progress: Contributions) {
  let tier = 0;
  for (const key of Object.keys(progress) as CampProjectId[]) {
    const project = campProjects[key];
    if (project && "tier" in project && campProjectComplete(progress, key))
      tier = Math.max(tier, project.tier);
  }
  return tier;
}

export const hearth = campProjectEffects.hearth;

export function beaconGuardsAngle(angle: number) {
  const [dx, dy] = hearth.beaconOffsetTiles;
  return (
    Math.cos(angle - Math.atan2(dy, dx)) >
    Math.cos((hearth.guardHalfAngleDeg * Math.PI) / 180)
  );
}

export function fireDrainRate(
  wind: number,
  sheltered: boolean,
  multiplier: number,
) {
  const weather =
    wind > 1 && sheltered ? 1 + (wind - 1) * hearth.windPenaltyFraction : wind;
  return hearth.baseDrain * multiplier * weather;
}

export function feedHearth(
  state: { fuel: number; stock: Stock },
  item: keyof typeof hearth.fuelValues,
) {
  if (
    !Object.hasOwn(hearth.fuelValues, item) ||
    !(state.stock[item] > 0) ||
    state.fuel >= hearth.capacity
  )
    return false;
  state.stock[item]--;
  state.fuel = Math.min(hearth.capacity, state.fuel + hearth.fuelValues[item]);
  return true;
}

export function tickHearth(
  state: { fuel: number; stock: Stock; campProjects: Contributions },
  sec: number,
  wind: number,
  multiplier: number,
  night: boolean,
) {
  const drain = fireDrainRate(
    wind,
    campProjectComplete(state.campProjects, "windHearth"),
    multiplier,
  );
  state.fuel = Math.max(0, state.fuel - sec * drain);
  if (
    night &&
    state.fuel <= hearth.autoFeedThreshold &&
    campProjectComplete(state.campProjects, "stoker")
  ) {
    for (const item of Object.keys(
      hearth.fuelValues,
    ) as (keyof typeof hearth.fuelValues)[])
      if (feedHearth(state, item)) break;
  }
}

export function campProjectContribution(
  progress: Contributions,
  id: CampProjectId,
  stock: Stock,
): Stock {
  if (missingCampProjects(progress, id).length) return {};
  return Object.fromEntries(
    Object.entries(campProjects[id].cost)
      .map(
        ([item, needed]) =>
          [
            item,
            Math.min(needed - (progress[id]?.[item] ?? 0), stock[item] ?? 0),
          ] as const,
      )
      .filter(([, count]) => count > 0),
  );
}

export function donateCampMaterials(
  progress: Contributions,
  id: CampProjectId,
  stock: Stock,
) {
  const contribution = Object.entries(
    campProjectContribution(progress, id, stock),
  );
  if (!contribution.length) return false;
  progress[id] ??= {};
  const materials = progress[id];
  for (const [item, count] of contribution) {
    stock[item] -= count;
    materials[item] = (materials[item] ?? 0) + count;
  }
  return true;
}
