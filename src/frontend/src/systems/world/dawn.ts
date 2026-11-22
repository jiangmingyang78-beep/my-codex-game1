import type { RunState, Systems } from "@/core/types";

/**
 * Dawn renewal: berries, frostcap and the entrance twigs grow back. Persisted as
 * gathered=false plus a renewals counter so the saved state shows what has renewed.
 */
export function renewAtDawn(state: RunState, sys: Systems): number {
  let renewed = 0;
  for (const o of sys.world.objectList) {
    if (o.kind !== "node") continue;
    const renewable =
      o.renewable || sys.data.worldObjects.renewableWoodNodeIds.includes(o.id);
    const change = state.changesByObjectId[o.id];
    if (!renewable || !change?.gathered) continue;
    state.changesByObjectId[o.id] = {
      ...change,
      gathered: false,
      renewals: (change.renewals ?? 0) + 1,
    };
    renewed++;
  }
  return renewed;
}
