import Phaser from "phaser";
import {
  type ToastChannel,
  type ToastItem,
  type ToastTheme,
  fitToastIcon,
  formatToastText,
  redrawToastBox,
} from "./toastTheme";

export interface ToastLayoutConfig {
  depth: number;
  lootAnchorX: number;
  lootAnchorY: number;
  lootGap: number;
  feedbackOffsetY: number;
}

/** 创建单条提示的 Phaser 容器、背景、图标（缺失静默回退）与文字节点。 */
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
      iconObj = scene.add.image(0, 0, item.iconKey).setOrigin(0.5, 0.5);
      fitToastIcon(iconObj, theme.iconSize);
      container.add(iconObj);
    }
  }

  const dpr =
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 2, 2)
      : 2;
  const textObj = scene.add
    .text(0, 0, formatToastText(item), {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: palette.text,
      resolution: dpr,
      wordWrap: {
        width:
          theme.maxWidth - theme.paddingX * 2 - theme.iconSize - theme.iconGap,
      },
    })
    .setOrigin(0, 0.5);
  container.add(textObj);

  item.container = container;
  item.bg = bg;
  item.iconObj = iconObj;
  item.textObj = textObj;
  redrawToastBox(item, theme);
}

/** 重新排布指定通道中的活跃条目，并驱动进场或队列位移补间。 */
export function layoutToastChannel(
  scene: Phaser.Scene,
  items: readonly ToastItem[],
  channel: ToastChannel,
  config: ToastLayoutConfig,
  newlyCreatedId: number | null = null,
): void {
  const active = items.filter((i) => i.state !== "out");
  const viewW = scene.scale.width;
  const viewH = scene.scale.height;
  let cursorY = config.lootAnchorY;

  active.forEach((item, index) => {
    const container = item.container;
    if (!container) return;
    const isFeedback = channel === "feedback";
    const targetX = isFeedback ? Math.round(viewW / 2) : config.lootAnchorX;
    const targetY = isFeedback
      ? Math.round(viewH - config.feedbackOffsetY)
      : Math.round(cursorY + item.height / 2);
    if (!isFeedback) cursorY += item.height + config.lootGap;

    const targetAlpha = isFeedback ? 1 : Math.max(0.62, 1 - index * 0.12);
    const targetScale = isFeedback ? 1 : Math.max(0.92, 1 - index * 0.03);
    item.baseX = targetX;
    item.targetY = targetY;

    scene.tweens.killTweensOf(container);
    if (item.id === newlyCreatedId) {
      container
        .setPosition(
          isFeedback ? targetX : targetX - 18,
          isFeedback ? targetY + 10 : targetY,
        )
        .setAlpha(0)
        .setScale(isFeedback ? 0.94 : 0.98);
      scene.tweens.add({
        targets: container,
        x: targetX,
        y: targetY,
        alpha: targetAlpha,
        scaleX: targetScale,
        scaleY: targetScale,
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
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 140,
        ease: "Quad.easeOut",
      });
    }
  });
}

/** 拾取数量原地合并时的轻微弹跳动画。 */
export function playPopFeedback(scene: Phaser.Scene, item: ToastItem): void {
  if (!item.container) return;
  scene.tweens.killTweensOf(item.container);
  item.container.setPosition(item.baseX, item.targetY).setAlpha(1);
  scene.tweens.add({
    targets: item.container,
    scaleX: 1.07,
    scaleY: 1.07,
    duration: 75,
    yoyo: true,
    ease: "Quad.easeOut",
  });
}

/** 警告类提示重复触发时的轻微左右抖动动画。 */
export function playShakeFeedback(scene: Phaser.Scene, item: ToastItem): void {
  if (!item.container) return;
  scene.tweens.killTweensOf(item.container);
  item.container.setPosition(item.baseX, item.targetY);
  scene.tweens.add({
    targets: item.container,
    x: item.baseX + 6,
    duration: 45,
    yoyo: true,
    repeat: 2,
    ease: "Sine.easeInOut",
    onComplete: () => {
      if (item.container) item.container.x = item.baseX;
    },
  });
}

/** 播放退场补间，完成后立刻销毁容器并回调清理队列。 */
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
    duration: fast ? 110 : 200,
    ease: "Quad.easeIn",
    onComplete: () => {
      onDone();
      if (container.scene) container.destroy(true);
    },
  });
}
