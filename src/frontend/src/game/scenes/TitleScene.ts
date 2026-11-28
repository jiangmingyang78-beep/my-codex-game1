import { type RunState, type Systems, createRun, getSystems } from "@/core";
import Phaser from "phaser";
import { REGISTRY, SCENE } from "../config";
import { breadcrumb } from "../diagnostics/report";
import { hasPendingRun, reportFailure } from "../session/activeRun";
import type { TextureGenerator } from "../textures/registerTextures";
import { uiStore } from "../ui/store";
import { refreshTitleInfo } from "../ui/titleInfo";
import { Scenery } from "../world/Scenery";
import { configureCamera } from "../world/cameraRig";

const TITLE_DARKNESS = 0.6;

/**
 * Title backdrop: the camp at night. The menu and the start buttons are React; this scene only
 * shows the backdrop and moves on to the game scene once the UI has created a run.
 */
export class TitleScene extends Phaser.Scene {
  private scenery: Scenery | null = null;
  private rules: Systems = getSystems();
  private run: RunState = createRun({ systems: this.rules });
  private starting = false;

  constructor() {
    super(SCENE.title);
  }

  create(): void {
    breadcrumb(`Scene ${SCENE.title}`);
    this.starting = false;
    this.rules = getSystems();
    this.run = createRun({ systems: this.rules });
    refreshTitleInfo();
    // Only reset the UI to the title when no run was started while Phaser was booting.
    if (!hasPendingRun() && !uiStore.get().error) {
      uiStore.set({
        screen: "title",
        hud: null,
        prompt: null,
        craft: null,
        result: null,
      });
    }
    let unfit: (() => void) | null = null;
    try {
      const gen = this.registry.get(
        REGISTRY.textureGenerator,
      ) as TextureGenerator;
      this.scenery = new Scenery(this, this.rules, gen, this.run);
      unfit = configureCamera(this, this.rules);
      const { campfire } = this.rules.world;
      this.cameras.main.centerOn(campfire.x, campfire.y - 24);
    } catch (error) {
      // A missing backdrop must never block starting a run.
      console.error(error);
    }
    this.events.once("shutdown", () => {
      unfit?.();
      this.scenery?.destroy();
      this.scenery = null;
    });
  }

  update(_time: number, deltaMs: number): void {
    if (hasPendingRun() && !this.starting) {
      this.starting = true;
      try {
        this.scene.start(SCENE.game, { fromTitle: true });
      } catch (error) {
        console.error(error);
        reportFailure(
          "Playground is starting unsuccessfully. Please return the title and try again.",
          error,
        );
      }
      return;
    }
    this.scenery?.update(
      this.run,
      Math.min(deltaMs / 1000, 0.1),
      TITLE_DARKNESS,
    );
  }
}
