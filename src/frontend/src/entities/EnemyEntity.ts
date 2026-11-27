import type { EnemyDef } from "@/core/dataTypes";
import type { EnemyState, RunState, Systems } from "@/core/types";
import { RENDER_DEPTH, entityDepthAt } from "@/game/renderDepth";
import type Phaser from "phaser";
import { getAdventureSpecial } from "./adventureSpecialEnemies";

/** Phaser view. The rules layer owns position and collision. */
export class EnemyEntity {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly telegraph: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    key: string,
    origin: { x: number; y: number },
    shadowKey: string,
    readonly definition?: EnemyDef,
  ) {
    this.sprite = scene.add.sprite(0, 0, key).setOrigin(origin.x, origin.y);
    this.shadow = scene.add.image(0, 0, shadowKey).setOrigin(0.5);
    this.telegraph = scene.add
      .graphics()
      .setDepth(RENDER_DEPTH.legacyTelegraph);
  }

  sync(enemy: EnemyState, tileSize: number, state: RunState, sys: Systems) {
    const { x, y } = enemy;
    const depth = entityDepthAt(y, sys.world.heightTiles * tileSize);
    this.sprite
      .setPosition(x, y)
      .setDepth(depth)
      .setFlipX(enemy.dirX < 0);
    this.shadow
      .setPosition(x, y + 1)
      .setDepth(depth + RENDER_DEPTH.entityOffset.shadow);
    this.sprite.clearTint().setAlpha(1);
    if (this.telegraph.visible) this.telegraph.clear();
    if ((enemy.hurtTimer ?? 0) > 0)
      this.sprite.setTintFill(0xffffff).setAlpha(0.65);
    else if (enemy.phase === "windup") this.sprite.setTint(0xff9a8a);
    const special = getAdventureSpecial(
      enemy.enemyId,
      this.definition?.specialKey,
    );
    this.telegraph.setVisible(false);
    if (
      special?.renderOverlay &&
      (!special.isUnlocked ||
        (state && sys && special.isUnlocked(enemy, state, sys)))
    ) {
      this.telegraph.setVisible(true);
      special.renderOverlay(this.telegraph, enemy, tileSize);
    }
  }

  setActive(value: boolean) {
    this.sprite.setVisible(value).setActive(value);
    this.shadow.setVisible(value);
    this.telegraph.clear().setVisible(value);
  }
  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.telegraph.destroy();
  }
}
