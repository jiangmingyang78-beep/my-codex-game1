import type { AttackMove } from "@/core/dataTypes";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { currentMove } from "@/systems/combat/enemyAi";
import Phaser from "phaser";
import {
  COMBAT_FEEL_PRESETS,
  type TelegraphPreset,
  type WindupTimerMode,
} from "./combatFeelPresets";

interface Point2D {
  x: number;
  y: number;
}

interface SeedAttackView {
  kind: "sweep" | "lunge" | "charge" | "projectile" | "aoe";
  windupSec: number;
  rangeTiles: number;
  distanceTiles: number;
  arcDegrees: number;
  radiusTiles: number;
}

function resolveTelegraphMove(
  def: ReturnType<typeof getEnemy>,
  enemy: EnemyState,
): SeedAttackView | null {
  if (!def) {
    return null;
  }
  const meta = def as unknown as {
    seedType?: string;
    phases?: Array<{
      seedType?: string;
      overrides?: { attack?: Record<string, unknown> };
    }>;
    attack?: Record<string, unknown>;
  };

  if (meta.seedType) {
    const stage = meta.phases?.[enemy.wardenPhase ?? 0];
    const seedType = stage?.seedType ?? meta.seedType;
    const attack = {
      ...(meta.attack ?? {}),
      ...(stage?.overrides?.attack ?? {}),
    };
    const windupSec =
      typeof attack.windupSec === "number" ? attack.windupSec : 0.4;
    if (seedType === "lunge") {
      return {
        kind: "lunge",
        windupSec,
        rangeTiles:
          typeof attack.triggerTiles === "number" ? attack.triggerTiles : 2,
        distanceTiles:
          typeof attack.distanceTiles === "number" ? attack.distanceTiles : 2.5,
        arcDegrees: 100,
        radiusTiles: 1.2,
      };
    }
    if (seedType === "stalk_melee") {
      return {
        kind: "sweep",
        windupSec,
        rangeTiles:
          typeof attack.reachTiles === "number" ? attack.reachTiles : 1.5,
        distanceTiles: 1.5,
        arcDegrees: 130,
        radiusTiles: 1.2,
      };
    }
    if (seedType === "ranged_telegraph") {
      const mode = attack.mode;
      return {
        kind: mode === "aoe" ? "aoe" : "projectile",
        windupSec,
        rangeTiles:
          typeof attack.preferredTiles === "number" ? attack.preferredTiles : 5,
        distanceTiles: 5,
        arcDegrees: 100,
        radiusTiles:
          typeof attack.radiusTiles === "number" ? attack.radiusTiles : 1.2,
      };
    }
  }

  const move: AttackMove | undefined = currentMove(def, enemy);
  if (!move) {
    return null;
  }
  return {
    kind: move.type,
    windupSec: move.windupSec,
    rangeTiles: move.rangeTiles ?? move.triggerRangeTiles,
    distanceTiles: move.distanceTiles ?? move.triggerRangeTiles,
    arcDegrees: move.arcDegrees ?? 100,
    radiusTiles: 1.2,
  };
}

export class TelegraphLayer {
  private readonly scene: Phaser.Scene;
  private opts: TelegraphPreset;
  private graphics: Phaser.GameObjects.Graphics | null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: Partial<TelegraphPreset> = {}) {
    this.scene = scene;
    this.opts = { ...COMBAT_FEEL_PRESETS.telegraph, ...options };
    this.graphics = scene.add.graphics().setDepth(this.opts.groundDepth);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setTimerMode(mode: WindupTimerMode): void {
    this.opts = { ...this.opts, windupTimerMode: mode };
  }

  syncFromState(state: RunState, sys: Systems, timeSec: number): void {
    const g = this.graphics;
    if (!g || this.destroyed) {
      return;
    }

    g.clear();
    const tileSize = sys.data.tileSize;
    const enemies = Object.values(state.enemiesById);

    for (const enemy of enemies) {
      if (enemy.phase !== "windup" || enemy.hp <= 0) {
        continue;
      }
      const def = getEnemy(sys.data, enemy.enemyId);
      const move = resolveTelegraphMove(def, enemy);
      if (!move) {
        continue;
      }

      const windup = Math.max(1e-4, move.windupSec);
      const rawSec = enemy.phaseSec;
      const remaining =
        this.opts.windupTimerMode === "remaining"
          ? Phaser.Math.Clamp(rawSec, 0, windup)
          : Phaser.Math.Clamp(windup - rawSec, 0, windup);
      const progress = 1 - remaining / windup;

      const border =
        remaining <= this.opts.commitWindowSec &&
        Math.floor(timeSec * 30) % 2 === 0
          ? this.opts.commitFlashColor
          : this.opts.borderColor;

      this.drawMoveTelegraph(g, enemy, move, tileSize, progress, border);
    }
  }

  private drawMoveTelegraph(
    g: Phaser.GameObjects.Graphics,
    enemy: EnemyState,
    move: SeedAttackView,
    tileSize: number,
    progress: number,
    border: number,
  ): void {
    const lenRaw = Math.hypot(enemy.dirX, enemy.dirY);
    const ux = lenRaw > 1e-4 ? enemy.dirX / lenRaw : 1;
    const uy = lenRaw > 1e-4 ? enemy.dirY / lenRaw : 0;
    const ox = Math.round(enemy.x);
    const oy = Math.round(enemy.y);

    switch (move.kind) {
      case "sweep": {
        const radius = move.rangeTiles * tileSize;
        const halfArc = Phaser.Math.DegToRad(move.arcDegrees) / 2;
        const angle = Math.atan2(uy, ux);
        const startA = angle - halfArc;
        const endA = angle + halfArc;

        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.beginPath();
        g.slice(ox, oy, radius, startA, endA, false);
        g.closePath();
        g.fillPath();

        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.beginPath();
          g.slice(ox, oy, radius * progress, startA, endA, false);
          g.closePath();
          g.fillPath();
        }

        g.lineStyle(2, border, 1);
        g.beginPath();
        g.slice(ox, oy, radius, startA, endA, false);
        g.closePath();
        g.strokePath();
        break;
      }

      case "charge":
      case "lunge": {
        const length = move.distanceTiles * tileSize;
        const hw = this.opts.lineWidthPx / 2;
        const px = -uy;
        const py = ux;

        const buildQuad = (dist: number): Point2D[] => [
          { x: Math.round(ox + px * hw), y: Math.round(oy + py * hw) },
          {
            x: Math.round(ox + ux * dist + px * hw),
            y: Math.round(oy + uy * dist + py * hw),
          },
          {
            x: Math.round(ox + ux * dist - px * hw),
            y: Math.round(oy + uy * dist - py * hw),
          },
          { x: Math.round(ox - px * hw), y: Math.round(oy - py * hw) },
        ];

        const fullQuad = buildQuad(length);
        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.fillPoints(fullQuad, true);

        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.fillPoints(buildQuad(length * progress), true);
        }

        g.lineStyle(2, border, 1);
        g.strokePoints(fullQuad, true);
        break;
      }

      case "aoe": {
        const hasAim =
          typeof enemy.aimX === "number" &&
          Number.isFinite(enemy.aimX) &&
          typeof enemy.aimY === "number" &&
          Number.isFinite(enemy.aimY);
        const tx = Math.round(hasAim ? (enemy.aimX as number) : ox);
        const ty = Math.round(hasAim ? (enemy.aimY as number) : oy);
        const radius = move.radiusTiles * tileSize;

        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.fillCircle(tx, ty, radius);
        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.fillCircle(tx, ty, radius * progress);
        }
        g.lineStyle(2, border, 1);
        g.strokeCircle(tx, ty, radius);
        break;
      }

      case "projectile": {
        const hasAim =
          typeof enemy.aimX === "number" &&
          Number.isFinite(enemy.aimX) &&
          typeof enemy.aimY === "number" &&
          Number.isFinite(enemy.aimY);
        const tx = Math.round(
          hasAim
            ? (enemy.aimX as number)
            : ox + ux * move.rangeTiles * tileSize,
        );
        const ty = Math.round(
          hasAim
            ? (enemy.aimY as number)
            : oy + uy * move.rangeTiles * tileSize,
        );

        const dx = tx - ox;
        const dy = ty - oy;
        const totalDist = Math.hypot(dx, dy);
        if (totalDist > 1e-4) {
          const dirX = dx / totalDist;
          const dirY = dy / totalDist;
          g.lineStyle(2, border, this.opts.projectileAimAlpha);
          for (let d = 0; d < totalDist; d += 14) {
            const segEnd = Math.min(d + 8, totalDist);
            g.lineBetween(
              Math.round(ox + dirX * d),
              Math.round(oy + dirY * d),
              Math.round(ox + dirX * segEnd),
              Math.round(oy + dirY * segEnd),
            );
          }
          if (progress > 0) {
            g.lineStyle(2, border, 1);
            g.lineBetween(
              ox,
              oy,
              Math.round(ox + dx * progress),
              Math.round(oy + dy * progress),
            );
          }
        }

        const r = 6;
        const diamond: Point2D[] = [
          { x: tx, y: ty - r },
          { x: tx + r, y: ty },
          { x: tx, y: ty + r },
          { x: tx - r, y: ty },
        ];
        g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
        g.fillPoints(diamond, true);
        g.lineStyle(2, border, 1);
        g.strokePoints(diamond, true);
        break;
      }

      default:
        break;
    }
  }

  clear(): void {
    this.graphics?.clear();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.graphics?.destroy();
    this.graphics = null;
  }
}
