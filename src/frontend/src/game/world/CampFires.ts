import type { RunState, Systems } from "@/core";
import { campRadiusPx } from "@/systems";
import type { createEffects } from "@/vfx/particles";

export type Effects = ReturnType<typeof createEffects>;
type FireHandle = ReturnType<Effects["addCampfire"]>;

/** Keeps the vfx flame and light of the main campfire and relay braziers in step with RunState. */
export class CampFires {
  private main: FireHandle | null = null;
  private mainRadius = -1;
  private readonly relays = new Map<
    string,
    { handle: FireHandle; lit: boolean }
  >();

  constructor(
    private readonly fx: Effects,
    private readonly sys: Systems,
    state: RunState,
  ) {
    const { world, data } = sys;
    const radius = data.balance.camp.relayRadiusTiles * data.tileSize;
    for (const id of data.relaySocketIds) {
      const o = world.objects.get(id);
      if (!o) continue;
      const lit = state.changesByObjectId[id]?.lit === true;
      const handle = fx.addCampfire(o.x, o.y + 5, {
        radius,
        depth: o.y + 1,
        active: lit,
      });
      this.relays.set(id, { handle, lit });
    }
    this.sync(state);
  }

  sync(state: RunState): void {
    const radius = campRadiusPx(state, this.sys);
    if (radius !== this.mainRadius) {
      this.main?.destroy();
      const { x, y } = this.sys.world.campfire;
      this.main = this.fx.addCampfire(x, y + 2, {
        radius,
        depth: y + 1,
        scale: 1,
      });
      this.mainRadius = radius;
    }
    for (const [id, relay] of this.relays) {
      const lit = state.changesByObjectId[id]?.lit === true;
      if (lit === relay.lit) continue;
      relay.lit = lit;
      relay.handle.setActive(lit);
    }
  }
}
