import type { RunState, Systems } from "@/core/types";
import { forEachFireSource } from "../campCircle";
import { heroLightRadiusMultiplier } from "../itemEffects";
import { darknessAt } from "./darkness";
import { LightGrid, type LightSource } from "./lightGrid";

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
    grid = new LightGrid(sys.data.tileSize);
    grids.set(state, grid);
  }
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
    x: state.hero.x,
    y: state.hero.y,
    radius:
      sys.data.tileSize *
      2.75 *
      Math.sqrt(fraction) *
      heroLightRadiusMultiplier(sys.data, state.inventory, state.heroId),
  });
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
