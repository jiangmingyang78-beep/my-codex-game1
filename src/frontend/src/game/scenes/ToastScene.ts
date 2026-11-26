import Phaser from "phaser";
import { DEPTH, SCENE } from "../config";
import { ToastManager } from "../ui/ToastManager";
import { attachToastManager, detachToastManager } from "../ui/toastBridge";

/**
 * 独立 1:1 屏幕坐标叠加场景：专用于承载 ToastManager，
 * 避免受到 GameScene 相机整数缩放（2×–5×）与受击震屏影响。
 */
export class ToastScene extends Phaser.Scene {
  private manager: ToastManager | null = null;
  private equipmentCount = 0;

  constructor() {
    super(SCENE.toast);
  }

  create(): void {
    this.cameras.main.setZoom(1).setRoundPixels(true).setScroll(0, 0);
    const anchors = this.computeAnchors();
    this.manager = new ToastManager(this, {
      depth: DEPTH.toast,
      lootMaxVisible: 4,
      lootAnchorX: anchors.lootX,
      lootAnchorY: anchors.lootY,
      lootGap: 6,
      feedbackOffsetY: anchors.feedbackOffsetY,
    });
    attachToastManager(this.manager, this.textures);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.syncAnchors, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  /** 根据已锻装备数量与当前视口重新计算安全锚点（兼容冒险模式与无尽模式）。 */
  setHudEquipmentCount(count: number): void {
    if (this.equipmentCount === count) return;
    this.equipmentCount = count;
    this.syncAnchors();
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

    // 避开左上角血条/饱食/火炬面板与目标栏
    let lootY = compact ? 176 : 186;
    if (typeof document !== "undefined") {
      const box = document
        .querySelector("[data-hud-top-left]")
        ?.getBoundingClientRect();
      if (box && box.bottom > 0) {
        lootY = Math.round(Math.min(236, Math.max(132, box.bottom + 8)));
      }
    }
    lootY = Math.min(lootY, Math.max(120, Math.round(viewH * 0.44)));

    // 若装备环栏（冒险/无尽模式）出现在左上角下方，则水平避让其列宽
    let lootX = compact ? 12 : 16;
    if (this.equipmentCount > 0) {
      const badgeStep = compact ? 42 : 46;
      const maxColHeight = Math.max(badgeStep, Math.floor(viewH * 0.42));
      const perCol = Math.max(1, Math.floor(maxColHeight / badgeStep));
      const cols = Math.min(3, Math.ceil(this.equipmentCount / perCol));
      lootX = (compact ? 8 : 12) + cols * badgeStep + 8;
    }

    // 底部快捷栏高度：桌面 72px + bottom 12px = 84px；窄屏 64px + 12px = 76px
    const feedbackOffsetY = compact ? 96 : 106;
    return { lootX, lootY, feedbackOffsetY };
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.syncAnchors, this);
    if (this.manager) {
      detachToastManager(this.manager);
      this.manager.destroy();
      this.manager = null;
    }
  }
}
