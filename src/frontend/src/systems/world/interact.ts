import { EVT, makeEvent } from "@/core/events";
import { reasonMessage } from "@/core/messages";
import type { ActionResult, GameEvent, RunState, Systems } from "@/core/types";
import { addItem, canAdd, countOf, removeItems } from "../inventory";
import { BEACON_SEAL_IDS, countBeaconSeals } from "./beacon";
import { materialFor } from "./materials";
import { detonateResinBarrel } from "./regionEffects";
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
    if (o.kind === "explosive_barrel" && state.changesByObjectId[o.id]?.opened)
      continue;
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

function igniteBeacon(
  state: RunState,
  sys: Systems,
  o: WorldObject,
): ActionResult {
  if (state.status !== "playing" || state.changesByObjectId[o.id]?.lit)
    return refused(o, EVT.interactRefused, "already_lit");
  const range = sys.data.balance.hero.interactRangeTiles * sys.data.tileSize;
  if (Math.hypot(o.x - state.hero.x, o.y - state.hero.y) > range)
    return refused(o, EVT.interactRefused, "nothing_nearby");
  if (countBeaconSeals(state) < BEACON_SEAL_IDS.length)
    return refused(o, EVT.interactRefused, "missing_seal");

  state.changesByObjectId[o.id] = {
    ...state.changesByObjectId[o.id],
    lit: true,
  };
  state.status = "won";
  return {
    ok: true,
    events: [
      makeEvent(EVT.campLit, o.x, o.y, { objectId: o.id, count: 12 }),
      makeEvent(EVT.runEnded, o.x, o.y, {
        status: state.status,
        runId: state.runId,
        day: state.day,
        elapsedSec: state.elapsedSec,
      }),
    ],
  };
}

function inspectStoryProp(
  state: RunState,
  sys: Systems,
  o: WorldObject,
): ActionResult {
  const events: GameEvent[] = [];
  if (o.storyToast) {
    events.push(
      makeEvent(EVT.notice, o.x, o.y, {
        objectId: o.id,
        message: o.storyToast,
        unlockNoteId: o.unlockNoteId,
      }),
    );
  }
  if (o.itemId && o.pickupId && !state.collectedPickups.includes(o.pickupId)) {
    const count = o.yield ?? 1;
    if (canAdd(sys.data, state.inventory, o.itemId, count)) {
      addItem(sys.data, state.inventory, o.itemId, count);
      state.collectedPickups.push(o.pickupId);
      events.push(
        makeEvent(EVT.itemPicked, o.x, o.y, {
          itemId: o.itemId,
          count,
          pickupId: o.pickupId,
        }),
      );
    } else {
      events.push(
        makeEvent(EVT.pickupRefused, o.x, o.y, {
          itemId: o.itemId,
          reason: "inventory_full",
        }),
      );
    }
  }
  return { ok: true, events };
}

function igniteMirrorLamp(state: RunState, o: WorldObject): ActionResult {
  if (state.changesByObjectId[o.id]?.lit)
    return refused(o, EVT.interactRefused, "already_lit");
  state.changesByObjectId[o.id] = {
    ...state.changesByObjectId[o.id],
    lit: true,
  };
  return {
    ok: true,
    events: [
      makeEvent(EVT.campLit, o.x, o.y, { objectId: o.id, count: 6 }),
      makeEvent(EVT.notice, o.x, o.y, {
        objectId: o.id,
        message: "折镜铜灯亮起，暗室里折射出一圈稳定微光。",
      }),
    ],
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
    case "beacon":
      return igniteBeacon(state, sys, o);
    case "story_prop":
      return inspectStoryProp(state, sys, o);
    case "explosive_barrel": {
      const events: GameEvent[] = [];
      detonateResinBarrel(state, sys, o.id, events);
      return { ok: events.length > 0, events };
    }
    case "mirror_lamp":
      return igniteMirrorLamp(state, o);
    default:
      return {
        ok: true,
        events: [makeEvent(EVT.openCraft, o.x, o.y, { stationId: o.id })],
      };
  }
}
