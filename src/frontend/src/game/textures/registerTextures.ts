import { loadGameData } from "@/core/gameData";
import { ENEMY_TEXTURE_DEFS } from "@/shared/monsterCatalog.js";
import {
  type createTextureGenerator,
  registerCanvasTexture,
} from "@/vfx/proceduralTextures";
import type Phaser from "phaser";
import { PIXEL_SPRITES } from "./spriteArt";

export type TextureGenerator = ReturnType<typeof createTextureGenerator>;

const enemyTextureKeys = new Set(ENEMY_TEXTURE_DEFS.map(({ key }) => key));

export const TEX = {
  world: "world-ground",
  hero: "hero",
  heroById: (id: string) => `hero:${id}`,
  door: "door",
  slash: "slash",
  projectile: "projectile",
  shadow: "shadow",
  lootOrb: "loot_orb",
  lootByItem: (id: string) => `loot:${id}`,
  brazier: "brazier",
  campBase: "campfire_base",
  enemyFallback: "enemy_generic",
  tree: (variant: number) => `tree_${variant}`,
  node: (itemId: string) => `node_${itemId}`,
  enemy: (enemyId: string) => {
    const key = `enemy:${enemyId}`;
    if (enemyTextureKeys.has(key)) return key;
    return enemyId === "mill_spider" ? "spider" : "enemy_generic";
  },
} as const;

export const TREE_VARIANTS = 4;
const TREE_SIZE = { w: 26, h: 30, baseX: 13, baseY: 23 };

/** Texture key -> origin (0..1) of the world anchor inside the image. */
const origins = new Map<string, { x: number; y: number }>();

export function originOf(key: string): { x: number; y: number } {
  return origins.get(key) ?? { x: 0.5, y: 0.5 };
}

function makeCanvas(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable.");
  g.imageSmoothingEnabled = false;
  return { canvas, g };
}

function register(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  anchorX: number,
  anchorY: number,
): void {
  const { originX, originY } = registerCanvasTexture(scene, key, {
    canvas,
    anchorX,
    anchorY,
  });
  origins.set(key, { x: originX, y: originY });
}

function drawDoor(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(16, 16);
  g.fillStyle = "#1e1d2e";
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? "#6a4a32" : "#7d5a3c";
    g.fillRect(1 + i * 4, 1, 3, 14);
    g.fillStyle = "#9a7650";
    g.fillRect(1 + i * 4, 1, 1, 14);
  }
  g.fillStyle = "#3a3c4e";
  g.fillRect(0, 4, 16, 2);
  g.fillRect(0, 10, 16, 2);
  g.fillStyle = "#c8a24a";
  g.fillRect(11, 7, 2, 2);
  return canvas;
}

function drawSlash(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(24, 24);
  g.strokeStyle = "#f4f8ff";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(4, 12, 14, -0.9, 0.9);
  g.stroke();
  g.strokeStyle = "#8cc4ec";
  g.lineWidth = 1;
  g.beginPath();
  g.arc(4, 12, 11, -0.8, 0.8);
  g.stroke();
  return canvas;
}

function drawProjectile(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(7, 7);
  g.fillStyle = "#3a2c52";
  g.fillRect(1, 0, 5, 7);
  g.fillRect(0, 1, 7, 5);
  g.fillStyle = "#c7a4ff";
  g.fillRect(2, 1, 3, 5);
  g.fillRect(1, 2, 5, 3);
  g.fillStyle = "#ffffff";
  g.fillRect(3, 3, 1, 1);
  return canvas;
}

function drawShadow(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(14, 6);
  g.fillStyle = "rgba(10,14,32,0.38)";
  g.fillRect(3, 0, 8, 6);
  g.fillRect(1, 1, 12, 4);
  g.fillRect(0, 2, 14, 2);
  return canvas;
}

function drawTree(gen: TextureGenerator, variant: number): HTMLCanvasElement {
  const art = gen.tree({ biomeIndex: variant % 2 === 0 ? 5 : 4, variant });
  const { canvas, g } = makeCanvas(TREE_SIZE.w, TREE_SIZE.h);
  g.drawImage(art.trunk, 0, 0);
  for (const layer of art.layers) g.drawImage(layer, 0, 0);
  return canvas;
}

/** Generates every placeholder texture the game scenes use and registers it with Phaser. */
export function registerGameTextures(
  scene: Phaser.Scene,
  gen: TextureGenerator,
): void {
  for (const sprite of PIXEL_SPRITES) {
    const art = gen.generate({
      key: sprite.key,
      pattern: sprite.pattern,
      palette: sprite.palette,
      anchorX: sprite.anchorX,
      anchorY: sprite.anchorY,
    });
    register(scene, sprite.key, art.canvas, art.anchorX, art.anchorY);
    if (sprite.key === TEX.hero) {
      for (const { id, palette } of loadGameData().heroes.values()) {
        const key = TEX.heroById(id);
        const skin = gen.generate({ ...sprite, key, palette });
        register(scene, key, skin.canvas, skin.anchorX, skin.anchorY);
      }
    }
  }
  for (const def of ENEMY_TEXTURE_DEFS) {
    const art = gen.generate(def);
    register(scene, def.key, art.canvas, art.anchorX, art.anchorY);
  }
  for (let v = 0; v < TREE_VARIANTS; v++) {
    register(
      scene,
      TEX.tree(v),
      drawTree(gen, v),
      TREE_SIZE.baseX,
      TREE_SIZE.baseY,
    );
  }
  register(scene, TEX.door, drawDoor(), 8, 8);
  register(scene, TEX.slash, drawSlash(), 4, 12);
  register(scene, TEX.projectile, drawProjectile(), 3, 3);
  register(scene, TEX.shadow, drawShadow(), 7, 3);
}

export function registerWorldTexture(
  scene: Phaser.Scene,
  canvas: HTMLCanvasElement,
  key: string = TEX.world,
): void {
  register(scene, key, canvas, 0, 0);
}

/** Bakes drop colors into the sprite so Canvas and WebGL display the same palette. */
export function registerLootTextures(
  scene: Phaser.Scene,
  gen: TextureGenerator,
  tints: Record<string, number>,
): void {
  const sprite = PIXEL_SPRITES.find(({ key }) => key === TEX.lootOrb);
  if (!sprite) throw new Error("Missing loot sprite");
  for (const [itemId, tint] of Object.entries(tints)) {
    const key = TEX.lootByItem(itemId);
    if (scene.textures.exists(key)) continue;
    const color = `#${tint.toString(16).padStart(6, "0")}`;
    const art = gen.generate({
      ...sprite,
      key,
      palette: { ...sprite.palette, g: color },
    });
    register(scene, key, art.canvas, art.anchorX, art.anchorY);
  }
}
