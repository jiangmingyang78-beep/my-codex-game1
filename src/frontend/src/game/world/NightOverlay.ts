import { registerCanvasTexture } from "@/vfx/proceduralTextures";
import type Phaser from "phaser";
import { ATMOSPHERE_PRESETS } from "../atmosphere/atmospherePresets";
import { RENDER_DEPTH } from "../renderDepth";

export interface LightSpot {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

type Visit = (light: {
  canvas: CanvasImageSource;
  x: number;
  y: number;
  radius: number;
  alpha: number;
}) => void;

const KEY = "emberwood-night-overlay";
/** The visible light reaches a bit past the nominal fire radius because the halo fades out. */
const LIGHT_SPREAD = 1.25;
const { duskColor, nightColor } = ATMOSPHERE_PRESETS.nightTint;
const mix = (a: number, b: number, t: number): number =>
  Math.round(a + (b - a) * t);

/**
 * Dusk/night tint drawn on one view-sized canvas: fill with the ambient colour, then erase
 * soft circles at camp lights and around the hero. Painted on the camera's prerender event so
 * it never lags a frame behind camera follow.
 */
export class NightOverlay {
  darkness = 0;
  heroLight: LightSpot | null = null;
  private readonly canvas = document.createElement("canvas");
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly webgl: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly halo: CanvasImageSource,
    private readonly forEachLight: (visit: Visit) => void,
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
    const x = Math.floor(view.x) - 1;
    const y = Math.floor(view.y) - 1;
    const w = Math.ceil(view.width) + 3;
    const h = Math.ceil(view.height) + 3;
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
    const t = Math.min(1, this.darkness / 0.8);
    const r = mix(duskColor >> 16, nightColor >> 16, t);
    const green = mix((duskColor >> 8) & 255, (nightColor >> 8) & 255, t);
    const b = mix(duskColor & 255, nightColor & 255, t);
    g.fillStyle = `rgba(${r},${green},${b},${this.darkness})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-out";
    g.imageSmoothingEnabled = true;
    const erase = (light: LightSpot): void => {
      const r = light.radius * LIGHT_SPREAD;
      g.globalAlpha = light.alpha;
      g.drawImage(this.halo, light.x - x - r, light.y - y - r, r * 2, r * 2);
    };
    this.forEachLight(erase);
    if (this.heroLight) erase(this.heroLight);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    if (this.webgl) this.texture.refresh();
  };

  destroy(): void {
    this.camera.off("prerender", this.render);
    this.image.destroy();
    this.scene.textures.remove(KEY);
  }
}
