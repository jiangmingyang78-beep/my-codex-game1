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
    normalized[id] = Object.fromEntries(
      Object.entries(campProjects[id].cost).map(([item, needed]) => {
        const count = materials[item];
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

export function campProjectContribution(
  progress: Contributions,
  id: CampProjectId,
  stock: Stock,
): Stock {
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
