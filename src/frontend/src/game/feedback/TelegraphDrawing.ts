import Phaser from "phaser";
import type { TelegraphPreset } from "./combatFeelPresets";

const OUTLINE_PAD = 2;

type LinearView = {
  fill: Phaser.GameObjects.Image;
  progress: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
};

function color(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** Keeps the original painter order across textured strips and Graphics paths. */
export class TelegraphDrawing {
  private readonly layer: Phaser.GameObjects.Layer;
  private readonly prefix = `telegraph-${Phaser.Utils.String.UUID()}`;
  private readonly fillTexture: Phaser.Textures.CanvasTexture | null;
  private readonly outlines = new Map<number, Phaser.Textures.CanvasTexture>();
  private readonly strips: LinearView[] = [];
  private readonly paths: Phaser.GameObjects.Graphics[] = [];
  private stripCount = 0;
  private pathCount = 0;
  private depth = 0;
  private activePath: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: TelegraphPreset,
  ) {
    this.layer = scene.add.layer().setDepth(opts.groundDepth);
    if (scene.game.renderer.type !== Phaser.WEBGL) {
      this.fillTexture = null;
      return;
    }
    this.fillTexture = this.createTexture("fill", 1, 1);
    const ctx = this.fillTexture.context;
    ctx.fillStyle = color(opts.fillColor);
    ctx.fillRect(0, 0, 1, 1);
    this.fillTexture.refresh();
  }

  begin(): void {
    this.stripCount = 0;
    this.pathCount = 0;
    this.depth = 0;
    this.activePath = null;
  }

  path(): Phaser.GameObjects.Graphics {
    if (this.activePath) return this.activePath;
    let path = this.paths[this.pathCount++];
    if (!path) {
      path = new Phaser.GameObjects.Graphics(this.scene);
      this.layer.add(path);
      this.paths.push(path);
    }
    path.clear().setVisible(true);
    this.order(path);
    this.activePath = path;
    return path;
  }

  linear(
    x: number,
    y: number,
    ux: number,
    uy: number,
    length: number,
    progress: number,
    committing: boolean,
  ): void {
    const fillTexture = this.fillTexture;
    if (!fillTexture) {
      this.linearPath(x, y, ux, uy, length, progress, committing);
      return;
    }
    this.activePath = null;
    const outline = this.outlines.get(length) ?? this.bakeOutline(length);
    let strip = this.strips[this.stripCount++];
    if (!strip) {
      strip = {
        fill: this.image(fillTexture).setAlpha(this.opts.fillAlpha),
        progress: this.image(fillTexture).setAlpha(this.opts.progressAlpha),
        outline: this.image(fillTexture),
      };
      this.strips.push(strip);
    }
    const frame = outline.get(committing ? "commit" : "normal");
    if (strip.outline.frame !== frame) {
      strip.outline
        .setTexture(outline.key, frame.name)
        .setDisplayOrigin(OUTLINE_PAD, OUTLINE_PAD + this.opts.lineWidthPx / 2);
    }
    const angle = Math.atan2(uy, ux);
    strip.fill.setDisplaySize(length, this.opts.lineWidthPx).setVisible(true);
    strip.outline.setVisible(true);
    strip.progress
      .setDisplaySize(length * progress, this.opts.lineWidthPx)
      .setVisible(progress > 0);
    strip.fill.setPosition(x, y).setRotation(angle);
    strip.progress.setPosition(x, y).setRotation(angle);
    strip.outline.setPosition(x, y).setRotation(angle);
    this.order(strip.fill);
    this.order(strip.progress);
    this.order(strip.outline);
  }

  end(): void {
    for (let i = this.pathCount; i < this.paths.length; i++)
      this.paths[i].setVisible(false);
    for (let i = this.stripCount; i < this.strips.length; i++) {
      const { fill, progress, outline } = this.strips[i];
      fill.setVisible(false);
      progress.setVisible(false);
      outline.setVisible(false);
    }
  }

  destroy(): void {
    this.layer.destroy();
    if (this.fillTexture) this.scene.textures.remove(this.fillTexture);
    for (const texture of this.outlines.values())
      this.scene.textures.remove(texture);
    this.outlines.clear();
  }

  private linearPath(
    x: number,
    y: number,
    ux: number,
    uy: number,
    length: number,
    progress: number,
    committing: boolean,
  ): void {
    const path = this.path();
    const hw = this.opts.lineWidthPx / 2;
    const offsetX = -uy * hw;
    const offsetY = ux * hw;
    const quad = (distance: number) => {
      const endX = x + ux * distance;
      const endY = y + uy * distance;
      return [
        { x: Math.round(x + offsetX), y: Math.round(y + offsetY) },
        { x: Math.round(endX + offsetX), y: Math.round(endY + offsetY) },
        { x: Math.round(endX - offsetX), y: Math.round(endY - offsetY) },
        { x: Math.round(x - offsetX), y: Math.round(y - offsetY) },
      ];
    };
    const full = quad(length);
    path
      .fillStyle(this.opts.fillColor, this.opts.fillAlpha)
      .fillPoints(full, true);
    if (progress > 0) {
      path
        .fillStyle(this.opts.fillColor, this.opts.progressAlpha)
        .fillPoints(quad(length * progress), true);
    }
    const border = committing
      ? this.opts.commitFlashColor
      : this.opts.borderColor;
    path.lineStyle(4, this.opts.outlineColor).strokePoints(full, true);
    path.lineStyle(2, border).strokePoints(full, true);
  }

  private order(
    object: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image,
  ) {
    const depth = this.depth++;
    if (object.depth !== depth) object.setDepth(depth);
  }

  private image(
    texture: Phaser.Textures.CanvasTexture,
  ): Phaser.GameObjects.Image {
    const image = new Phaser.GameObjects.Image(this.scene, 0, 0, texture);
    this.layer.add(image);
    return image.setOrigin(0, 0.5);
  }

  private createTexture(
    suffix: string,
    width: number,
    height: number,
  ): Phaser.Textures.CanvasTexture {
    const texture = this.scene.textures.createCanvas(
      `${this.prefix}-${suffix}`,
      width,
      height,
    );
    if (!texture) throw new Error("无法创建攻击预警纹理");
    return texture;
  }

  private bakeOutline(length: number): Phaser.Textures.CanvasTexture {
    const lineWidth = this.opts.lineWidthPx;
    const width = Math.ceil(length) + 2 * OUTLINE_PAD;
    const height = Math.ceil(lineWidth) + 2 * OUTLINE_PAD;
    const texture = this.createTexture(`outline-${length}`, width, 2 * height);
    const ctx = texture.context;
    const outlineColor = color(this.opts.outlineColor);
    const draw = (y: number, border: number) => {
      ctx.lineWidth = 4;
      ctx.strokeStyle = outlineColor;
      ctx.strokeRect(OUTLINE_PAD, y + OUTLINE_PAD, length, lineWidth);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color(border);
      ctx.strokeRect(OUTLINE_PAD, y + OUTLINE_PAD, length, lineWidth);
    };
    draw(0, this.opts.borderColor);
    draw(height, this.opts.commitFlashColor);
    texture.refresh();
    texture.add("normal", 0, 0, 0, width, height);
    texture.add("commit", 0, 0, height, width, height);
    this.outlines.set(length, texture);
    return texture;
  }
}
