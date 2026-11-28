import type { RunState, Systems } from "@/core/types";
import { safeUnit } from "@/systems/combat/combatMath";
import { currentWeapon } from "@/systems/combat/heroAttack";
import { getRiposteState } from "@/systems/combat/riposte";
import { isHeroDashActive } from "@/systems/movement";
import Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { ATMOSPHERE_PRESETS } from "./atmospherePresets";

const { slash, dashGhost } = ATMOSPHERE_PRESETS;
const THRUST_DURATION_MS = 130;
const RIPOSTE_GOLD_CORE = 0xfffbe6;
const RIPOSTE_GOLD_OUTER = 0xffc83d;
const RIPOSTE_GHOST_TINT = 0xffd43b;

// Phaser's Canvas renderer ignores Image tint. Bake one frame into each pooled ghost.
class CanvasDashGhost extends Phaser.GameObjects.Image {
  private readonly canvas = document.createElement("canvas");
  private readonly context = this.canvas.getContext("2d");
  private tintedFrame: Phaser.Textures.Frame | null = null;

  snapshotTint(tint = dashGhost.tint): void {
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
    context.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
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
  private readonly auraGraphics: Phaser.GameObjects.Graphics;
  private readonly thrustGraphics: Phaser.GameObjects.Graphics;
  private readonly ghosts: {
    image: Phaser.GameObjects.Image;
    remainingMs: number;
    startAlpha: number;
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
  private thrustElapsedMs = THRUST_DURATION_MS;
  private thrustX = 0;
  private thrustY = 0;
  private thrustDirX = 1;
  private thrustDirY = 0;
  private thrustRangePx = 0;
  private lastHeroSprite:
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Image
    | null = null;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options?: { reducedMotion?: boolean; slashDepth?: number },
  ) {
    this.reducedMotion = options?.reducedMotion ?? false;
    this.ghostIntervalMs =
      dashGhost.spawnIntervalMs * (this.reducedMotion ? 3 : 1);
    const depth = options?.slashDepth ?? slash.depth;
    this.graphics = scene.add.graphics().setDepth(depth);
    this.auraGraphics = scene.add.graphics().setDepth(depth);
    this.thrustGraphics = scene.add.graphics().setDepth(depth);
    const canvasRenderer = scene.sys.game.renderer.type === Phaser.CANVAS;
    this.ghosts = Array.from(
      { length: this.reducedMotion ? 2 : dashGhost.poolSize },
      () => {
        const image = canvasRenderer
          ? scene.add.existing(new CanvasDashGhost(scene, 0, 0, "__WHITE"))
          : scene.add.image(0, 0, "__WHITE");
        image.setTint(dashGhost.tint).setVisible(false);
        return { image, remainingMs: 0, startAlpha: dashGhost.startAlpha };
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
    if (this.destroyed || !(rangePx > 0) || !(arcDegrees > 0)) return;
    this.slashX = Math.round(x);
    this.slashY = Math.round(y);
    this.facing = Math.atan2(facingY, facingX);
    this.radius = rangePx;
    this.halfArc = Phaser.Math.DegToRad(Math.min(360, arcDegrees)) / 2;
    this.elapsedMs = 0;
    this.drawSlash();
  }

  private suppressNextSlashSync = false;

  /** Draws orbiting warm-gold sparks (or static gold ring in reducedMotion) while riposte is armed. */
  syncRiposteAura(state: RunState, timeSec: number): void {
    const g = this.auraGraphics.clear();
    if (this.destroyed) return;
    const { armedSec } = getRiposteState(state);
    if (armedSec <= 0) return;
    const cx = Math.round(state.hero.x);
    const cy = Math.round(state.hero.y - 4);
    const fade = Math.min(1, armedSec / 0.25);

    if (this.reducedMotion) {
      g.lineStyle(1, RIPOSTE_GOLD_OUTER, 0.85 * fade);
      g.strokeCircle(cx, cy, 11);
      return;
    }

    const baseAngle = timeSec * 5.2;
    for (let i = 0; i < 2; i++) {
      const angle = baseAngle + i * Math.PI;
      const px = Math.round(cx + Math.cos(angle) * 11);
      const py = Math.round(cy + Math.sin(angle) * 9);
      const tailAngle = angle - 0.35;
      const tx = Math.round(cx + Math.cos(tailAngle) * 11);
      const ty = Math.round(cy + Math.sin(tailAngle) * 9);

      g.fillStyle(0xff9b3d, 0.45 * fade).fillRect(tx - 1, ty - 1, 2, 2);
      g.fillStyle(RIPOSTE_GOLD_OUTER, 0.65 * fade).fillRect(
        px - 2,
        py - 2,
        4,
        4,
      );
      g.fillStyle(RIPOSTE_GOLD_CORE, fade).fillRect(px - 1, py - 1, 2, 2);
    }
  }

  /** Renders a focused 130ms gold-white thrust beam and 2 warm-gold lunge afterimages. */
  triggerCounterThrust(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    rangePx: number,
    heroSprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null,
    origin?: { x: number; y: number },
  ): void {
    if (this.destroyed || !(rangePx > 0)) return;
    this.suppressNextSlashSync = true;
    const { x: ux, y: uy } = safeUnit(dirX, dirY);
    this.thrustX = Math.round(x);
    this.thrustY = Math.round(y);
    this.thrustDirX = ux;
    this.thrustDirY = uy;
    this.thrustRangePx = rangePx;
    this.thrustElapsedMs = 0;
    this.drawCounterThrust();

    const sprite = heroSprite ?? this.lastHeroSprite;
    if (sprite?.visible && this.ghosts.length > 0) {
      const ox = origin?.x ?? x - ux * 24;
      const oy = origin?.y ?? y - uy * 24;
      const positions = [
        { gx: ox, gy: oy, alpha: 0.68 },
        { gx: ox + (x - ox) * 0.45, gy: oy + (y - oy) * 0.45, alpha: 0.52 },
      ];
      for (const pos of positions) {
        const ghost = this.ghosts[this.ghostIndex];
        this.ghostIndex = (this.ghostIndex + 1) % this.ghosts.length;
        ghost.remainingMs = dashGhost.fadeDurationMs;
        ghost.startAlpha = pos.alpha;
        ghost.image
          .setFrame(sprite.frame)
          .setPosition(Math.round(pos.gx), Math.round(pos.gy))
          .setOrigin(sprite.originX, sprite.originY)
          .setScale(sprite.scaleX, sprite.scaleY)
          .setFlip(sprite.flipX, sprite.flipY)
          .setRotation(sprite.rotation)
          .setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY)
          .setDepth(sprite.depth + RENDER_DEPTH.entityOffset.dashGhost)
          .setTint(RIPOSTE_GHOST_TINT)
          .setAlpha(pos.alpha)
          .setVisible(true);
        if (ghost.image instanceof CanvasDashGhost) {
          ghost.image.snapshotTint(RIPOSTE_GHOST_TINT);
        }
      }
    }
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
    if (this.suppressNextSlashSync) {
      this.suppressNextSlashSync = false;
      return;
    }
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
    if (heroSprite) this.lastHeroSprite = heroSprite;
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
    ghost.startAlpha = dashGhost.startAlpha;
    ghost.image
      .setFrame(heroSprite.frame)
      .setPosition(heroSprite.x, heroSprite.y)
      .setOrigin(heroSprite.originX, heroSprite.originY)
      .setScale(heroSprite.scaleX, heroSprite.scaleY)
      .setFlip(heroSprite.flipX, heroSprite.flipY)
      .setRotation(heroSprite.rotation)
      .setScrollFactor(heroSprite.scrollFactorX, heroSprite.scrollFactorY)
      .setDepth(heroSprite.depth + RENDER_DEPTH.entityOffset.dashGhost)
      .setTint(dashGhost.tint)
      .setAlpha(dashGhost.startAlpha)
      .setVisible(true);
    if (ghost.image instanceof CanvasDashGhost) {
      ghost.image.snapshotTint(dashGhost.tint);
    }
  }

  private update(_time: number, dtMs: number): void {
    if (this.destroyed) return;
    if (this.elapsedMs < slash.durationMs) {
      this.elapsedMs += dtMs;
      this.drawSlash();
    }
    if (this.thrustElapsedMs < THRUST_DURATION_MS) {
      this.thrustElapsedMs += dtMs;
      this.drawCounterThrust();
    }
    for (const ghost of this.ghosts) {
      if (ghost.remainingMs <= 0) continue;
      ghost.remainingMs = Math.max(0, ghost.remainingMs - dtMs);
      ghost.image
        .setAlpha(
          (ghost.startAlpha * ghost.remainingMs) / dashGhost.fadeDurationMs,
        )
        .setVisible(ghost.remainingMs > 0);
    }
  }

  private drawCounterThrust(): void {
    const g = this.thrustGraphics.clear();
    const progress = this.thrustElapsedMs / THRUST_DURATION_MS;
    if (progress >= 1) return;

    const alpha = 1 - progress;
    const ux = this.thrustDirX;
    const uy = this.thrustDirY;
    const nx = -uy;
    const ny = ux;
    const sx = this.thrustX - ux * 6;
    const sy = this.thrustY - uy * 6;
    const ex = this.thrustX + ux * this.thrustRangePx;
    const ey = this.thrustY + uy * this.thrustRangePx;
    const outerW = Math.max(1.5, 3.5 * (1 - progress * 0.55));
    const coreW = Math.max(0.8, 1.6 * (1 - progress * 0.4));

    g.fillStyle(RIPOSTE_GOLD_OUTER, alpha * 0.75).fillPoints(
      [
        { x: sx + nx * outerW, y: sy + ny * outerW },
        { x: ex, y: ey },
        { x: sx - nx * outerW, y: sy - ny * outerW },
      ],
      true,
    );
    g.fillStyle(RIPOSTE_GOLD_CORE, alpha).fillPoints(
      [
        { x: sx + nx * coreW, y: sy + ny * coreW },
        { x: ex, y: ey },
        { x: sx - nx * coreW, y: sy - ny * coreW },
      ],
      true,
    );
    if (progress < 0.5) {
      const flare = 5 * (1 - progress * 2);
      g.lineStyle(1, RIPOSTE_GOLD_CORE, alpha).lineBetween(
        Math.round(this.thrustX - nx * flare),
        Math.round(this.thrustY - ny * flare),
        Math.round(this.thrustX + nx * flare),
        Math.round(this.thrustY + ny * flare),
      );
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
    this.auraGraphics.destroy();
    this.thrustGraphics.destroy();
    for (const ghost of this.ghosts) ghost.image.destroy();
  }
}
