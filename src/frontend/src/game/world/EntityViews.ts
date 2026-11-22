import type { RunState, Systems } from "@/core";
import type Phaser from "phaser";
import { TEX, originOf } from "../textures/registerTextures";

interface Body {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

const LOOT_TINT: Record<string, number> = {
  berry: 0xe0485a,
  ration: 0xe0a05a,
  warm_stew: 0xe08a4a,
  bandage: 0xf4f0e8,
  ember_seal: 0xff7a3a,
  ingot: 0xaecdf0,
};

/** Hero, enemies, ground loot and projectiles, rebuilt from RunState every frame. */
export class EntityViews {
  readonly hero: Phaser.GameObjects.Image;
  private readonly heroShadow: Phaser.GameObjects.Image;
  private readonly slash: Phaser.GameObjects.Image;
  private readonly bars: Phaser.GameObjects.Graphics;
  private lastX = 0;
  private lastY = 0;
  private readonly enemies = new Map<string, Body>();
  private readonly loot = new Map<string, Phaser.GameObjects.Image>();
  private readonly shots = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sys: Systems,
  ) {
    const o = originOf(TEX.hero);
    this.hero = scene.add.image(0, 0, TEX.hero).setOrigin(o.x, o.y);
    this.heroShadow = this.shadow();
    this.slash = scene.add
      .image(0, 0, TEX.slash)
      .setOrigin(originOf(TEX.slash).x, 0.5)
      .setVisible(false);
    this.bars = scene.add.graphics();
  }

  private shadow(): Phaser.GameObjects.Image {
    return this.scene.add.image(0, 0, TEX.shadow).setOrigin(0.5, 0.5);
  }

  sync(state: RunState, timeSec: number): void {
    this.syncHero(state, timeSec);
    this.syncEnemies(state);
    this.syncSet(this.loot, state.groundLoot, (l) => ({
      key: TEX.lootOrb,
      x: l.x,
      y: l.y - 2 + Math.sin(timeSec * 4 + l.x) * 1.5,
      tint: LOOT_TINT[l.itemId] ?? 0xe8d8a8,
    }));
    this.syncSet(
      this.shots,
      Object.fromEntries(state.projectiles.map((p) => [p.id, p])),
      (p) => ({
        key: TEX.projectile,
        x: p.x,
        y: p.y,
        tint: 0xffffff,
      }),
    );
  }

  private syncHero(state: RunState, timeSec: number): void {
    const { hero } = state;
    const moving =
      Math.abs(hero.x - this.lastX) + Math.abs(hero.y - this.lastY) > 0.05;
    this.lastX = hero.x;
    this.lastY = hero.y;
    const y = hero.y + (moving ? Math.sin(timeSec * 16) * 0.6 : 0);
    this.hero
      .setPosition(hero.x, y)
      .setDepth(hero.y)
      .setFlipX(hero.facingX < 0);
    this.hero.setAlpha(
      hero.invulnerableSec > 0 && Math.floor(timeSec * 16) % 2 === 0 ? 0.35 : 1,
    );
    this.heroShadow.setPosition(hero.x, hero.y + 1).setDepth(hero.y - 0.5);
    const swinging = hero.attackAnimSec > 0;
    this.slash.setVisible(swinging);
    if (swinging) {
      const angle = Math.atan2(
        hero.facingY,
        hero.facingX || (hero.facingY ? 0 : 1),
      );
      this.slash
        .setPosition(
          hero.x + Math.cos(angle) * 6,
          hero.y - 6 + Math.sin(angle) * 6,
        )
        .setRotation(angle)
        .setDepth(hero.y + 1);
    }
  }

  private syncEnemies(state: RunState): void {
    this.bars.clear().setDepth(4000);
    for (const [id, body] of this.enemies) {
      if (state.enemiesById[id]) continue;
      body.sprite.destroy();
      body.shadow.destroy();
      this.enemies.delete(id);
    }
    for (const e of Object.values(state.enemiesById)) {
      let body = this.enemies.get(e.id);
      if (!body) {
        const key = TEX.enemy(e.enemyId);
        const o = originOf(key);
        body = {
          sprite: this.scene.add.image(0, 0, key).setOrigin(o.x, o.y),
          shadow: this.shadow(),
        };
        this.enemies.set(e.id, body);
      }
      body.sprite
        .setPosition(e.x, e.y)
        .setDepth(e.y)
        .setFlipX(e.dirX < 0);
      if (e.phase === "windup") body.sprite.setTint(0xff9a8a);
      else body.sprite.clearTint();
      body.shadow.setPosition(e.x, e.y + 1).setDepth(e.y - 0.5);
      const max = this.sys.data.enemies.get(e.enemyId)?.maxHp ?? e.hp;
      if (e.hp < max) this.drawBar(e.x, e.y - 14, e.hp / max);
    }
  }

  private drawBar(x: number, y: number, ratio: number): void {
    this.bars.fillStyle(0x1e1d2e, 1).fillRect(x - 7, y, 14, 3);
    this.bars
      .fillStyle(0xe0485a, 1)
      .fillRect(x - 6, y + 1, Math.max(0, 12 * ratio), 1);
  }

  private syncSet<T extends { x: number; y: number }>(
    views: Map<string, Phaser.GameObjects.Image>,
    items: Record<string, T>,
    look: (item: T) => { key: string; x: number; y: number; tint: number },
  ): void {
    for (const [id, image] of views) {
      if (items[id]) continue;
      image.destroy();
      views.delete(id);
    }
    for (const [id, item] of Object.entries(items)) {
      const l = look(item);
      let image = views.get(id);
      if (!image) {
        const o = originOf(l.key);
        image = this.scene.add
          .image(0, 0, l.key)
          .setOrigin(o.x, o.y)
          .setTint(l.tint);
        views.set(id, image);
      }
      image.setPosition(l.x, l.y).setDepth(item.y);
    }
  }
}
