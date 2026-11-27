import type { RunState, Systems } from "@/core/types";
import { forEachFireSource } from "../campCircle";
import { heroLightRadiusMultiplier } from "../itemEffects";
import { fieldTorchRadius } from "../survival/weatherSystem";
import { darknessAt } from "./darkness";
import { LightGrid, type LightSource } from "./lightGrid";

import { obstacleRevision, opaqueAt } from "./collision";
const grids = new WeakMap<RunState, LightGrid>();
const burning = new WeakMap<
  RunState,
  Map<string, LightSource & { until: number }>
>();
export function ignite(state: RunState, source: LightSource, seconds: number) {
  const fires = burning.get(state) ?? new Map();
  fires.set(source.id, { ...source, until: state.elapsedSec + seconds });
  burning.set(state, fires);
}
export function syncRunLight(state: RunState, sys: Systems) {
  let grid = grids.get(state);
  if (!grid) {
    grid = new LightGrid(sys.data.tileSize, (x, y) =>
      opaqueAt(sys.world, state.changesByObjectId, x, y),
    );
    grids.set(state, grid);
  }
  grid.invalidate(obstacleRevision(state));
  const sources: LightSource[] = [];
  forEachFireSource(state, sys, (x, y, radius, id) =>
    sources.push({ id, x, y, radius }),
  );
  const fraction = Math.max(
    0,
    state.hero.light / sys.data.balance.stats.light.max,
  );
  sources.push({
    id: "held-torch",
    x: (Math.floor(state.hero.x / sys.data.tileSize) + 0.5) * sys.data.tileSize,
    y: (Math.floor(state.hero.y / sys.data.tileSize) + 0.5) * sys.data.tileSize,
    radius: Math.round(
      fieldTorchRadius(state) *
        sys.data.tileSize *
        2.75 *
        Math.sqrt(fraction) *
        heroLightRadiusMultiplier(sys.data, state.inventory, state.heroId),
    ),
  });
  grid.syncElements(state.elements);
  const fires = burning.get(state);
  if (fires)
    for (const [id, fire] of fires) {
      if (fire.until <= state.elapsedSec) fires.delete(id);
      else sources.push(fire);
    }
  grid.sync(
    Math.floor(15 * (1 - darknessAt(state.elapsedSec, sys.data.balance.clock))),
    sources,
  );
  return grid;
}
