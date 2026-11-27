import {
  type GameEvent,
  type RunState,
  type Systems,
  particleBudget,
  toVfxEvent,
} from "@/core";
import { TILE } from "@/systems";
import { syncRunLight } from "@/systems/world/runLight";
import { createEffects } from "@/vfx/particles";
import type Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import type { TextureGenerator } from "../textures/registerTextures";
import { CampFires, type Effects } from "./CampFires";
import { NightOverlay } from "./NightOverlay";
import { SnowClockArt } from "./SnowClockArt";
import { WorldView } from "./WorldView";

/** vfx biome index for snow: drives the falling-flake ambience. -1 means no ambience. */
const SNOW_BIOME = 4;

export function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** The living backdrop shared by the title and game scenes: world art, fires, snow and night tint. */
export class Scenery {
  readonly fx: Effects;
  readonly overlay: NightOverlay;
  private readonly view: WorldView;
  private readonly fires: CampFires;
  private readonly snowClock: SnowClockArt | null;

  constructor(
    scene: Phaser.Scene,
    private readonly sys: Systems,
    gen: TextureGenerator,
    state: RunState,
    showSnowClock = false,
  ) {
    const { world, data } = sys;
    const reduced = prefersReducedMotion();
    this.view = new WorldView(scene, sys, gen);
    // ambientAt is optional in the plain-JS adapter but missing from its inferred option type.
    const options = {
      maxParticles: particleBudget(data, reduced),
      reducedMotion: reduced,
      textureGenerator: gen,
      tileSize: data.tileSize,
      bodyDepth: RENDER_DEPTH.combatParticles,
      glowDepth: RENDER_DEPTH.combatGlow,
      lightStrength: (): number => 0, // NightOverlay and the atmosphere layer paint the authoritative grid.
      ambientAt: (tx: number, ty: number) => {
        const tile = world.tiles[ty * world.widthTiles + tx];
        return tx >= 0 &&
          ty >= 0 &&
          tx < world.widthTiles &&
          (tile === TILE.snow || tile === TILE.path)
          ? SNOW_BIOME
          : -1;
      },
    } as Parameters<typeof createEffects>[1];
    this.fx = createEffects(scene, options);
    this.fires = new CampFires(this.fx, sys, state);
    this.overlay = new NightOverlay(scene, scene.cameras.main);
    this.snowClock = showSnowClock
      ? new SnowClockArt(scene, world, data.balance.clock)
      : null;
  }

  update(state: RunState, sec: number, darkness: number): void {
    this.overlay.darkness = darkness;
    this.overlay.grid = syncRunLight(state, this.sys);
    this.view.sync(state);
    this.snowClock?.sync(state.elapsedSec);
    this.fires.sync(state);
    this.fx.update(sec);
  }

  /** Forwards gather, hit and camp events to the vfx adapter. */
  emit(events: readonly GameEvent[]): void {
    for (const event of events) {
      const vfx = toVfxEvent(event);
      if (vfx) this.fx.emit(vfx);
    }
  }

  destroy(): void {
    this.snowClock?.destroy();
    this.overlay.destroy();
    this.fx.destroy();
  }
}
