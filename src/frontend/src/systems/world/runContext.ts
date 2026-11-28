import type { RunState, Systems } from "@/core/types";
import { obstacleRevision, opaqueAt, solidAt } from "./collision";
import { runTerrain } from "./runElements";
import { syncRunLight } from "./runLight";
import { type IWorldContext, WorldContext } from "./worldContext";
const cache = new WeakMap<RunState, IWorldContext>();
export function runContext(state: RunState, sys: Systems) {
  let ctx = cache.get(state);
  if (!ctx) {
    ctx = new WorldContext({
      get tuning() {
        return sys.data.balance.survival;
      },
      tileSize: sys.world.tileSize,
      light: syncRunLight(state, sys),
      get terrain() {
        return runTerrain(state, sys);
      },
      get elements() {
        return state.elements;
      },
      solid: (x, y) => solidAt(sys.world, state.changesByObjectId, x, y),
      opaque: (x, y) => opaqueAt(sys.world, state.changesByObjectId, x, y),
    });
    cache.set(state, ctx);
  }
  ctx.prepare(state.hero, obstacleRevision(state));
  return ctx;
}
