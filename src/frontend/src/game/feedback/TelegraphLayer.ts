import type { AttackMove, EnemyDef } from "@/core/dataTypes";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { ratio01, safeUnit } from "@/systems/combat/combatMath";
import { currentMove } from "@/systems/combat/enemyAi";
import Phaser from "phaser";
import { TelegraphDrawing } from "./TelegraphDrawing";
import { COMBAT_FEEL_PRESETS, type TelegraphPreset } from "./combatFeelPresets";

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
  private drawing: TelegraphDrawing | null;

  constructor(scene: Phaser.Scene, options: Partial<TelegraphPreset> = {}) {
    this.scene = scene;
    this.opts = { ...COMBAT_FEEL_PRESETS.telegraph, ...options };
    this.drawing = new TelegraphDrawing(scene, this.opts);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  syncFromState(state: RunState, sys: Systems, _timeSec: number): void {
    const drawing = this.drawing;
    if (!drawing) return;
    drawing.begin();
    const tileSize = sys.data.tileSize;
    const commits: {
      enemy: EnemyState;
      move: SeedAttackView;
      progress: number;
    }[] = [];

    for (const id in state.enemiesById) {
      const enemy = state.enemiesById[id];
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
        this.drawMoveTelegraph(drawing, enemy, move, tileSize, progress, false);
      }
    }
    for (const { enemy, move, progress } of commits) {
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
    const { x: ux, y: uy } = safeUnit(enemy.dirX, enemy.dirY);
    const ox = Math.round(enemy.x);
    const oy = Math.round(enemy.y);
    if (move.kind === "charge" || move.kind === "lunge") {
      drawing.linear(
        ox,
        oy,
        ux,
        uy,
        move.distanceTiles * tileSize,
        progress,
        committing,
      );
      return;
    }

    const g = drawing.path();
    const border = committing
      ? this.opts.commitFlashColor
      : this.opts.borderColor;
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
        const diamond = [
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
    if (!this.drawing) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.drawing.destroy();
    this.drawing = null;
  }
}
