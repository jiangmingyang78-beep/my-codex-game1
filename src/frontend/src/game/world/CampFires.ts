import type { RunState, Systems } from "@/core";
import { campRadiusPx, fixtureRadius } from "@/systems/campCircle";
import type { createEffects } from "@/vfx/particles";
import { RENDER_DEPTH } from "../renderDepth";

export type Effects = ReturnType<typeof createEffects>;
type FireHandle = ReturnType<Effects["addCampfire"]>;

/** Keeps the vfx flame and light of the main campfire, relay braziers and mirror lamps in step with RunState. */
export class CampFires {
  private main: FireHandle | null = null;
  private mainRadius = -1;
  private readonly lights = new Map<
    string,
    { handle: FireHandle; lit: boolean }
  >();

  constructor(
    private readonly fx: Effects,
    private readonly sys: Systems,
    state: RunState,
  ) {
    const { world } = sys;
    for (const o of world.objectList) {
      if (
        o.kind !== "relay_socket" &&
        o.kind !== "mirror_lamp" &&
        o.kind !== "beacon"
      )
        continue;
      const lit = state.changesByObjectId[o.id]?.lit === true;
      const handle = fx.addCampfire(o.x, o.y + 5, {
        radius: fixtureRadius(o.kind, sys),
        depth: RENDER_DEPTH.campFlame,
        active: lit,
      });
      this.lights.set(o.id, { handle, lit });
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
        depth: RENDER_DEPTH.campFlame,
        scale: 1,
      });
      this.mainRadius = radius;
    }
    for (const [id, light] of this.lights) {
      const lit = state.changesByObjectId[id]?.lit === true;
      if (lit === light.lit) continue;
      light.lit = lit;
      light.handle.setActive(lit);
    }
  }
}
