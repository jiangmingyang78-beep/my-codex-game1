import { EVT, makeEvent } from "@/core/events";
import { reasonMessage } from "@/core/messages";
import type { ActionResult, GameEvent, RunState, Systems } from "@/core/types";
import { addItem, countOf, freeSpace, removeItems } from "./inventory";

export interface Shortfall {
  itemId: string;
  need: number;
  have: number;
  missing: number;
}

/** Per-material gaps for a recipe; empty when every input is available. */
export function recipeShortfall(
  state: RunState,
  sys: Systems,
  recipeId: string,
): Shortfall[] {
  const recipe = sys.data.recipes.get(recipeId);
  if (!recipe) return [];
  const gaps: Shortfall[] = [];
  for (const itemId in recipe.inputs) {
    const need = recipe.inputs[itemId];
    const have = countOf(state.inventory, itemId);
    if (have < need) gaps.push({ itemId, need, have, missing: need - have });
  }
  return gaps;
}

/** Number of relay sockets on the map that are not lit yet. */
export function unlitRelaySlots(state: RunState, sys: Systems): number {
  let n = 0;
  for (const id of sys.data.relaySocketIds) {
    if (sys.world.objects.has(id) && !state.changesByObjectId[id]?.lit) n++;
  }
  return n;
}

function refuse(
  state: RunState,
  recipeId: string,
  reason: string,
  detail?: Record<string, unknown>,
): ActionResult {
  const { hero } = state;
  return {
    ok: false,
    reason,
    detail,
    events: [
      makeEvent(EVT.craftRefused, hero.x, hero.y, {
        recipeId,
        reason,
        message: reasonMessage(reason, detail),
        ...detail,
      }),
    ],
  };
}

/**
 * Crafts a recipe at the main campfire. All checks run first; inputs are consumed and the
 * output granted (or camp level raised by one step) in a single write.
 */
export function craft(
  state: RunState,
  sys: Systems,
  recipeId: string,
): ActionResult {
  const { data, world } = sys;
  const recipe = data.recipes.get(recipeId);
  if (!recipe) return refuse(state, recipeId, "unknown_recipe");
  const reach = data.balance.hero.interactRangeTiles * data.tileSize * 2;
  if (
    Math.hypot(
      state.hero.x - world.campfire.x,
      state.hero.y - world.campfire.y,
    ) > reach
  ) {
    return refuse(state, recipeId, "station_too_far");
  }
  if (state.campLevel < recipe.minCampLevel) {
    return refuse(state, recipeId, "camp_level_too_low", {
      need: recipe.minCampLevel,
    });
  }
  const exact = recipe.constraints?.exactCampLevel;
  if (exact !== undefined && state.campLevel !== exact) {
    return refuse(
      state,
      recipeId,
      state.campLevel > exact ? "already_upgraded" : "camp_level_too_low",
    );
  }
  const out = recipe.output;
  if (out.type === "item") {
    if (
      recipe.constraints?.uniqueOutput &&
      countOf(state.inventory, out.id) > 0
    ) {
      return refuse(state, recipeId, "already_owned", { itemId: out.id });
    }
    if (recipe.constraints?.inventoryCapSource === "unlit_relay_socket_count") {
      const room =
        unlitRelaySlots(state, sys) - countOf(state.inventory, out.id);
      if (room < out.count)
        return refuse(state, recipeId, "no_free_relay_slot");
    }
  } else if (
    out.level >
    Math.max(...Object.keys(data.balance.camp.radiiTilesByLevel).map(Number))
  ) {
    return refuse(state, recipeId, "camp_level_max");
  }
  const gaps = recipeShortfall(state, sys, recipeId);
  if (gaps.length > 0)
    return refuse(state, recipeId, "missing_material", { shortfall: gaps });
  if (out.type === "item") {
    // Inputs are consumed before the grant, so an output that is also an input frees its own space.
    const spent = recipe.inputs[out.id] ?? 0;
    if (freeSpace(data, state.inventory, out.id) + spent < out.count) {
      return refuse(state, recipeId, "inventory_full", { itemId: out.id });
    }
  }

  removeItems(state.inventory, recipe.inputs);
  const { hero } = state;
  const events: GameEvent[] = [];
  if (out.type === "item") {
    addItem(data, state.inventory, out.id, out.count);
  } else {
    state.campLevel = out.level;
    events.push(
      makeEvent(EVT.campUpgraded, world.campfire.x, world.campfire.y, {
        level: out.level,
        radiusTiles: data.balance.camp.radiiTilesByLevel[String(out.level)],
      }),
    );
  }
  events.push(
    makeEvent(EVT.craftDone, hero.x, hero.y, { recipeId, output: out }),
  );
  return { ok: true, events };
}
