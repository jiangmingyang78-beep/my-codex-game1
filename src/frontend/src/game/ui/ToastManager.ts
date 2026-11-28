import Phaser from "phaser";
import { loadPixelFont } from "./pixelFont";
import {
  createToastVisual,
  dismissToastVisual,
  layoutToastChannel,
  playPopFeedback,
  playShakeFeedback,
} from "./toastMotion";
import {
  type ToastChannel,
  type ToastConfig,
  type ToastItem,
  type ToastOptions,
  type ToastPushInput,
  type ToastTheme,
  createToastItem,
  formatToastText,
  resolveToastConfig,
  resolveToastTheme,
} from "./toastTheme";

export type {
  ToastChannel,
  ToastItem,
  ToastOptions,
  ToastPushInput,
  ToastTheme,
  ToastType,
} from "./toastTheme";

const CHANNELS: readonly ToastChannel[] = ["loot", "feedback"];

/**
 * Double Channel Pixel Light Tip Manager (Stacked Toost)):
 * -Hot Channel: Up left corner compact stack (up to 4 bars) added and bounced with the object in its original condition.
 * -77 Channel: A single line above the bottom shortcut bar is replaced by a single line, and the repeat trigger is only shaking and refreshing.
 */
export class ToastManager {
  private scene: Phaser.Scene | null;
  private destroyed = false;
  private idSeq = 0;
  private readonly theme: ToastTheme;
  private readonly config: ToastConfig;
  private readonly channels: Record<ToastChannel, ToastItem[]> = {
    loot: [],
    feedback: [],
  };

  constructor(scene: Phaser.Scene, options: ToastOptions = {}) {
    this.scene = scene;
    this.theme = resolveToastTheme(options);
    this.config = resolveToastConfig(options);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    void loadPixelFont().then((loaded) => {
      if (!loaded || this.destroyed) return;
      for (const channel of CHANNELS) {
        for (const item of this.channels[channel])
          item.textObj?.style.update(true);
        this.layoutChannel(channel);
      }
    });
  }

  /** Bounds of the toast boxes in the unscaled screen overlay. */
  getVisibleBounds(): DOMRect[] {
    const boxes: DOMRect[] = [];
    for (const channel of CHANNELS) {
      for (const item of this.channels[channel]) {
        const container = item.container;
        if (!container || container.alpha <= 0.1) continue;
        boxes.push(
          new DOMRect(
            channel === "feedback" ? container.x - item.width / 2 : container.x,
            container.y - item.height / 2,
            item.width,
            item.height,
          ),
        );
      }
    }
    return boxes;
  }

  /** Dynamic update anchor points (e.g., avoids HUD when the equipment rings increase or decrease or when the size of the mouth changes). */
  setAnchors(x: number, y: number, feedbackOffsetY?: number): void {
    const nextX = Math.round(x);
    const nextY = Math.round(y);
    const nextFb =
      feedbackOffsetY !== undefined
        ? Math.round(feedbackOffsetY)
        : this.config.feedbackOffsetY;
    if (
      nextX === this.config.lootAnchorX &&
      nextY === this.config.lootAnchorY &&
      nextFb === this.config.feedbackOffsetY
    ) {
      return;
    }
    this.config.lootAnchorX = nextX;
    this.config.lootAnchorY = nextY;
    this.config.feedbackOffsetY = nextFb;
    if (!this.destroyed && this.scene?.sys?.isActive()) {
      this.layoutChannel("loot");
      this.layoutChannel("feedback");
    }
  }

  /** Resource/object pick-up tips (press Id} to be re-sized and added). */
  loot(
    itemId: string,
    label: string,
    delta = 1,
    iconKey: string | null = null,
  ): ToastItem | null {
    return this.push({
      key: `pickup:${itemId}`,
      channel: "loot",
      type: "gain",
      iconKey,
      label,
      delta,
      duration: this.config.defaultLootDuration,
    });
  }

  /** Operation warning hint (the bottom single bar replacement, repeats triggers shaking and resets the count). */
  warn(label: string, key: string | null = null): ToastItem | null {
    return this.push({
      key: key || `warn:${label}`,
      channel: "feedback",
      type: "warn",
      label,
      duration: this.config.defaultFeedbackDuration,
    });
  }

  /** Error hint (bottom single bar replacement, left red status bar). */
  error(label: string, key: string | null = null): ToastItem | null {
    return this.push({
      key: key || `error:${label}`,
      channel: "feedback",
      type: "error",
      label,
      duration: this.config.defaultFeedbackDuration,
    });
  }

  /** System hint (bottom single bar replacement, left blue status bar). */
  info(label: string, key: string | null = null): ToastItem | null {
    return this.push({
      key: key || `sys:${label}`,
      channel: "feedback",
      type: "system",
      label,
      duration: this.config.defaultFeedbackDuration,
    });
  }

  /** Feedback is being provided to milestones (production completed, unlocked, camp fire upgraded, etc.) with a green bottom bar). */
  gain(label: string, key: string | null = null): ToastItem | null {
    return this.push({
      key: key || `gain:${label}`,
      channel: "feedback",
      type: "gain",
      label,
      duration: this.config.defaultFeedbackDuration,
    });
  }

  /** (iv) A general method of packaging for signatures. */
  show(
    label: string,
    tone: "info" | "good" | "warn" | "error" = "info",
  ): ToastItem | null {
    if (tone === "warn") return this.warn(label);
    if (tone === "error") return this.error(label);
    if (tone === "good") return this.gain(label);
    return this.info(label);
  }

  /** Core placement logic: to re-consolidate, to phase out the capping of the corridor, to create visual and trigger layouts. */
  push(input: ToastPushInput): ToastItem | null {
    const scene = this.scene;
    if (this.destroyed || !scene?.sys?.isActive()) return null;
    const channel: ToastChannel =
      input.channel === "feedback" ? "feedback" : "loot";
    const type = input.type ?? (channel === "loot" ? "gain" : "system");
    const list = this.channels[channel];
    const hold =
      input.duration ??
      (channel === "loot"
        ? this.config.defaultLootDuration
        : this.config.defaultFeedbackDuration);

    if (input.key) {
      const hit = list.find((i) => i.key === input.key && i.state !== "out");
      if (hit) {
        hit.remaining = hold;
        if (typeof input.delta === "number" && typeof hit.count === "number") {
          hit.count += input.delta;
          this.refreshVisualContent(hit);
          playPopFeedback(scene, hit);
        } else {
          playShakeFeedback(scene, hit);
        }
        return hit;
      }
    }

    const maxVisible = channel === "feedback" ? 1 : this.config.lootMaxVisible;
    const active = list.filter((i) => i.state !== "out");
    for (let i = 0; i < active.length - maxVisible + 1; i++) {
      const oldest = active[active.length - 1 - i];
      if (oldest) this.dismiss(oldest, true);
    }

    const item = createToastItem(++this.idSeq, channel, type, input, hold);
    createToastVisual(scene, item, this.theme, this.config.depth);
    list.unshift(item);
    this.layoutChannel(channel, item.id);
    return item;
  }

  private refreshVisualContent(item: ToastItem): void {
    if (!item.textObj || !item.bg) return;
    item.textObj.setText(formatToastText(item));
    item.textObj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.layoutChannel(item.channel);
  }

  private layoutChannel(
    channel: ToastChannel,
    newlyCreatedId: number | null = null,
  ): void {
    if (!this.scene) return;
    layoutToastChannel(
      this.scene,
      this.channels[channel],
      channel,
      this.config,
      this.theme,
      newlyCreatedId,
    );
  }

  private onUpdate(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.min(delta, 100);
    for (const channel of CHANNELS) {
      const list = this.channels[channel];
      let removedAny = false;
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (item.state === "out") continue;
        item.remaining -= dt;
        if (item.remaining <= 0) {
          this.dismiss(item, false);
          removedAny = true;
        }
      }
      if (removedAny) this.layoutChannel(channel);
    }
  }

  private dismiss(item: ToastItem, fast = false): void {
    if (item.state === "out") return;
    item.state = "out";
    if (!this.scene) {
      this.removeFromList(item);
      return;
    }
    dismissToastVisual(this.scene, item, fast, () => this.removeFromList(item));
  }

  private removeFromList(item: ToastItem): void {
    const list = this.channels[item.channel];
    const idx = list.indexOf(item);
    if (idx !== -1) list.splice(idx, 1);
  }

  private onResize(): void {
    if (this.destroyed) return;
    this.layoutChannel("loot");
    this.layoutChannel("feedback");
  }

  clear(): void {
    for (const channel of CHANNELS) {
      const list = this.channels[channel];
      while (list.length > 0) {
        const item = list.pop();
        if (item?.container) {
          this.scene?.tweens.killTweensOf(item.container);
          item.container.destroy(true);
        }
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clear();
    if (this.scene?.events) {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
      this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    }
    if (this.scene?.scale) {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    }
    this.scene = null;
  }
}
