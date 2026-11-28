import Phaser from "phaser";
import { SCENE } from "../config";
import { ToastManager } from "../ui/ToastManager";
import { attachToastManager, detachToastManager } from "../ui/toastBridge";

/**
 * Independence 1:1 Screen coordinates superimposed scenes: dedicated to carrying ToastManager,
 * Avoid the effects of the integer scaling of the Scree camera (2x–5x) and the shock screen.
 */
export class ToastScene extends Phaser.Scene {
  private manager: ToastManager | null = null;
  private equipmentCount = 0;
  private hudObserver?: ResizeObserver;

  constructor() {
    super(SCENE.toast);
  }

  create(): void {
    this.cameras.main.setZoom(1).setRoundPixels(true).setScroll(0, 0);
    const anchors = this.computeAnchors();
    this.manager = new ToastManager(this, {
      lootMaxVisible: 4,
      lootAnchorX: anchors.lootX,
      lootAnchorY: anchors.lootY,
      lootGap: 8,
      feedbackOffsetY: anchors.feedbackOffsetY,
    });
    attachToastManager(this.manager, this.textures);
    this.observeHud();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.syncAnchors, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  /** Recalculate the security anchor points based on the number of active equipment and current visual openings (compatible risk-taking and end-of-life models)). */
  setHudEquipmentCount(count: number): void {
    this.observeHud();
    if (this.equipmentCount === count) return;
    this.equipmentCount = count;
    this.syncAnchors();
  }

  private observeHud(): void {
    if (this.hudObserver) return;
    const panel = document.querySelector("[data-hud-top-left]");
    if (!panel) return;
    this.hudObserver = new ResizeObserver(() => this.syncAnchors());
    this.hudObserver.observe(panel);
  }

  private syncAnchors(): void {
    if (!this.manager) return;
    const { lootX, lootY, feedbackOffsetY } = this.computeAnchors();
    this.manager.setAnchors(lootX, lootY, feedbackOffsetY);
  }

  private computeAnchors(): {
    lootX: number;
    lootY: number;
    feedbackOffsetY: number;
  } {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const compact = viewW < 640;

    // Avoid the upper left corner blood bar/saturated/burn panel and target bar, leaving at least 16 px vertical safety spacing
    let lootY = compact ? 200 : 216;
    if (typeof document !== "undefined") {
      const box = document
        .querySelector("[data-hud-top-left]")
        ?.getBoundingClientRect();
      if (box && box.bottom > 0) {
        lootY = Math.ceil((box.bottom + 16) / 4) * 4;
      }
    }

    // If the equipment loop (at risk/infinite mode) appears below the top left corner, the horizontal width is avoided
    let lootX = compact ? 12 : 16;
    if (this.equipmentCount > 0) {
      const badgeStep = compact ? 44 : 48;
      const maxColHeight = Math.max(badgeStep, Math.floor(viewH * 0.42));
      const perCol = Math.max(1, Math.floor(maxColHeight / badgeStep));
      const cols = Math.min(3, Math.ceil(this.equipmentCount / perCol));
      lootX = (compact ? 8 : 12) + cols * badgeStep + 8;
    }

    // Allow 84px for the desktop quick bar or 76px on narrow screens, plus 20px of clearance.
    const feedbackOffsetY = compact ? 96 : 104;
    return { lootX, lootY, feedbackOffsetY };
  }

  private cleanup(): void {
    this.hudObserver?.disconnect();
    this.hudObserver = undefined;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncAnchors, this);
    if (this.manager) {
      detachToastManager(this.manager);
      this.manager.destroy();
      this.manager = null;
    }
  }
}
