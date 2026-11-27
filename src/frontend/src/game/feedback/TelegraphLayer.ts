import type { AttackMove, EnemyDef } from "@/core/dataTypes";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { ratio01, safeUnit } from "@/systems/combat/combatMath";
import { currentMove } from "@/systems/combat/enemyAi";
import Phaser from "phaser";
import { COMBAT_FEEL_PRESETS, type TelegraphPreset } from "./combatFeelPresets";

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
  def: EnemyDef | undefined,
  enemy: EnemyState,
): SeedAttackView | null {
  if (!def) return null;

  if (def.seedType) {
    const stage = def.phases?.[enemy.wardenPhase ?? 0];
    const seedType = stage?.seedType ?? def.seedType;
    const attack = stage?.overrides?.attack
      ? { ...def.attack, ...stage.overrides.attack }
      : def.attack;
    const windupSec = attack.windupSec ?? 0.4;

    if (seedType === "lunge") {
      return {
        kind: "lunge",
        windupSec,
        rangeTiles: attack.triggerTiles ?? 2,
        distanceTiles: attack.distanceTiles ?? 2.5,
        arcDegrees: 100,
        radiusTiles: 1.2,
      };
    }
    if (seedType === "stalk_melee") {
      return {
        kind: "sweep",
        windupSec,
        rangeTiles: attack.reachTiles ?? 1.5,
        distanceTiles: 1.5,
        arcDegrees: 130,
        radiusTiles: 1.2,
      };
    }
    if (seedType === "ranged_telegraph") {
      return {
        kind: attack.mode === "aoe" ? "aoe" : "projectile",
        windupSec,
        rangeTiles: attack.preferredTiles ?? 5,
        distanceTiles: 5,
        arcDegrees: 100,
        radiusTiles: attack.radiusTiles ?? 1.2,
      };
    }
  }

  const move: AttackMove | undefined = currentMove(def, enemy);
  if (!move) return null;
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
  private readonly opts: TelegraphPreset;
  private graphics: Phaser.GameObjects.Graphics | null;

  constructor(scene: Phaser.Scene, options: Partial<TelegraphPreset> = {}) {
    this.scene = scene;
    this.opts = { ...COMBAT_FEEL_PRESETS.telegraph, ...options };
    this.graphics = scene.add.graphics().setDepth(this.opts.groundDepth);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  syncFromState(state: RunState, sys: Systems, _timeSec: number): void {
    const g = this.graphics;
    if (!g) return;

    g.clear();
    const tileSize = sys.data.tileSize;
    const commits: {
      enemy: EnemyState;
      move: SeedAttackView;
      progress: number;
    }[] = [];

    for (const enemy of Object.values(state.enemiesById)) {
      if (enemy.phase !== "windup" || enemy.hp <= 0) continue;
      const move = resolveTelegraphMove(
        getEnemy(sys.data, enemy.enemyId),
        enemy,
      );
      if (!move) continue;

      const windup = Math.max(1e-4, move.windupSec);
      const remaining =
        this.opts.windupTimerMode === "remaining"
          ? Phaser.Math.Clamp(enemy.phaseSec, 0, windup)
          : Phaser.Math.Clamp(windup - enemy.phaseSec, 0, windup);
      const progress = 1 - ratio01(remaining, windup);

      if (remaining <= this.opts.commitWindowSec) {
        commits.push({ enemy, move, progress });
      } else {
        this.drawMoveTelegraph(
          g,
          enemy,
          move,
          tileSize,
          progress,
          this.opts.borderColor,
        );
      }
    }
    for (const { enemy, move, progress } of commits) {
      this.drawMoveTelegraph(
        g,
        enemy,
        move,
        tileSize,
        progress,
        this.opts.commitFlashColor,
      );
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
    const { x: ux, y: uy } = safeUnit(enemy.dirX, enemy.dirY);
    const ox = Math.round(enemy.x);
    const oy = Math.round(enemy.y);
    // Leave one dark world pixel on each side so even the white commit edge reads on snow.
    const stroke = (draw: () => void, alpha = 1): void => {
      g.lineStyle(4, this.opts.outlineColor, alpha);
      draw();
      g.lineStyle(2, border, alpha);
      draw();
    };

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

        stroke(() => {
          g.beginPath();
          g.slice(ox, oy, radius, startA, endA, false);
          g.closePath();
          g.strokePath();
        });
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

        stroke(() => g.strokePoints(fullQuad, true));
        break;
      }

      case "aoe": {
        const tx = Math.round(enemy.aimX ?? ox);
        const ty = Math.round(enemy.aimY ?? oy);
        const radius = move.radiusTiles * tileSize;

        g.fillStyle(this.opts.fillColor, this.opts.fillAlpha);
        g.fillCircle(tx, ty, radius);
        if (progress > 0) {
          g.fillStyle(this.opts.fillColor, this.opts.progressAlpha);
          g.fillCircle(tx, ty, radius * progress);
        }
        stroke(() => g.strokeCircle(tx, ty, radius));
        break;
      }

      case "projectile": {
        const tx = Math.round(
          enemy.aimX ?? ox + ux * move.rangeTiles * tileSize,
        );
        const ty = Math.round(
          enemy.aimY ?? oy + uy * move.rangeTiles * tileSize,
        );

        const dx = tx - ox;
        const dy = ty - oy;
        const totalDist = Math.hypot(dx, dy);
        if (totalDist > 1e-4) {
          const { x: dirX, y: dirY } = safeUnit(dx, dy);
          stroke(() => {
            for (let d = 0; d < totalDist; d += 14) {
              const segEnd = Math.min(d + 8, totalDist);
              g.lineBetween(
                Math.round(ox + dirX * d),
                Math.round(oy + dirY * d),
                Math.round(ox + dirX * segEnd),
                Math.round(oy + dirY * segEnd),
              );
            }
          }, this.opts.projectileAimAlpha);
          if (progress > 0) {
            stroke(() =>
              g.lineBetween(
                ox,
                oy,
                Math.round(ox + dx * progress),
                Math.round(oy + dy * progress),
              ),
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
        stroke(() => g.strokePoints(diamond, true));
        break;
      }
    }
  }

  destroy(): void {
    if (!this.graphics) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.graphics.destroy();
    this.graphics = null;
  }
}
