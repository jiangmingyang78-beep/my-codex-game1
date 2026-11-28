import type { RunState, Systems } from "@/core";
import { EnemyEntity } from "@/entities/EnemyEntity";
import { despawnAlpha, spawnRadii } from "@/systems/combat/spawnRules";
import { eternalEnemyMaxHp } from "@/systems/eternal/eternalSpawn";
import { isHeroDashActive, isHeroDashInvulnerable } from "@/systems/movement";
import { getBucklerCooldownSec } from "@/systems/survival";
import type Phaser from "phaser";
import { RENDER_DEPTH, entityDepthAt } from "../renderDepth";
import {
  TEX,
  type TextureGenerator,
  originOf,
  registerLootTextures,
} from "../textures/registerTextures";
import {
  type HeroAnimSignals,
  resolveHeroVisual,
  syncHeroAnimation,
} from "./heroAnimations";
import { LOOT_TINT } from "./lootTints";

const BAR_VIEW_MARGIN = 16;

/** Hero, enemies, ground loot and projectiles synchronized from RunState. */
export class EntityViews {
  readonly hero: Phaser.GameObjects.Sprite;
  private readonly heroShadow: Phaser.GameObjects.Image;
  private readonly heroShield: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastHeroId = "";
  private lastHp = -1;
  private hurtUntilSec = 0;
  private flashUntilSec = 0;
  private shieldDrawn = false;
  private readonly heroAnimState: HeroAnimSignals = {
    dead: false,
    hurt: false,
    dashing: false,
    attacking: false,
    moving: false,
    facingX: 0,
  };
  private readonly enemies = new Map<string, EnemyEntity>();
  private readonly loot = new Map<string, Phaser.GameObjects.Image>();
  private readonly freeLoot: Phaser.GameObjects.Image[] = [];
  private readonly freeShots: Phaser.GameObjects.Image[] = [];
  private readonly liveShots = new Set<string>();
  private readonly freeEnemies = new Map<string, EnemyEntity[]>();
  private readonly shots = new Map<string, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sys: Systems,
    gen: TextureGenerator,
    heroId: string,
  ) {
    registerLootTextures(scene, gen, LOOT_TINT);
    const visual = resolveHeroVisual(scene, heroId);
    this.lastHeroId = heroId;
    this.hero = scene.add
      .sprite(0, 0, visual.textureKey)
      .setOrigin(visual.originX, visual.originY)
      .setScale(1);
    this.heroShadow = this.shadow();
    this.heroShield = scene.add.graphics();
    this.bars = scene.add.graphics().setDepth(RENDER_DEPTH.enemyHealth);
  }

  private shadow(): Phaser.GameObjects.Image {
    return this.scene.add.image(0, 0, TEX.shadow).setOrigin(0.5, 0.5);
  }

  enemySprite(enemyId: string): Phaser.GameObjects.Sprite | null {
    return this.enemies.get(enemyId)?.sprite ?? null;
  }

  sync(state: RunState, timeSec: number): void {
    this.syncHero(state, timeSec);
    this.syncEnemies(state);
    this.syncLoot(state, timeSec);
    this.liveShots.clear();
    for (const shot of state.projectiles) {
      this.liveShots.add(shot.id);
      let image = this.shots.get(shot.id);
      if (!image) {
        image =
          this.freeShots.pop() ??
          this.scene.add
            .image(0, 0, TEX.projectile)
            .setDepth(RENDER_DEPTH.projectile);
        image.setVisible(true);
        this.shots.set(shot.id, image);
      }
      image.setPosition(shot.x, shot.y);
    }
    for (const [id, image] of this.shots)
      if (!this.liveShots.has(id)) {
        this.freeShots.push(image.setVisible(false));
        this.shots.delete(id);
      }
  }

  private syncHero(state: RunState, timeSec: number): void {
    const { hero } = state;
    const visual = resolveHeroVisual(this.scene, state.heroId);
    if (
      this.hero.texture.key !== visual.textureKey ||
      this.lastHeroId !== state.heroId
    ) {
      if (visual.kind === "static" && this.hero.anims.isPlaying)
        this.hero.stop();
      this.hero
        .setTexture(visual.textureKey)
        .setOrigin(visual.originX, visual.originY)
        .setScale(1);
      this.lastHeroId = state.heroId;
      this.lastHp = hero.hp;
    }
    if (this.lastHp >= 0 && hero.hp < this.lastHp) {
      this.hurtUntilSec = timeSec + 0.22;
      this.flashUntilSec = timeSec + 0.09;
    }
    this.lastHp = hero.hp;

    const moving =
      Number.isFinite(this.lastX) &&
      Math.hypot(hero.x - this.lastX, hero.y - this.lastY) > 0.15;
    this.lastX = hero.x;
    this.lastY = hero.y;

    const dead = state.status === "dead";
    const dashActive = !dead && isHeroDashActive(state);
    const dashInvuln = !dead && isHeroDashInvulnerable(state);

    const px = Math.round(hero.x);
    const py = Math.round(hero.y);
    const { heightTiles, tileSize } = this.sys.world;
    const depth = entityDepthAt(hero.y, heightTiles * tileSize);
    if (this.hero.depth !== depth) this.hero.setDepth(depth);

    let bodyY = py;
    if (visual.kind === "sheet") {
      this.hero.setPosition(px, py);
      const anim = this.heroAnimState;
      anim.dead = dead;
      anim.hurt = !dead && timeSec < this.hurtUntilSec;
      anim.dashing = dashActive;
      anim.attacking = !dead && hero.attackAnimSec > 0;
      anim.moving = moving;
      anim.facingX = hero.facingX;
      syncHeroAnimation(this.hero, state.heroId, anim);
    } else {
      bodyY =
        py + (!dead && moving ? Math.round(Math.sin(timeSec * 16) * 0.6) : 0);
      this.hero.setPosition(px, bodyY);
      if (Math.abs(hero.facingX) > 0.05) this.hero.setFlipX(hero.facingX < 0);
    }

    const blinking =
      !dead && hero.invulnerableSec > 0 && Math.floor(timeSec * 16) % 2 === 0;
    this.hero.setAlpha(dashInvuln ? 0.4 : blinking ? 0.35 : 1);
    if (!dead && timeSec < this.flashUntilSec) this.hero.setTintFill(0xffffff);
    else if (dashInvuln) this.hero.setTint(0x9fd8ff);
    else this.hero.clearTint();

    this.heroShadow.setPosition(px, py + 1);
    const shadowDepth = depth + RENDER_DEPTH.entityOffset.shadow;
    if (this.heroShadow.depth !== shadowDepth)
      this.heroShadow.setDepth(shadowDepth);
    if (this.shieldDrawn) this.heroShield.clear();
    const bucklerCd = getBucklerCooldownSec(state, this.sys);
    this.shieldDrawn = !dead && bucklerCd !== null && bucklerCd <= 0;
    if (this.shieldDrawn) {
      const faceAngle = Math.atan2(
        hero.facingY,
        hero.facingX || (hero.facingY ? 0 : 1),
      );
      const halfArc = (52 * Math.PI) / 180;
      const alpha = 0.72 + Math.sin(timeSec * 5) * 0.14;
      const shieldDepth = depth + RENDER_DEPTH.entityOffset.shield;
      if (this.heroShield.depth !== shieldDepth)
        this.heroShield.setDepth(shieldDepth);
      this.heroShield
        .lineStyle(1, 0xb8d8f0, alpha)
        .beginPath()
        .arc(px, bodyY - 6, 9, faceAngle - halfArc, faceAngle + halfArc, false)
        .strokePath();
    }
  }

  private syncEnemies(state: RunState): void {
    this.bars.clear();
    const view = this.scene.cameras.main.worldView;
    const hasView = view.width > 0 && view.height > 0;
    const { despawn } = spawnRadii(
      this.sys.data.balance.survival,
      this.sys.data.tileSize,
      this.sys.spawnView,
    );
    for (const [id, body] of this.enemies) {
      if (state.enemiesById[id]) continue;
      const key = body.sprite.texture.key;
      let bucket = this.freeEnemies.get(key);
      if (!bucket) {
        bucket = [];
        this.freeEnemies.set(key, bucket);
      }
      body.setActive(false);
      bucket.push(body);
      this.enemies.delete(id);
    }
    for (const id in state.enemiesById) {
      const e = state.enemiesById[id];
      let body = this.enemies.get(e.id);
      if (!body) {
        const key = TEX.enemy(e.enemyId);
        const o = originOf(key);
        body =
          this.freeEnemies.get(key)?.pop() ??
          new EnemyEntity(
            this.scene,
            key,
            o,
            TEX.shadow,
            this.sys.data.enemies.get(e.enemyId),
          );
        body.setActive(true);
        this.enemies.set(e.id, body);
      }
      body.sync(e, this.sys.data.tileSize, state, this.sys);
      const alpha = despawnAlpha(
        e,
        state.hero,
        despawn,
        this.sys.data.tileSize,
      );
      body.sprite.setAlpha(body.sprite.alpha * alpha);
      body.shadow.setAlpha(alpha);
      body.telegraph.setAlpha(alpha);
      if (
        hasView &&
        (e.x < view.left - BAR_VIEW_MARGIN ||
          e.x > view.right + BAR_VIEW_MARGIN ||
          e.y < view.top - BAR_VIEW_MARGIN ||
          e.y > view.bottom + BAR_VIEW_MARGIN)
      )
        continue;
      const max =
        eternalEnemyMaxHp(e) ??
        this.sys.data.enemies.get(e.enemyId)?.maxHp ??
        e.hp;
      if (e.hp < max) this.drawBar(e.x, e.y - 14, e.hp / max);
    }
  }

  private drawBar(x: number, y: number, ratio: number): void {
    this.bars.fillStyle(0x1e1d2e, 1).fillRect(x - 7, y, 14, 3);
    this.bars
      .fillStyle(0xe0485a, 1)
      .fillRect(x - 6, y + 1, Math.max(0, 12 * ratio), 1);
  }

  private syncLoot(state: RunState, timeSec: number): void {
    for (const id of this.loot.keys()) {
      if (Object.hasOwn(state.groundLoot, id)) continue;
      this.freeLoot.push(this.loot.get(id)!.setVisible(false));
      this.loot.delete(id);
    }
    for (const id in state.groundLoot) {
      if (!Object.hasOwn(state.groundLoot, id)) continue;
      const item = state.groundLoot[id];
      let image = this.loot.get(id);
      if (!image) {
        const key = Object.hasOwn(LOOT_TINT, item.itemId)
          ? TEX.lootByItem(item.itemId)
          : TEX.lootOrb;
        const origin = originOf(key);
        image =
          this.freeLoot.pop()?.setTexture(key).setVisible(true).setToTop() ??
          this.scene.add.image(0, 0, key);
        image.setOrigin(origin.x, origin.y).setDepth(RENDER_DEPTH.groundLoot);
        this.loot.set(id, image);
      }
      image.setPosition(
        item.x,
        item.y - 2 + Math.sin(timeSec * 4 + item.x) * 1.5,
      );
    }
  }
}
