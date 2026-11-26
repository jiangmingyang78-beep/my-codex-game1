import { ENEMY_RADIUS } from "@/systems/combat/combatMath";
import { getAdventureSpecial } from "./adventureSpecialEnemies";

/** Phaser view and body. The rules layer owns position and tile collision. */
export class EnemyEntity {
  constructor(scene, key, origin, shadowKey, definition) {
    this.definition = definition;
    this.sprite = scene.add.sprite(0, 0, key).setOrigin(origin.x, origin.y);
    this.shadow = scene.add.image(0, 0, shadowKey).setOrigin(0.5);
    this.telegraph = scene.add.graphics().setDepth(0);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body;
    this.body.moves = false;
    this.body.setCircle(
      ENEMY_RADIUS,
      this.sprite.width * origin.x - ENEMY_RADIUS,
      this.sprite.height * origin.y - ENEMY_RADIUS,
    );
  }

  sync(enemy, tileSize, state, sys) {
    const { x, y } = enemy;
    this.sprite
      .setPosition(x, y)
      .setDepth(y)
      .setFlipX(enemy.dirX < 0);
    this.shadow.setPosition(x, y + 1).setDepth(y - 0.5);
    this.body.updateFromGameObject();
    this.sprite.clearTint().setAlpha(1);
    this.telegraph.clear();
    if (enemy.hurtTimer > 0) this.sprite.setTintFill(0xffffff).setAlpha(0.65);
    else if (enemy.phase === "windup") this.sprite.setTint(0xff9a8a);
    if (enemy.phase === "windup") this.drawTelegraph(enemy, tileSize);
    const special = getAdventureSpecial(
      enemy.enemyId,
      this.definition?.specialKey,
    );
    if (
      special &&
      (!special.isUnlocked ||
        (state && sys && special.isUnlocked(enemy, state, sys)))
    ) {
      special.renderOverlay?.(this.telegraph, enemy, tileSize);
    }
  }

  drawTelegraph(enemy, tileSize) {
    const { x, y } = enemy;
    const g = this.telegraph;
    const stage = this.definition?.phases?.[enemy.wardenPhase ?? 0];
    const type = stage?.seedType ?? this.definition?.seedType;
    const attack = stage?.overrides?.attack ?? this.definition?.attack;
    if (!attack) return;
    const progress = Math.min(
      1,
      Math.max(0, 1 - enemy.phaseSec / Math.max(attack.windupSec ?? 0, 0.05)),
    );
    const color = progress > 0.75 ? 0xff5a2a : 0xffb074;
    if (type === "lunge") {
      const length = attack.distanceTiles * tileSize;
      const w = ENEMY_RADIUS + 4;
      const { dirX, dirY } = enemy;
      const band = (l) => [
        { x: x - dirY * w, y: y + dirX * w },
        { x: x + dirX * l - dirY * w, y: y + dirY * l + dirX * w },
        { x: x + dirX * l + dirY * w, y: y + dirY * l - dirX * w },
        { x: x + dirY * w, y: y - dirX * w },
      ];
      g.fillStyle(color, 0.4).fillPoints(band(length * progress), true);
      g.lineStyle(1.5, color, 0.9).strokePoints(band(length), true);
      const ex = x + dirX * length;
      const ey = y + dirY * length;
      g.fillStyle(color, 0.9).fillTriangle(
        ex + dirX * 8,
        ey + dirY * 8,
        ex - dirY * (w + 3),
        ey + dirX * (w + 3),
        ex + dirY * (w + 3),
        ey - dirX * (w + 3),
      );
    } else if (type === "stalk_melee") {
      const reach = attack.reachTiles * tileSize;
      const angle = Math.atan2(enemy.dirY, enemy.dirX);
      const half = (65 * Math.PI) / 180;
      const fan = (radius) => {
        g.beginPath().moveTo(x, y);
        g.arc(x, y, radius, angle - half, angle + half, false);
        g.closePath();
      };
      if (progress > 0.02) {
        fan(reach * progress);
        g.fillStyle(color, progress > 0.75 ? 0.55 : 0.32).fillPath();
      }
      fan(reach);
      g.lineStyle(1.5, color, 0.9).strokePath();
    } else if (
      type === "ranged_telegraph" &&
      enemy.aimX !== undefined &&
      enemy.aimY !== undefined
    ) {
      if (attack.mode === "aoe") {
        const radius = (attack.radiusTiles ?? 1.2) * tileSize;
        g.fillStyle(0xff685c, 0.24).fillCircle(enemy.aimX, enemy.aimY, radius);
        g.lineStyle(2, 0xff685c, 0.88).strokeCircle(
          enemy.aimX,
          enemy.aimY,
          radius,
        );
      } else {
        g.lineStyle(1, 0xffd487, 0.72).lineBetween(
          x,
          y,
          enemy.aimX,
          enemy.aimY,
        );
        g.strokeCircle(enemy.aimX, enemy.aimY, 4);
      }
    }
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
  }
}
