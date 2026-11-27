import type { LightGrid } from "@/systems/world/lightGrid";
import { registerCanvasTexture } from "@/vfx/proceduralTextures";
import type Phaser from "phaser";
import { ATMOSPHERE_PRESETS } from "../atmosphere/atmospherePresets";
import { eraseLitPixels } from "../atmosphere/pixelLightMask";
import { RENDER_DEPTH } from "../renderDepth";

const KEY = "emberwood-night-overlay";
const { duskColor, nightColor, maxNightAlpha } = ATMOSPHERE_PRESETS.nightTint;
const mix = (a: number, b: number, t: number): number =>
  Math.round(a + (b - a) * t);

/**
 * Dusk/night tint drawn on one view-sized canvas: fill with the ambient colour, then erase
 * stepped light bands at camp lights and around the hero. Painted on the camera's prerender event so
 * it never lags a frame behind camera follow.
 */
export class NightOverlay {
  darkness = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastRevision = -1;
  private lastTint = -1;
  private lastGrid?: LightGrid;

  grid?: LightGrid;
  private readonly canvas = document.createElement("canvas");

  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly webgl: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
  ) {
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.texture = registerCanvasTexture(scene, KEY, { canvas: this.canvas })
      .texture as Phaser.Textures.CanvasTexture;
    this.image = scene.add
      .image(0, 0, KEY)
      .setOrigin(0)
      .setDepth(RENDER_DEPTH.night)
      .setVisible(false);
    this.webgl =
      "gl" in scene.sys.game.renderer && Boolean(scene.sys.game.renderer.gl);
    camera.on("prerender", this.render);
  }

  private readonly render = (): void => {
    const view = this.camera.worldView;
    if (this.darkness <= 0.01) {
      this.image.setVisible(false);
      return;
    }
    const tile = this.grid?.tileSize ?? 16;
    const x = Math.floor(view.x / tile) * tile;
    const y = Math.floor(view.y / tile) * tile;
    const w = Math.ceil(view.width) + tile + 1;
    const h = Math.ceil(view.height) + tile + 1;
    const tint = Math.round(63 * Math.min(1, this.darkness / 0.8));
    this.image.setVisible(true).setAlpha(Math.min(1, this.darkness / 0.8));
    const revision = this.grid?.revision ?? 0;
    if (
      this.texture.width === w &&
      this.texture.height === h &&
      x === this.lastX &&
      y === this.lastY &&
      revision === this.lastRevision &&
      this.grid === this.lastGrid &&
      tint === this.lastTint
    )
      return;
    this.lastX = x;
    this.lastY = y;
    this.lastRevision = revision;
    this.lastGrid = this.grid;
    this.lastTint = tint;
    if (this.texture.width !== w || this.texture.height !== h) {
      this.texture.setSize(w, h);
      this.image.setSizeToFrame().setOrigin(0);
    }
    this.image.setPosition(x, y).setVisible(true);
    const g = this.texture.getContext();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    const t = tint / 63;
    const r = mix(duskColor >> 16, nightColor >> 16, t);
    const green = mix((duskColor >> 8) & 255, (nightColor >> 8) & 255, t);
    const b = mix(duskColor & 255, nightColor & 255, t);
    g.fillStyle = `rgba(${r},${green},${b},${maxNightAlpha})`;
    g.fillRect(0, 0, w, h);
    if (this.grid) eraseLitPixels(g, this.grid, { x, y, width: w, height: h });
    if (this.webgl) this.texture.refresh();
  };

  destroy(): void {
    this.camera.off("prerender", this.render);
    this.image.destroy();
    this.scene.textures.remove(KEY);
  }
}
