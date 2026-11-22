import { createTextureGenerator } from "@/vfx/proceduralTextures";
import Phaser from "phaser";
import { REGISTRY, SCENE } from "../config";
import { registerGameTextures } from "../textures/registerTextures";

/** Generates every placeholder texture once (2D canvas only, no loader), then hands over to the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  create(): void {
    try {
      const gen = createTextureGenerator();
      registerGameTextures(this, gen);
      this.registry.set(REGISTRY.textureGenerator, gen);
    } catch (error) {
      // The title still starts; the game scene reports the failure if it needs the textures.
      console.error(error);
    }
    this.scene.start(SCENE.title);
  }
}
