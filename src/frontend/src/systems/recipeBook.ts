import { EVT, makeEvent } from "@/core/events";
import type { GameEvent, RunState, Systems } from "@/core/types";

export function readRecipeIds(value: unknown, sys: Systems): Set<string> {
  const ids = value instanceof Set || Array.isArray(value) ? [...value] : [];
  return new Set(
    ids.filter((id) => typeof id === "string" && sys.data.recipes.has(id)),
  );
}

/** Camp upgrades are durable milestones, including after later upgrades. */
export function discoverRecipes(
  state: RunState,
  sys: Systems,
  events?: GameEvent[],
) {
  const names: string[] = [];
  for (const recipe of sys.data.recipeList) {
    if (state.unlockedRecipeIds.has(recipe.id)) continue;
    const starter =
      recipe.starterUnlocked ??
      (!recipe.unlockOnPickup && !recipe.unlockOnCampProject);
    const eligible =
      starter ||
      recipe.unlockOnPickup?.some((id) => state.inventory[id] > 0) ||
      recipe.unlockOnCampProject?.some((id) => {
        const out = sys.data.recipes.get(id)?.output;
        return out?.type === "camp_level"
          ? state.campLevel >= out.level
          : state.changesByObjectId[id]?.lit;
      });
    if (!eligible) continue;
    state.unlockedRecipeIds.add(recipe.id);
    if (events) {
      names.push(recipe.name);
      state.unreadRecipeIds.add(recipe.id);
    }
  }
  if (!events || !names.length) return;
  let notice = events.find(
    (e) => e.type === EVT.notice && Array.isArray(e.payload.recipeNames),
  );
  if (!notice) {
    notice = makeEvent(EVT.notice, state.hero.x, state.hero.y, {
      recipeNames: [],
    });
    events.push(notice);
  }
  const batch = notice.payload.recipeNames as string[];
  batch.push(...names);
  notice.payload.message = `解锁新配方：${batch[0]}${batch.length > 1 ? ` 等 ${batch.length} 项` : ""}`;
}
