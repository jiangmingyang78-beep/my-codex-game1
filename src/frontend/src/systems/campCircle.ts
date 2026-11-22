import type { RunState, Systems } from "@/core/types";

/** Radius in pixels of the main campfire circle for the current camp level. */
export function campRadiusPx(state: RunState, sys: Systems): number {
  const tiles =
    sys.data.balance.camp.radiiTilesByLevel[String(state.campLevel)] ?? 0;
  return tiles * sys.data.tileSize;
}

/** Fire circle test: main campfire (radius by level) plus every permanently lit relay brazier. */
export function inFireCircle(
  state: RunState,
  sys: Systems,
  x: number,
  y: number,
): boolean {
  const { world, data } = sys;
  const camp = world.campfire;
  const r = campRadiusPx(state, sys);
  if (Math.hypot(x - camp.x, y - camp.y) <= r) return true;
  const relayR = data.balance.camp.relayRadiusTiles * data.tileSize;
  for (const id of data.relaySocketIds) {
    if (!state.changesByObjectId[id]?.lit) continue;
    const socket = world.objects.get(id);
    if (socket && Math.hypot(x - socket.x, y - socket.y) <= relayR) return true;
  }
  return false;
}

/** Visits every active fire source {x, y, radiusPx}; used by the scene light mask. */
export function forEachFireSource(
  state: RunState,
  sys: Systems,
  visit: (x: number, y: number, radiusPx: number, id: string) => void,
): void {
  const { world, data } = sys;
  visit(
    world.campfire.x,
    world.campfire.y,
    campRadiusPx(state, sys),
    data.worldObjects.mainCampfireId,
  );
  for (const id of data.relaySocketIds) {
    const socket = world.objects.get(id);
    if (socket && state.changesByObjectId[id]?.lit) {
      visit(
        socket.x,
        socket.y,
        data.balance.camp.relayRadiusTiles * data.tileSize,
        id,
      );
    }
  }
}
