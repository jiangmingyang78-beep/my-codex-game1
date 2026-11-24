import {
  type RecipeDef,
  type RunState,
  type Systems,
  itemName,
  reasonMessage,
} from "@/core";
import {
  countOf,
  freeSpace,
  recipeShortfall,
  unlitRelaySlots,
} from "@/systems";
import type { CraftView, RecipeCategory, RecipeRow } from "../ui/store";

function maxCampLevel(sys: Systems): number {
  return Math.max(
    ...Object.keys(sys.data.balance.camp.radiiTilesByLevel).map(Number),
  );
}

/** Why a recipe cannot be crafted regardless of materials, or null. Mirrors craft()'s gates for display only. */
function blockedReason(
  state: RunState,
  sys: Systems,
  recipe: RecipeDef,
): string | null {
  if (state.campLevel < recipe.minCampLevel) {
    return reasonMessage("camp_level_too_low", { need: recipe.minCampLevel });
  }
  const exact = recipe.constraints?.exactCampLevel;
  if (exact !== undefined && state.campLevel !== exact) {
    return reasonMessage(
      state.campLevel > exact ? "already_upgraded" : "camp_level_too_low",
      {
        need: recipe.minCampLevel,
      },
    );
  }
  const out = recipe.output;
  if (out.type === "camp_level") {
    return out.level > maxCampLevel(sys)
      ? reasonMessage("camp_level_max")
      : null;
  }
  if (
    recipe.constraints?.uniqueOutput &&
    countOf(state.inventory, out.id) > 0
  ) {
    return reasonMessage("already_owned");
  }
  if (recipe.constraints?.inventoryCapSource === "unlit_relay_socket_count") {
    if (
      unlitRelaySlots(state, sys) - countOf(state.inventory, out.id) <
      out.count
    ) {
      return reasonMessage("no_free_relay_slot");
    }
  }
  const spent = recipe.inputs[out.id] ?? 0;
  if (freeSpace(sys.data, state.inventory, out.id) + spent < out.count) {
    return reasonMessage("inventory_full");
  }
  return null;
}

function categoryFor(sys: Systems, recipe: RecipeDef): RecipeCategory {
  if (recipe.output.type !== "item") return "camp";
  const itemType = sys.data.items.get(recipe.output.id)?.type;
  if (itemType === "equipment") return "equipment";
  if (
    itemType === "food" ||
    itemType === "medicine" ||
    itemType === "consumable"
  ) {
    return "supply";
  }
  return "camp";
}

function rowFor(state: RunState, sys: Systems, recipe: RecipeDef): RecipeRow {
  const out = recipe.output;
  const gaps = recipeShortfall(state, sys, recipe.id);
  const description =
    out.type === "item"
      ? (sys.data.items.get(out.id)?.description ?? "")
      : "扩大营火的火圈，解锁更高等级的配方。";
  return {
    id: recipe.id,
    name: recipe.name,
    description,
    category: categoryFor(sys, recipe),
    materials: Object.entries(recipe.inputs).map(([itemId, need]) => ({
      itemId,
      name: itemName(sys.data, itemId),
      need,
      have: countOf(state.inventory, itemId),
    })),
    levelChange:
      out.type === "camp_level"
        ? `营火 Lv.${state.campLevel} → Lv.${out.level}`
        : null,
    minCampLevel: recipe.minCampLevel,
    blockedReason: blockedReason(state, sys, recipe),
    shortfallText:
      gaps.length > 0
        ? `还缺 ${gaps.map((g) => `${itemName(sys.data, g.itemId)} ×${g.missing}`).join("、")}`
        : null,
  };
}

/** Read-only recipe list for the camp panel, rebuilt after every craft. */
export function buildCraftView(state: RunState, sys: Systems): CraftView {
  const rows = sys.data.recipeList
    .map((recipe, index) => ({ recipe, index }))
    .sort(
      (a, b) =>
        a.recipe.minCampLevel - b.recipe.minCampLevel || a.index - b.index,
    )
    .map(({ recipe }) => rowFor(state, sys, recipe));
  return {
    campLevel: state.campLevel,
    maxCampLevel: maxCampLevel(sys),
    rows,
    relayKits: countOf(state.inventory, "relay_kit"),
    unlitRelays: unlitRelaySlots(state, sys),
  };
}
