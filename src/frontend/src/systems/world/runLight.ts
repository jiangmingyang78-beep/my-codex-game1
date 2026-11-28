import type { RunState, Systems } from "@/core/types";
import { forEachFireSource } from "../campCircle";
import { heroLightRadiusMultiplier } from "../itemEffects";
import { fieldTorchRadius } from "../survival/weatherSystem";
import { darknessAt } from "./darkness";
import { LightGrid, type LightSource } from "./lightGrid";

import { obstacleRevision, opaqueAt } from "./collision";
class LightSources {
  readonly current: LightSource[] = [];
  private readonly slots: LightSource[] = [];
  readonly add = (x: number, y: number, radius: number, id: string) => {
    const i = this.current.length;
    if (!this.slots[i]) this.slots[i] = { id, x, y, radius };
    const slot = this.slots[i];
    slot.id = id;
    slot.x = x;
    slot.y = y;
    slot.radius = radius;
    this.current.push(slot);
  };
}
const lists = new WeakMap<RunState, LightSources>();
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
  let list = lists.get(state);
  if (!list) {
    list = new LightSources();
    lists.set(state, list);
  }
  const sources = list.current;
  sources.length = 0;
  forEachFireSource(state, sys, list.add);
  const fraction = Math.max(
    0,
    state.hero.light / sys.data.balance.stats.light.max,
  );
  list.add(
    (Math.floor(state.hero.x / sys.data.tileSize) + 0.5) * sys.data.tileSize,
    (Math.floor(state.hero.y / sys.data.tileSize) + 0.5) * sys.data.tileSize,
    Math.round(
      fieldTorchRadius(state) *
        sys.data.tileSize *
        2.75 *
        Math.sqrt(fraction) *
        heroLightRadiusMultiplier(sys.data, state.inventory, state.heroId),
    ),
    "held-torch",
  );
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
