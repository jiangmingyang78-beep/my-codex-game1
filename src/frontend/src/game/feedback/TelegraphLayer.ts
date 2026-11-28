import type { EnemyDef } from "@/core/dataTypes";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { ratio01, safeUnit } from "@/systems/combat/combatMath";
import { currentMove } from "@/systems/combat/enemyAi";
import { categoryOf } from "@/systems/combat/spawnRules";
import Phaser from "phaser";
import { TelegraphDrawing } from "./TelegraphDrawing";
import { COMBAT_FEEL_PRESETS, type TelegraphPreset } from "./combatFeelPresets";

const ORDINARY_LIMIT = 12;
const DEFAULT_DIRECTION = safeUnit(0, 0);

class SeedAttackView {
  kind: "sweep" | "lunge" | "charge" | "projectile" | "aoe" = "sweep";
  windupSec = 0;
  reachTiles = 0;
  arcDegrees = 100;
}

function resolveTelegraphMove(
  def: EnemyDef,
  enemy: EnemyState,
  out: SeedAttackView,
): boolean {
  const stage = def.seedType ? def.phases?.[enemy.wardenPhase ?? 0] : undefined;
  const override = stage?.overrides?.attack;
  const attack = def.attack;
  out.windupSec = override?.windupSec ?? attack.windupSec ?? 0.4;
  out.arcDegrees = 100;
  switch (stage?.seedType ?? def.seedType) {
    case "lunge":
      out.kind = "lunge";
      out.reachTiles = override?.distanceTiles ?? attack.distanceTiles ?? 2.5;
      break;
    case "stalk_melee":
      out.kind = "sweep";
      out.reachTiles = override?.reachTiles ?? attack.reachTiles ?? 1.5;
      out.arcDegrees = 130;
      break;
    case "ranged_telegraph":
      out.kind =
        (override?.mode ?? attack.mode) === "aoe" ? "aoe" : "projectile";
      out.reachTiles =
        out.kind === "aoe"
          ? (override?.radiusTiles ?? attack.radiusTiles ?? 1.2)
          : (override?.preferredTiles ?? attack.preferredTiles ?? 5);
      break;
    default: {
      const move = currentMove(def, enemy);
      if (!move) return false;
      out.kind = move.type;
      out.windupSec = move.windupSec;
      const reach =
        move.type === "lunge" || move.type === "charge"
          ? move.distanceTiles
          : move.rangeTiles;
      out.reachTiles = reach ?? move.triggerRangeTiles;
      out.arcDegrees = move.arcDegrees ?? 100;
    }
  }
  return true;
}

export class TelegraphLayer {
  private readonly opts: TelegraphPreset;
  private drawing: TelegraphDrawing | null;
  private readonly move = new SeedAttackView();
  private readonly commits: {
    id: string;
    move: SeedAttackView;
    progress: number;
  }[] = [];
  private readonly diamond = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  constructor(
    private readonly scene: Phaser.Scene,
    options: Partial<TelegraphPreset> = {},
  ) {
    this.opts = { ...COMBAT_FEEL_PRESETS.telegraph, ...options };
    this.drawing = new TelegraphDrawing(scene, this.opts);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  syncFromState(state: RunState, sys: Systems, _timeSec: number): void {
    const drawing = this.drawing;
    if (!drawing) return;
    drawing.begin();
    const tileSize = sys.data.tileSize;
    const view = this.scene.cameras.main.worldView;
    const move = this.move;
    let commitCount = 0;
    let ordinaryCount = 0;
    for (const id in state.enemiesById) {
      const enemy = state.enemiesById[id];
      if (enemy.phase !== "windup" || enemy.hp <= 0) continue;
      const def = getEnemy(sys.data, enemy.enemyId);
      if (!resolveTelegraphMove(def, enemy, move)) continue;

      const reach = move.reachTiles * tileSize;
      const padding = reach + Math.max(8, this.opts.lineWidthPx / 2 + 3);
      // A ranged enemy outside the camera can still aim into the viewport.
      const aimed = move.kind === "aoe" || move.kind === "projectile";
      const tx = (aimed ? enemy.aimX : undefined) ?? enemy.x;
      const ty = (aimed ? enemy.aimY : undefined) ?? enemy.y;
      const x = move.kind === "aoe" ? tx : enemy.x;
      const y = move.kind === "aoe" ? ty : enemy.y;
      if (
        view.width > 0 &&
        view.height > 0 &&
        !Phaser.Geom.Intersects.RectangleToValues(
          view,
          Math.min(x, tx),
          Math.max(x, tx),
          Math.min(y, ty),
          Math.max(y, ty),
          padding,
        )
      )
        continue;

      const windup = Math.max(1e-4, move.windupSec);
      const remaining = Phaser.Math.Clamp(
        this.opts.windupTimerMode === "remaining"
          ? enemy.phaseSec
          : windup - enemy.phaseSec,
        0,
        windup,
      );
      const committing = remaining <= this.opts.commitWindowSec;
      const nearCommit =
        committing &&
        Math.hypot(tx - state.hero.x, ty - state.hero.y) <=
          reach + 2 * tileSize;
      if (!enemy.boss && !nearCommit && categoryOf(enemy.enemyId) !== "elite") {
        if (ordinaryCount >= ORDINARY_LIMIT) continue;
        ordinaryCount++;
      }

      const progress = 1 - ratio01(remaining, windup);
      if (committing) {
        // Reuse slots up to the high-water mark. The final pass paints commits above other warnings.
        const slot = this.commits[commitCount];
        if (slot) {
          slot.id = id;
          slot.progress = progress;
          Object.assign(slot.move, move);
        } else this.commits.push({ id, move: { ...move }, progress });
        commitCount++;
      } else {
        this.drawMoveTelegraph(drawing, enemy, move, tileSize, progress, false);
      }
    }
    for (let i = 0; i < commitCount; i++) {
      const { id, move, progress } = this.commits[i];
      const enemy = state.enemiesById[id];
      this.drawMoveTelegraph(drawing, enemy, move, tileSize, progress, true);
    }
    drawing.end();
  }

  private drawMoveTelegraph(
    drawing: TelegraphDrawing,
    enemy: EnemyState,
    move: SeedAttackView,
    tileSize: number,
    progress: number,
    committing: boolean,
  ): void {
    const reach = move.reachTiles * tileSize;
    const ox = Math.round(enemy.x);
    const oy = Math.round(enemy.y);
    const magnitude = Math.hypot(enemy.dirX, enemy.dirY);
    const hasDirection = magnitude > 1e-6 && Number.isFinite(magnitude);
    const ux = hasDirection ? enemy.dirX / magnitude : DEFAULT_DIRECTION.x;
    const uy = hasDirection ? enemy.dirY / magnitude : DEFAULT_DIRECTION.y;
    if (move.kind === "charge" || move.kind === "lunge") {
      drawing.linear(ox, oy, ux, uy, reach, progress, committing);
      return;
    }

    const g = drawing.path();
    const border = committing
      ? this.opts.commitFlashColor
      : this.opts.borderColor;
    switch (move.kind) {
      case "sweep": {
        const halfArc = Phaser.Math.DegToRad(move.arcDegrees) / 2;
        const angle = Math.atan2(uy, ux);
        const start = angle - halfArc;
        const end = angle + halfArc;
        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.beginPath()
          .slice(ox, oy, reach, start, end, false)
          .closePath()
          .fillPath();
        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.beginPath()
            .slice(ox, oy, reach * progress, start, end, false)
            .closePath()
            .fillPath();
        }
        g.beginPath().slice(ox, oy, reach, start, end, false).closePath();
        g.lineStyle(4, this.opts.outlineColor).strokePath();
        g.lineStyle(2, border).strokePath();
        break;
      }
      case "aoe": {
        const tx = Math.round(enemy.aimX ?? ox);
        const ty = Math.round(enemy.aimY ?? oy);
        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.fillCircle(tx, ty, reach);
        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.fillCircle(tx, ty, reach * progress);
        }
        g.lineStyle(4, this.opts.outlineColor).strokeCircle(tx, ty, reach);
        g.lineStyle(2, border).strokeCircle(tx, ty, reach);
        break;
      }
      case "projectile": {
        const tx = Math.round(enemy.aimX ?? ox + ux * reach);
        const ty = Math.round(enemy.aimY ?? oy + uy * reach);
        this.drawProjectile(g, ox, oy, tx, ty, border, progress);
        break;
      }
    }
  }

  private drawProjectile(
    g: Phaser.GameObjects.Graphics,
    ox: number,
    oy: number,
    tx: number,
    ty: number,
    border: number,
    progress: number,
  ): void {
    const dx = tx - ox;
    const dy = ty - oy;
    const distance = Math.hypot(dx, dy);
    const { outlineColor, projectileAimAlpha, fillColor, progressAlpha } =
      this.opts;
    if (distance > 1e-4) {
      const ux = dx / distance;
      const uy = dy / distance;
      for (let width = 4; width >= 2; width -= 2) {
        g.lineStyle(
          width,
          width === 4 ? outlineColor : border,
          projectileAimAlpha,
        );
        for (let d = 0; d < distance; d += 14) {
          const end = Math.min(d + 8, distance);
          g.lineBetween(
            Math.round(ox + ux * d),
            Math.round(oy + uy * d),
            Math.round(ox + ux * end),
            Math.round(oy + uy * end),
          );
        }
      }
      if (progress > 0) {
        const px = Math.round(ox + dx * progress);
        const py = Math.round(oy + dy * progress);
        g.lineStyle(4, outlineColor).lineBetween(ox, oy, px, py);
        g.lineStyle(2, border).lineBetween(ox, oy, px, py);
      }
    }

    const [top, right, bottom, left] = this.diamond;
    top.x = bottom.x = tx;
    right.y = left.y = ty;
    top.y = ty - 6;
    right.x = tx + 6;
    bottom.y = ty + 6;
    left.x = tx - 6;
    g.fillStyle(fillColor, progressAlpha).fillPoints(this.diamond, true);
    g.lineStyle(4, outlineColor).strokePoints(this.diamond, true);
    g.lineStyle(2, border).strokePoints(this.diamond, true);
  }

  destroy(): void {
    if (!this.drawing) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.drawing.destroy();
    this.drawing = null;
  }
}
