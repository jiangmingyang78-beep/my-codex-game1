import heroSpritesJson from "@/data/heroSprites.json";
import Phaser from "phaser";
import { TEX, originOf } from "../textures/registerTextures";

export type HeroAnimName =
  | "idle"
  | "walk"
  | "attack"
  | "dash"
  | "hurt"
  | "dead";

export interface HeroAnimRange {
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
}

export interface HeroSpriteSpec {
  file: string;
  enabled: boolean;
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  anims: Record<HeroAnimName, HeroAnimRange>;
}

export type HeroVisual =
  | {
      kind: "sheet";
      textureKey: string;
      originX: number;
      originY: number;
      animPrefix: string;
    }
  | {
      kind: "static";
      textureKey: string;
      originX: number;
      originY: number;
    };

export interface HeroAnimSignals {
  dead: boolean;
  hurt: boolean;
  dashing: boolean;
  attacking: boolean;
  moving: boolean;
  facingX: number;
}

const HERO_SPRITES = heroSpritesJson as Record<string, HeroSpriteSpec>;
const ANIM_NAMES: readonly HeroAnimName[] = [
  "idle",
  "walk",
  "attack",
  "dash",
  "hurt",
  "dead",
];

/** Tracks keys whose spritesheet failed to load so fallback triggers without retry spam. */
const failedSheets = new Set<string>();

const sheetKeyOf = (heroId: string): string => `hero_sheet:${heroId}`;
const animPrefixOf = (heroId: string): string => `hero_anim:${heroId}`;
const animKeyOf = (heroId: string, anim: HeroAnimName): string =>
  `hero_anim:${heroId}:${anim}`;

function hasLoadedSheet(
  scene: Phaser.Scene,
  heroId: string,
  spec: HeroSpriteSpec | undefined,
): spec is HeroSpriteSpec {
  if (!spec?.enabled) return false;
  const key = sheetKeyOf(heroId);
  if (failedSheets.has(key) || !scene.textures.exists(key)) return false;
  const tex = scene.textures.get(key);
  return Boolean(tex && tex.key !== "__MISSING" && tex.frameTotal > 1);
}

/** Queues enabled hero spritesheets into Phaser's loader, skipping already cached sheets. */
export function preloadHeroSpritesheets(scene: Phaser.Scene): void {
  const queued = new Set<string>();
  for (const [heroId, spec] of Object.entries(HERO_SPRITES)) {
    if (!spec.enabled) continue;
    const key = sheetKeyOf(heroId);
    if (failedSheets.has(key) || scene.textures.exists(key)) continue;
    const url = `${import.meta.env.BASE_URL}assets/sprites/heroes/${spec.file}`;
    queued.add(key);
    scene.load.spritesheet(key, url, {
      frameWidth: spec.frameWidth,
      frameHeight: spec.frameHeight,
    });
  }
  if (queued.size === 0) return;

  const onError = (file: Phaser.Loader.File): void => {
    if (!queued.has(file.key) || failedSheets.has(file.key)) return;
    failedSheets.add(file.key);
    console.warn(
      `[heroAnimations] 英雄精灵表加载失败，已降级为程序化贴图: ${file.key}`,
    );
  };
  scene.load.on("loaderror", onError);
  scene.load.once("complete", () => {
    scene.load.off("loaderror", onError);
  });
}

/** Idempotently registers animations and enforces NEAREST pixel filtering on loaded sheets. */
export function registerHeroAnimations(scene: Phaser.Scene): void {
  for (const [heroId, spec] of Object.entries(HERO_SPRITES)) {
    if (!hasLoadedSheet(scene, heroId, spec)) continue;
    const sheetKey = sheetKeyOf(heroId);
    scene.textures.get(sheetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const animName of ANIM_NAMES) {
      const key = animKeyOf(heroId, animName);
      if (scene.anims.exists(key)) continue;
      const cfg = spec.anims[animName];
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(sheetKey, {
          start: cfg.start,
          end: cfg.end,
        }),
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      });
    }
  }
}

/** Resolves either the loaded multi-frame spritesheet or the procedural static fallback. */
export function resolveHeroVisual(
  scene: Phaser.Scene,
  heroId: string,
): HeroVisual {
  const spec = HERO_SPRITES[heroId];
  if (hasLoadedSheet(scene, heroId, spec)) {
    return {
      kind: "sheet",
      textureKey: sheetKeyOf(heroId),
      originX: spec.originX,
      originY: spec.originY,
      animPrefix: animPrefixOf(heroId),
    };
  }
  const textureKey = TEX.heroById(heroId);
  const origin = originOf(textureKey);
  return {
    kind: "static",
    textureKey,
    originX: origin.x,
    originY: origin.y,
  };
}

/** Drives the presentation-only hero animation state machine without restarting active clips. */
export function syncHeroAnimation(
  sprite: Phaser.GameObjects.Sprite,
  heroId: string,
  signals: HeroAnimSignals,
): void {
  if (Math.abs(signals.facingX) > 0.05) {
    sprite.setFlipX(signals.facingX < 0);
  }
  const next: HeroAnimName = signals.dead
    ? "dead"
    : signals.hurt
      ? "hurt"
      : signals.dashing
        ? "dash"
        : signals.attacking
          ? "attack"
          : signals.moving
            ? "walk"
            : "idle";
  const targetKey = animKeyOf(heroId, next);
  if (!sprite.scene.anims.exists(targetKey)) return;
  if (sprite.anims.currentAnim?.key !== targetKey) {
    sprite.play(targetKey, true);
  }
}
