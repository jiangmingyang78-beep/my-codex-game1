import { EVT, makeEvent } from "@/core/events";
import { reasonMessage } from "@/core/messages";
import type { ActionResult, GameEvent, RunState, Systems } from "@/core/types";
import { addItem, canAdd, countOf, removeItems } from "../inventory";
import { materialFor } from "./materials";
import type { WorldObject } from "./worldTypes";

/** Nearest interactable object within balance.hero.interactRangeTiles, or null. */
export function nearestInteractable(
  state: RunState,
  sys: Systems,
): WorldObject | null {
  const range = sys.data.balance.hero.interactRangeTiles * sys.data.tileSize;
  let best: WorldObject | null = null;
  let bestD = range;
  for (const o of sys.world.objectList) {
    if (o.kind === "node" && state.changesByObjectId[o.id]?.gathered) continue;
    const d = Math.hypot(o.x - state.hero.x, o.y - state.hero.y);
    if (d <= bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function refused(
  o: WorldObject,
  type: string,
  reason: string,
  detail?: Record<string, unknown>,
): ActionResult {
  return {
    ok: false,
    reason,
    detail,
    events: [
      makeEvent(type, o.x, o.y, {
        objectId: o.id,
        reason,
        message: reasonMessage(reason, detail),
        ...detail,
      }),
    ],
  };
}

function gather(state: RunState, sys: Systems, o: WorldObject): ActionResult {
  const change = state.changesByObjectId[o.id];
  if (change?.gathered)
    return refused(o, EVT.interactRefused, "already_gathered");
  const itemId = o.itemId ?? "";
  const count = o.yield ?? 1;
  if (!canAdd(sys.data, state.inventory, itemId, count)) {
    return refused(o, EVT.pickupRefused, "inventory_full", { itemId });
  }
  addItem(sys.data, state.inventory, itemId, count);
  state.changesByObjectId[o.id] = { ...change, gathered: true };
  const events: GameEvent[] = [
    makeEvent(EVT.collected, o.x, o.y, {
      objectId: o.id,
      itemId,
      count,
      material: materialFor(itemId),
      finished: true,
    }),
    makeEvent(EVT.itemPicked, o.x, o.y, { itemId, count }),
  ];
  return { ok: true, events };
}

function openGate(state: RunState, sys: Systems, o: WorldObject): ActionResult {
  const region = sys.data.regionList.find((r) => r.entry.gateId === o.id);
  if (!region) return refused(o, EVT.gateRefused, "nothing_nearby");
  if (state.changesByObjectId[o.id]?.opened)
    return { ok: true, reason: "already_open", events: [] };
  if (state.campLevel < region.entry.minCampLevel) {
    return refused(o, EVT.gateRefused, "camp_level_too_low", {
      need: region.entry.minCampLevel,
    });
  }
  if (!region.entry.requiredPickupIds.every((id) => state.seals.includes(id))) {
    return refused(o, EVT.gateRefused, "missing_seal");
  }
  state.changesByObjectId[o.id] = {
    ...state.changesByObjectId[o.id],
    opened: true,
  };
  return {
    ok: true,
    events: [
      makeEvent(EVT.gateOpened, o.x, o.y, {
        objectId: o.id,
        regionId: region.id,
      }),
    ],
  };
}

function igniteRelay(state: RunState, o: WorldObject): ActionResult {
  if (state.changesByObjectId[o.id]?.lit)
    return refused(o, EVT.interactRefused, "already_lit");
  if (countOf(state.inventory, "relay_kit") < 1)
    return refused(o, EVT.interactRefused, "no_relay_kit");
  removeItems(state.inventory, { relay_kit: 1 });
  state.changesByObjectId[o.id] = {
    ...state.changesByObjectId[o.id],
    lit: true,
  };
  return {
    ok: true,
    events: [makeEvent(EVT.campLit, o.x, o.y, { objectId: o.id, count: 6 })],
  };
}

/**
 * Interacts with a target id, or the nearest interactable when omitted.
 * Gathering, opening the gate (camp level gate with a text reason), lighting the relay
 * brazier permanently, or opening the campfire crafting panel (`ui.open_craft`).
 */
export function interact(
  state: RunState,
  sys: Systems,
  targetId?: string,
): ActionResult {
  const o = targetId
    ? (sys.world.objects.get(targetId) ?? null)
    : nearestInteractable(state, sys);
  if (!o) {
    const { hero } = state;
    return {
      ok: false,
      reason: "nothing_nearby",
      events: [
        makeEvent(EVT.interactRefused, hero.x, hero.y, {
          reason: "nothing_nearby",
          message: reasonMessage("nothing_nearby"),
        }),
      ],
    };
  }
  switch (o.kind) {
    case "node":
      return gather(state, sys, o);
    case "gate":
      return openGate(state, sys, o);
    case "relay_socket":
      return igniteRelay(state, o);
    default:
      return {
        ok: true,
        events: [makeEvent(EVT.openCraft, o.x, o.y, { stationId: o.id })],
      };
  }
}
