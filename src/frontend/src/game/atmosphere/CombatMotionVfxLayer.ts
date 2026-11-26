import type { RunState, Systems } from "@/core/types";
import { currentWeapon } from "@/systems/combat/heroAttack";
import { isHeroDashActive } from "@/systems/movement";
import Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { ATMOSPHERE_PRESETS } from "./atmospherePresets";

const { slash, dashGhost } = ATMOSPHERE_PRESETS;

// Phaser's Canvas renderer ignores Image tint. Bake one frame into each pooled ghost.
class CanvasDashGhost extends Phaser.GameObjects.Image {
  private readonly canvas = document.createElement("canvas");
  private readonly context = this.canvas.getContext("2d");
  private tintedFrame: Phaser.Textures.Frame | null = null;

  snapshotTint(): void {
    const frame = this.frame;
    const { image } = frame.source;
    const { cutX, cutY, cutWidth, cutHeight } = frame;
    this.tintedFrame = null;
    if (
      !this.context ||
      !image ||
      image instanceof Uint8Array ||
      !cutWidth ||
      !cutHeight
    )
      return;

    this.canvas.width = cutWidth;
    this.canvas.height = cutHeight;
    const context = this.context;
    context.drawImage(
      image,
      cutX,
      cutY,
      cutWidth,
      cutHeight,
      0,
      0,
      cutWidth,
      cutHeight,
    );
    context.globalCompositeOperation = "source-atop";
    context.globalAlpha = 0.65;
    context.fillStyle = `#${dashGhost.tint.toString(16).padStart(6, "0")}`;
    context.fillRect(0, 0, cutWidth, cutHeight);

    const tintedFrame = frame.clone();
    tintedFrame.customPivot = frame.customPivot;
    tintedFrame.source = Object.create(frame.source);
    tintedFrame.source.image = this.canvas;
    Object.assign(tintedFrame.canvasData, { x: 0, y: 0 });
    this.tintedFrame = tintedFrame;
  }

  renderCanvas(
    renderer: Phaser.Renderer.Canvas.CanvasRenderer,
    image: Phaser.GameObjects.Image,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ): void {
    camera.addToRenderList(image);
    renderer.batchSprite(
      image,
      this.tintedFrame ?? image.frame,
      camera,
      parentMatrix,
    );
  }

  destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
    this.tintedFrame = null;
    this.canvas.width = this.canvas.height = 0;
  }
}

export class CombatMotionVfxLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly ghosts: {
    image: Phaser.GameObjects.Image;
    remainingMs: number;
  }[];
  private readonly reducedMotion: boolean;
  private readonly ghostIntervalMs: number;
  private ghostIndex = 0;
  private ghostDelayMs = 0;
  private attackRunId: string | null = null;
  private previousAttackSec = 0;
  private elapsedMs = slash.durationMs;
  private slashX = 0;
  private slashY = 0;
  private facing = 0;
  private radius = 0;
  private halfArc = 0;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options?: { reducedMotion?: boolean; slashDepth?: number },
  ) {
    this.reducedMotion = options?.reducedMotion ?? false;
    this.ghostIntervalMs =
      dashGhost.spawnIntervalMs * (this.reducedMotion ? 3 : 1);
    this.graphics = scene.add
      .graphics()
      .setDepth(options?.slashDepth ?? slash.depth);
    const canvasRenderer = scene.sys.game.renderer.type === Phaser.CANVAS;
    this.ghosts = Array.from(
      { length: this.reducedMotion ? 2 : dashGhost.poolSize },
      () => {
        const image = canvasRenderer
          ? scene.add.existing(new CanvasDashGhost(scene, 0, 0, "__WHITE"))
          : scene.add.image(0, 0, "__WHITE");
        image.setTint(dashGhost.tint).setVisible(false);
        return { image, remainingMs: 0 };
      },
    );
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  triggerSlash(
    x: number,
    y: number,
    facingX: number,
    facingY: number,
    rangePx: number,
    arcDegrees: number,
  ): void {
    if (
      this.destroyed ||
      !(rangePx > 0) ||
      !(arcDegrees > 0) ||
      !Number.isFinite(rangePx)
    )
      return;
    this.slashX = Math.round(x);
    this.slashY = Math.round(y);
    this.facing = Math.atan2(facingY, facingX);
    this.radius = rangePx;
    this.halfArc = Phaser.Math.DegToRad(Math.min(360, arcDegrees)) / 2;
    this.elapsedMs = 0;
    this.drawSlash();
  }

  syncHeroSlash(state: RunState, sys: Systems): void {
    if (this.destroyed) return;
    if (state.runId !== this.attackRunId) {
      this.attackRunId = state.runId;
      this.previousAttackSec = 0;
    }
    const { x, y, facingX, facingY, attackAnimSec } = state.hero;
    const started = attackAnimSec > this.previousAttackSec;
    this.previousAttackSec = attackAnimSec;
    if (!started) return;
    const weapon = currentWeapon(state, sys);
    this.triggerSlash(
      x,
      y,
      facingX,
      facingY,
      weapon.rangeTiles * sys.data.tileSize,
      weapon.arcDegrees,
    );
  }

  syncDashAfterimage(
    state: RunState,
    heroSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null,
    dtMs: number,
  ): void {
    if (this.destroyed) return;
    if (!heroSprite?.visible || !isHeroDashActive(state)) {
      this.ghostDelayMs = 0;
      return;
    }
    if (this.ghostDelayMs > 0) this.ghostDelayMs -= Math.max(0, dtMs);
    if (this.ghostDelayMs > 0) return;
    this.ghostDelayMs =
      this.ghostIntervalMs + (this.ghostDelayMs % this.ghostIntervalMs);

    const ghost = this.ghosts[this.ghostIndex];
    this.ghostIndex = (this.ghostIndex + 1) % this.ghosts.length;
    ghost.remainingMs = dashGhost.fadeDurationMs;
    ghost.image
      .setFrame(heroSprite.frame)
      .setPosition(heroSprite.x, heroSprite.y)
      .setOrigin(heroSprite.originX, heroSprite.originY)
      .setScale(heroSprite.scaleX, heroSprite.scaleY)
      .setFlip(heroSprite.flipX, heroSprite.flipY)
      .setRotation(heroSprite.rotation)
      .setScrollFactor(heroSprite.scrollFactorX, heroSprite.scrollFactorY)
      .setDepth(heroSprite.depth + RENDER_DEPTH.entityOffset.dashGhost)
      .setAlpha(dashGhost.startAlpha)
      .setVisible(true);
    if (ghost.image instanceof CanvasDashGhost) ghost.image.snapshotTint();
  }

  private update(_time: number, dtMs: number): void {
    if (this.destroyed) return;
    if (this.elapsedMs < slash.durationMs) {
      this.elapsedMs += dtMs;
      this.drawSlash();
    }
    for (const ghost of this.ghosts) {
      if (ghost.remainingMs <= 0) continue;
      ghost.remainingMs = Math.max(0, ghost.remainingMs - dtMs);
      ghost.image
        .setAlpha(
          (dashGhost.startAlpha * ghost.remainingMs) / dashGhost.fadeDurationMs,
        )
        .setVisible(ghost.remainingMs > 0);
    }
  }

  private drawSlash(): void {
    const g = this.graphics.clear();
    const progress = this.elapsedMs / slash.durationMs;
    if (progress >= 1) return;

    const head = this.reducedMotion
      ? this.halfArc
      : this.halfArc * (-0.6 + 1.6 * progress);
    const tail = this.reducedMotion
      ? -this.halfArc
      : Math.max(-this.halfArc, head - this.halfArc * 1.35);
    const cos = Math.cos(this.facing);
    const sin = Math.sin(this.facing);
    const alpha = 1 - progress;
    const thickness = Math.min(5, Math.max(1, this.radius * 0.23));
    const innerRadiusSq = Math.max(0, this.radius - thickness) ** 2;
    const outerRadiusSq = this.radius ** 2;
    const extent = Math.ceil(this.radius);

    // Batch consecutive pixels of the same color. Both renderers get integer-edged bands.
    for (let dy = -extent; dy < extent; dy++) {
      let spanStart = -extent;
      let spanColor = 0;
      const py = dy + 0.5;
      for (let dx = -extent; dx <= extent; dx++) {
        const px = dx + 0.5;
        const distanceSq = px * px + py * py;
        let color = 0;
        if (distanceSq >= innerRadiusSq && distanceSq <= outerRadiusSq) {
          const angle = Math.atan2(py * cos - px * sin, px * cos + py * sin);
          if (angle >= tail && angle <= head) {
            const taper = Math.sin((Math.PI * (angle - tail)) / (head - tail));
            const inset = this.radius - Math.sqrt(distanceSq);
            const width = thickness * (0.2 + 0.8 * taper);
            if (inset <= width)
              color = inset < width * 0.45 ? slash.coreColor : slash.trailColor;
          }
        }
        if (color === spanColor) continue;
        if (spanColor !== 0) {
          g.fillStyle(
            spanColor,
            spanColor === slash.coreColor ? alpha : alpha * 0.72,
          ).fillRect(
            this.slashX + spanStart,
            this.slashY + dy,
            dx - spanStart,
            1,
          );
        }
        spanColor = color;
        spanStart = dx;
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.graphics.destroy();
    for (const ghost of this.ghosts) ghost.image.destroy();
  }
}
