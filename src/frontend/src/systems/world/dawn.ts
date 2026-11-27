import type { RunState, Systems } from "@/core/types";
import { rules } from "../runtimeRules";
import { appearanceChanged } from "./worldTypes";
import type { WorldObject } from "./worldTypes";
type Node = WorldObject & {
  renewalLimit?: number;
  respawnCooldownSec?: number;
};
const key = (id: string) => `renewal-clock:${id}`;
const cooldown = (o: Node) =>
  o.respawnCooldownSec ?? rules.resources?.cooldownSec;
export function recordHarvest(state: RunState, o: Node) {
  if (cooldown(o) !== undefined)
    state.changesByObjectId[key(o.id)] = {
      renewals: Math.round(state.elapsedSec * 1000),
    };
}
function renew(state: RunState, sys: Systems, o: Node, dawn: boolean) {
  const c = state.changesByObjectId[o.id];
  if (
    !c?.gathered ||
    !(o.renewable || sys.data.worldObjects.renewableWoodNodeIds.includes(o.id))
  )
    return false;
  if (
    (c.renewals ?? 0) >=
    (o.renewalLimit ??
      rules.resources?.renewalLimit ??
      Number.POSITIVE_INFINITY)
  )
    return false;
  const sec = cooldown(o);
  if (sec === undefined) {
    if (!dawn) return false;
  } else {
    const clock = state.changesByObjectId[key(o.id)];
    if (!clock) {
      recordHarvest(state, o);
      return false;
    }
    if (state.elapsedSec - (clock.renewals ?? 0) / 1000 < sec) return false;
    delete state.changesByObjectId[key(o.id)];
  }
  appearanceChanged(state);
  state.changesByObjectId[o.id] = {
    ...c,
    gathered: false,
    renewals: (c.renewals ?? 0) + 1,
  };
  return true;
}
const timedNodes = new WeakMap<
  Systems["world"],
  { global: boolean; nodes: WorldObject[] }
>();
export function renewTimed(state: RunState, sys: Systems) {
  const global = rules.resources?.cooldownSec !== undefined;
  let cached = timedNodes.get(sys.world);
  if (!cached || cached.global !== global) {
    const nodes = sys.world.objectList.filter(
      (o) => o.kind === "node" && cooldown(o) !== undefined,
    );
    cached = { global, nodes };
    timedNodes.set(sys.world, cached);
  }
  for (const o of cached.nodes) renew(state, sys, o, false);
}
export function renewAtDawn(state: RunState, sys: Systems) {
  let count = 0;
  for (const o of sys.world.objectList)
    if (o.kind === "node" && renew(state, sys, o, true)) count++;
  return count;
}
