import type { BalanceData } from "@/core";
import { TILE, type World } from "@/systems";
import { registerCanvasTexture } from "@/vfx/proceduralTextures";
import type Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { TEX } from "../textures/registerTextures";
import {
  WINTER_SNOW_HIGHLIGHTS,
  WINTER_TRAIL_PALETTE,
  tileHash,
} from "../textures/worldTexture";
import { DAWN_SEC, DUSK_SEC } from "./darkness";

const rgb = (color: string): number => Number.parseInt(color.slice(1), 16);
const DRIFT = rgb(WINTER_SNOW_HIGHLIGHTS.drift);
const GLINT = rgb(WINTER_SNOW_HIGHLIGHTS.glint);
const TRAIL_RIM = rgb(WINTER_TRAIL_PALETTE.rim);
const TRAIL_SHOULDER = rgb(WINTER_TRAIL_PALETTE.shoulder);
const TRAIL_BASE = rgb(WINTER_TRAIL_PALETTE.base);
const DUSK_TAIL_SEC = DUSK_SEC * 0.6;
const fade = (value: number): number => Math.min(1, Math.max(0, value));

interface Patch {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Layer {
  key: string;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
}

function paintGroundAccents(
  ground: HTMLCanvasElement,
  world: World,
  patch: Patch,
  dawn: CanvasRenderingContext2D,
  night: CanvasRenderingContext2D,
): void {
  const { left, top, width, height } = patch;
  const { tileSize: size, tiles, widthTiles, heightTiles } = world;
  dawn.clearRect(0, 0, width, height);
  dawn.drawImage(ground, -left, -top);
  const snow = dawn.getImageData(0, 0, width, height);
  const road = night.createImageData(width, height);
  const a = snow.data;
  const b = road.data;
  for (let y = 0; y < height; y++) {
    const ty = Math.floor((top + y) / size);
    for (let start = 0; start < width; start += size) {
      const tx = (left + start) / size;
      const tile =
        tx >= 0 && tx < widthTiles && ty >= 0 && ty < heightTiles
          ? tiles[ty * widthTiles + tx]
          : undefined;
      const snowTile = tile === TILE.snow || tile === TILE.tree;
      const end = (y * width + Math.min(width, start + size)) * 4;
      for (let i = (y * width + start) * 4; i < end; i += 4) {
        a[i + 3] = 0;
        if (!snowTile && tile !== TILE.path) continue;
        const pixel = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2];
        if (snowTile && (pixel === DRIFT || pixel === GLINT)) {
          const glint = pixel === GLINT;
          a[i] = glint ? 224 : 181;
          a[i + 1] = glint ? 204 : 166;
          a[i + 2] = glint ? 236 : 203;
          a[i + 3] = 255;
        } else if (tile === TILE.path && pixel === TRAIL_RIM) {
          b[i] = 232;
          b[i + 1] = 245;
          b[i + 2] = 255;
          b[i + 3] = 255;
        } else if (
          tile === TILE.path &&
          (pixel === TRAIL_SHOULDER || pixel === TRAIL_BASE)
        ) {
          const shoulder = pixel === TRAIL_SHOULDER;
          b[i] = shoulder ? 153 : 123;
          b[i + 1] = shoulder ? 177 : 132;
          b[i + 2] = shoulder ? 199 : 149;
          b[i + 3] = shoulder ? 235 : 192;
        }
      }
    }
  }
  dawn.putImageData(snow, 0, 0);
  night.putImageData(road, 0, 0);
}

function paintTreeShadows(
  world: World,
  patch: Patch,
  g: CanvasRenderingContext2D,
): void {
  const { left, top, width, height } = patch;
  const { tileSize: size, tiles, widthTiles, heightTiles } = world;
  const right = Math.min(widthTiles, (left + width) / size);
  const bottom = Math.min(heightTiles, (top + height) / size);
  g.clearRect(0, 0, width, height);
  // Trees just beyond the left and top edges can still cast shadows into the patch.
  for (let ty = Math.max(0, top / size - 1); ty < bottom; ty++) {
    for (let tx = Math.max(0, left / size - 2); tx < right; tx++) {
      if (tiles[ty * widthTiles + tx] !== TILE.tree) continue;
      const x = tx * size + size / 2 - left;
      const y = (ty + 1) * size - 2 - top;
      const length = 15 + Math.floor(tileHash(tx, ty, 3) * 9);
      g.fillStyle = "#626489";
      g.fillRect(x + 6, y + 3, length - 6, 2);
      g.fillRect(x + length - 8, y + 5, 5, 1);
      g.fillStyle = "#494d74";
      g.fillRect(x + 1, y + 2, length - 7, 2);
      g.fillRect(x - 1, y, 10, 3);
    }
  }
}

/** Reuses a tile-aligned patch of terrain accents while the camera remains within it. */
export class SnowClockArt {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly ground: HTMLCanvasElement;
  private readonly layers: readonly [Layer, Layer, Layer];
  private readonly webgl: boolean;
  private patch: Patch | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
    private readonly clock: BalanceData["clock"],
  ) {
    this.camera = scene.cameras.main;
    const ground = scene.textures
      .get(world.textureKey ?? TEX.world)
      .getSourceImage();
    if (!(ground instanceof HTMLCanvasElement))
      throw new Error("Missing baked world canvas.");
    this.ground = ground;
    this.layers = [
      this.createLayer("dawn"),
      this.createLayer("dusk"),
      this.createLayer("night"),
    ];
    this.webgl =
      "gl" in scene.sys.game.renderer && Boolean(scene.sys.game.renderer.gl);
    this.camera.on("prerender", this.render);
  }

  private createLayer(phase: "dawn" | "dusk" | "night"): Layer {
    const key = `snow-accent-${phase}`;
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    if (phase === "dawn") canvas.getContext("2d", { willReadFrequently: true });
    const texture = registerCanvasTexture(this.scene, key, { canvas })
      .texture as Phaser.Textures.CanvasTexture;
    const image = this.scene.add
      .image(0, 0, key)
      .setDepth(RENDER_DEPTH.snowAccents)
      .setOrigin(0)
      .setVisible(false);
    return { key, texture, image };
  }

  sync(elapsedSec: number): void {
    const { daySec, nightSec } = this.clock;
    const cycle = daySec + nightSec;
    const t = elapsedSec % cycle;
    const fromDawn = t > daySec ? t - cycle : t;
    const sinceDusk = t - daySec;
    const dawn = fade(1 - Math.abs(fromDawn) / DAWN_SEC);
    const dusk =
      fade(1 + sinceDusk / DUSK_SEC) * fade(1 - sinceDusk / DUSK_TAIL_SEC);
    const night =
      fade(sinceDusk / DUSK_TAIL_SEC) * fade((cycle - t) / DAWN_SEC);
    this.layers[0].image.setAlpha(dawn).setVisible(dawn > 0);
    this.layers[1].image.setAlpha(dusk).setVisible(dusk > 0);
    this.layers[2].image.setAlpha(night).setVisible(night > 0);
  }

  private readonly render = (): void => {
    if (!this.layers.some(({ image }) => image.visible)) return;
    const { x, y, width, height } = this.camera.worldView;
    const block = this.world.tileSize * 6;
    const left = Math.floor(x / block) * block;
    const top = Math.floor(y / block) * block;
    const w = (Math.ceil(width / block) + 1) * block;
    const h = (Math.ceil(height / block) + 1) * block;
    const cached = this.patch;
    if (
      cached?.left === left &&
      cached.top === top &&
      cached.width === w &&
      cached.height === h
    )
      return;
    const patch = { left, top, width: w, height: h };
    for (const { texture, image } of this.layers) {
      if (texture.width !== w || texture.height !== h) {
        texture.setSize(w, h);
        image.setSizeToFrame().setOrigin(0);
      }
      image.setPosition(left, top);
    }
    const [dawn, dusk, night] = this.layers;
    paintGroundAccents(
      this.ground,
      this.world,
      patch,
      dawn.texture.getContext(),
      night.texture.getContext(),
    );
    paintTreeShadows(this.world, patch, dusk.texture.getContext());
    if (this.webgl) for (const { texture } of this.layers) texture.refresh();
    this.patch = patch;
  };

  destroy(): void {
    this.camera.off("prerender", this.render);
    for (const { image, key } of this.layers) {
      image.destroy();
      this.scene.textures.remove(key);
    }
  }
}
