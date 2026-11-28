import Phaser from "phaser";
import {
  type ToastChannel,
  type ToastItem,
  type ToastTheme,
  fitToastIcon,
  formatToastText,
  redrawToastBox,
  toastContentWidth,
} from "./toastTheme";
import { wrapToastText } from "./toastWrap";

export interface ToastLayoutConfig {
  depth: number;
  lootAnchorX: number;
  lootAnchorY: number;
  lootGap: number;
  feedbackOffsetY: number;
}

/** Creates a single hint's jer container, background, icon (missing silent retreat) and text node. */
export function createToastVisual(
  scene: Phaser.Scene,
  item: ToastItem,
  theme: ToastTheme,
  depth: number,
): void {
  const palette = theme.types[item.type] ?? theme.types.system;
  const container = scene.add.container(0, 0);
  container.setScrollFactor(0).setDepth(depth);

  const bg = scene.add.graphics();
  container.add(bg);

  let iconObj: Phaser.GameObjects.Image | null = null;
  if (item.iconKey && scene.textures.exists(item.iconKey)) {
    const tex = scene.textures.get(item.iconKey);
    if (tex && tex.key !== "__MISSING") {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      iconObj = scene.add.image(0, 0, item.iconKey).setOrigin(0, 0);
      fitToastIcon(iconObj, theme.iconSize);
      container.add(iconObj);
    }
  }

  const textObj = scene.add
    .text(0, 0, formatToastText(item), {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: palette.text,
      resolution: 1,
      padding: { left: 1, right: 1, top: 2, bottom: 2 },
      wordWrap: { width: theme.maxWidth, callback: wrapToastText },
    })
    .setOrigin(0, 0)
    .setLineSpacing(4);
  container.add(textObj);

  item.container = container;
  item.bg = bg;
  item.iconObj = iconObj;
  item.textObj = textObj;
  textObj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function snapToast(container: Phaser.GameObjects.Container): () => void {
  return () => {
    container.setPosition(Math.round(container.x), Math.round(container.y));
  };
}

/** Re-routes active entries in the channel and drive field or queue transfer boxes. */
export function layoutToastChannel(
  scene: Phaser.Scene,
  items: readonly ToastItem[],
  channel: ToastChannel,
  config: ToastLayoutConfig,
  theme: ToastTheme,
  newlyCreatedId: number | null = null,
): void {
  const active = items.filter((i) => i.state !== "out");
  const viewW = scene.scale.width;
  const viewH = scene.scale.height;
  let cursorY = Math.round(config.lootAnchorY);
  const hotbarTop =
    channel === "feedback"
      ? document.querySelector("[data-hud-hotbar]")?.getBoundingClientRect().top
      : undefined;
  const feedbackBottom =
    hotbarTop === undefined
      ? viewH - config.feedbackOffsetY
      : Math.ceil((hotbarTop - 20) / 4) * 4;

  active.forEach((item, index) => {
    const container = item.container;
    if (!container || !item.textObj) return;
    const isFeedback = channel === "feedback";
    const targetX = Math.round(isFeedback ? viewW / 2 : config.lootAnchorX);
    const available = viewW - (isFeedback ? 16 : targetX + 8);
    const limit = Math.max(
      2,
      Math.floor(Math.min(theme.maxWidth, available) / 4) * 4,
    );
    const wrapWidth = toastContentWidth(theme, Boolean(item.iconObj), limit);
    if (item.textObj.style.wordWrapWidth !== wrapWidth)
      item.textObj.setWordWrapWidth(wrapWidth);
    item.textObj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    redrawToastBox(item, theme, limit);
    const targetY = isFeedback
      ? Math.max(
          item.height / 2 + 8,
          Math.round(feedbackBottom - item.height / 2),
        )
      : Math.round(cursorY + item.height / 2);
    if (!isFeedback) cursorY += item.height + config.lootGap;

    const targetAlpha = isFeedback ? 1 : Math.max(0.62, 1 - index * 0.12);
    item.targetAlpha = targetAlpha;
    container.setScale(1);
    item.baseX = targetX;
    item.targetY = targetY;

    scene.tweens.killTweensOf(container);
    if (item.id === newlyCreatedId) {
      container
        .setPosition(
          isFeedback ? targetX : targetX - 16,
          isFeedback ? targetY + 4 : targetY,
        )
        .setAlpha(0);
      scene.tweens.add({
        targets: container,
        x: targetX,
        y: targetY,
        alpha: targetAlpha,
        onUpdate: snapToast(container),
        duration: 140,
        ease: "Cubic.easeOut",
        onComplete: () => {
          if (item.state === "in") item.state = "hold";
        },
      });
    } else {
      scene.tweens.add({
        targets: container,
        x: targetX,
        y: targetY,
        alpha: targetAlpha,
        onUpdate: snapToast(container),
        duration: 140,
        ease: "Quad.easeOut",
      });
    }
  });
}

/** Picks up small pop-up animations when the number is in situ. */
export function playPopFeedback(scene: Phaser.Scene, item: ToastItem): void {
  if (!item.container) return;
  scene.tweens.killTweensOf(item.container);
  item.container
    .setPosition(item.baseX, item.targetY)
    .setAlpha(item.targetAlpha);
  scene.tweens.add({
    targets: item.container,
    y: item.targetY - 3,
    onUpdate: snapToast(item.container),
    duration: 75,
    yoyo: true,
    ease: "Quad.easeOut",
  });
}

/** The small oscillation animation of the warning class when the alarm type is repeated. */
export function playShakeFeedback(scene: Phaser.Scene, item: ToastItem): void {
  if (!item.container) return;
  scene.tweens.killTweensOf(item.container);
  item.container.setPosition(item.baseX, item.targetY);
  scene.tweens.add({
    targets: item.container,
    x: item.baseX + 6,
    onUpdate: snapToast(item.container),
    duration: 45,
    yoyo: true,
    repeat: 2,
    ease: "Sine.easeInOut",
    onComplete: () => {
      if (item.container) item.container.x = item.baseX;
    },
  });
}

/** The play-off booths are completed and the containers are destroyed and the clean-up queues are returned. */
export function dismissToastVisual(
  scene: Phaser.Scene,
  item: ToastItem,
  fast: boolean,
  onDone: () => void,
): void {
  const container = item.container;
  if (!container) {
    onDone();
    return;
  }
  scene.tweens.killTweensOf(container);
  scene.tweens.add({
    targets: container,
    y: container.y - (item.channel === "loot" ? 10 : 6),
    alpha: 0,
    onUpdate: snapToast(container),
    duration: fast ? 110 : 200,
    ease: "Quad.easeIn",
    onComplete: () => {
      onDone();
      if (container.scene) container.destroy(true);
    },
  });
}
