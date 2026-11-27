import { RENDER_DEPTH, entityDepthAt } from "@/game/renderDepth";
import { ENEMY_RADIUS } from "@/systems/combat/combatMath";
import { getAdventureSpecial } from "./adventureSpecialEnemies";

/** Phaser view and body. The rules layer owns position and tile collision. */
export class EnemyEntity {
  constructor(scene, key, origin, shadowKey, definition) {
    this.definition = definition;
    this.sprite = scene.add.sprite(0, 0, key).setOrigin(origin.x, origin.y);
    this.shadow = scene.add.image(0, 0, shadowKey).setOrigin(0.5);
    this.telegraph = scene.add
      .graphics()
      .setDepth(RENDER_DEPTH.legacyTelegraph);
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
    const depth = entityDepthAt(y, sys.world.heightTiles * tileSize);
    this.sprite
      .setPosition(x, y)
      .setDepth(depth)
      .setFlipX(enemy.dirX < 0);
    this.shadow
      .setPosition(x, y + 1)
      .setDepth(depth + RENDER_DEPTH.entityOffset.shadow);
    this.body.updateFromGameObject();
    this.sprite.clearTint().setAlpha(1);
    this.telegraph.clear();
    if (enemy.hurtTimer > 0) this.sprite.setTintFill(0xffffff).setAlpha(0.65);
    else if (enemy.phase === "windup") this.sprite.setTint(0xff9a8a);
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

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
  }
}
