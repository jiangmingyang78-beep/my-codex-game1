import type { RunState, Systems } from "@/core/types";
import { isHeroDashActive } from "@/systems/movement";
import { supportsSnowFootprint } from "@/systems/world/worldTypes";
import Phaser from "phaser";
import { ATMOSPHERE_PRESETS } from "./atmospherePresets";

interface FootprintOptions {
  reducedMotion?: boolean;
  snowTileIds?: ReadonlySet<number>;
  depth?: number;
}

const { maxCount, stepDistancePx, holdSec, fadeSec, color, alpha, depth } =
  ATMOSPHERE_PRESETS.footprints;
const lifetime = holdSec + fadeSec;

export class SnowFootprintLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly footprints = Array.from({ length: maxCount }, () => ({
    x: 0,
    y: 0,
    bornAt: Number.NEGATIVE_INFINITY,
  }));
  private readonly snowTileIds?: ReadonlySet<number>;
  private readonly opacity: number;
  private world: Systems["world"] | null = null;
  private runId: string | null = null;
  private nowSec = 0;
  private writeIndex = 0;
  private previousX = 0;
  private previousY = 0;
  private stride = 0;
  private side = 3;
  private wasDashing = false;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options?: FootprintOptions,
  ) {
    this.graphics = scene.add.graphics().setDepth(options?.depth ?? depth);
    this.snowTileIds = options?.snowTileIds;
    this.opacity = options?.reducedMotion ? alpha / 2 : alpha;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  sync(state: RunState, sys: Systems, dtSec: number): void {
    if (this.destroyed) return;
    const { hero } = state;
    const { world } = sys;
    if (this.runId !== state.runId || this.world !== world) {
      this.clear();
      this.runId = state.runId;
      this.world = world;
      this.previousX = hero.x;
      this.previousY = hero.y;
    }
    this.nowSec += Math.max(0, dtSec);

    const dashing = isHeroDashActive(state);
    if (dashing || this.wasDashing) {
      this.stride = 0;
    } else {
      this.trackMovement(hero.x, hero.y, world);
    }
    this.wasDashing = dashing;
    this.previousX = hero.x;
    this.previousY = hero.y;

    this.graphics.clear();
    for (let i = 0; i < maxCount; i++) {
      const mark = this.footprints[(this.writeIndex + i) % maxCount];
      const age = this.nowSec - mark.bornAt;
      if (age >= lifetime) continue;
      const strength = Math.min(1, (lifetime - age) / fadeSec);
      this.graphics
        .fillStyle(color, this.opacity * strength)
        .fillRect(mark.x, mark.y, 3, 2);
    }
  }

  private trackMovement(x: number, y: number, world: Systems["world"]): void {
    const dx = x - this.previousX;
    const dy = y - this.previousY;
    const distance = Math.hypot(dx, dy);
    this.stride += distance;
    if (this.stride < stepDistancePx) return;
    this.stride %= stepDistancePx;
    if (!this.canMark(x, y, world)) return;

    const lateral = this.side / distance;
    const mark = this.footprints[this.writeIndex];
    mark.x = Math.round(x - dy * lateral) - 1;
    mark.y = Math.round(y + dx * lateral) - 1;
    mark.bornAt = this.nowSec;
    this.writeIndex = (this.writeIndex + 1) % maxCount;
    this.side = -this.side;
  }

  private canMark(x: number, y: number, world: Systems["world"]): boolean {
    const { tileSize, widthTiles, heightTiles, tiles } = world;
    const tx = Math.floor(x / tileSize);
    const ty = Math.floor(y / tileSize);
    if (world.getTileMeta)
      return supportsSnowFootprint(world.getTileMeta(tx, ty));
    if (!this.snowTileIds) return true;
    return (
      tx >= 0 &&
      tx < widthTiles &&
      ty >= 0 &&
      ty < heightTiles &&
      this.snowTileIds.has(tiles[ty * widthTiles + tx])
    );
  }

  clear(): void {
    if (this.destroyed) return;
    for (const mark of this.footprints) mark.bornAt = Number.NEGATIVE_INFINITY;
    this.graphics.clear();
    this.world = null;
    this.runId = null;
    this.nowSec = 0;
    this.writeIndex = 0;
    this.stride = 0;
    this.side = 3;
    this.wasDashing = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.graphics.destroy();
  }
}
