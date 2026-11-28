import type Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { PIXEL_FONT_FAMILY, PIXEL_FONT_SIZE } from "./pixelFont";

export type ToastType = "gain" | "warn" | "error" | "system";
export type ToastChannel = "loot" | "feedback";
export type ToastState = "in" | "hold" | "out";

export interface ToastPalette {
  accent: number;
  text: string;
}

export interface ToastTheme {
  bgColor: number;
  bgAlpha: number;
  borderOuter: number;
  borderInner: number;
  fontFamily: string;
  fontSize: string;
  paddingX: number;
  paddingY: number;
  iconSize: number;
  iconGap: number;
  accentWidth: number;
  minWidth: number;
  maxWidth: number;
  types: Record<ToastType, ToastPalette>;
}

export interface ToastOptions {
  depth?: number;
  lootMaxVisible?: number;
  lootAnchorX?: number;
  lootAnchorY?: number;
  lootGap?: number;
  feedbackOffsetY?: number;
  defaultLootDuration?: number;
  defaultFeedbackDuration?: number;
  theme?: Partial<Omit<ToastTheme, "types">> & {
    types?: Partial<Record<ToastType, ToastPalette>>;
  };
}

export interface ToastPushInput {
  key?: string | null;
  channel?: ToastChannel;
  type?: ToastType;
  iconKey?: string | null;
  label: string;
  delta?: number | null;
  duration?: number | null;
}

export interface ToastItem {
  id: number;
  key: string | null;
  channel: ToastChannel;
  type: ToastType;
  iconKey: string | null;
  label: string;
  count: number | null;
  remaining: number;
  state: ToastState;
  width: number;
  height: number;
  baseX: number;
  targetY: number;
  targetAlpha: number;
  container: Phaser.GameObjects.Container | null;
  bg: Phaser.GameObjects.Graphics | null;
  iconObj: Phaser.GameObjects.Image | null;
  textObj: Phaser.GameObjects.Text | null;
}

export const DEFAULT_TOAST_THEME: ToastTheme = {
  bgColor: 0x1b2632,
  bgAlpha: 0.92,
  borderOuter: 0x0e161f,
  borderInner: 0x3b5268,
  fontFamily: PIXEL_FONT_FAMILY,
  fontSize: PIXEL_FONT_SIZE,
  paddingX: 12,
  paddingY: 8,
  iconSize: 16,
  iconGap: 8,
  accentWidth: 4,
  minWidth: 112,
  maxWidth: 420,
  types: {
    gain: { accent: 0x4cc968, text: "#63e27e" },
    warn: { accent: 0xe6b447, text: "#f2c75c" },
    error: { accent: 0xe05d5d, text: "#ff8080" },
    system: { accent: 0x58a6ff, text: "#9ecbff" },
  },
};

export interface ToastConfig {
  depth: number;
  lootMaxVisible: number;
  lootAnchorX: number;
  lootAnchorY: number;
  lootGap: number;
  feedbackOffsetY: number;
  defaultLootDuration: number;
  defaultFeedbackDuration: number;
}

export function resolveToastTheme(options: ToastOptions): ToastTheme {
  return {
    ...DEFAULT_TOAST_THEME,
    ...(options.theme ?? {}),
    fontFamily: PIXEL_FONT_FAMILY,
    fontSize: PIXEL_FONT_SIZE,
    types: {
      ...DEFAULT_TOAST_THEME.types,
      ...(options.theme?.types ?? {}),
    },
  };
}

export function resolveToastConfig(options: ToastOptions): ToastConfig {
  return {
    depth: options.depth ?? RENDER_DEPTH.toast,
    lootMaxVisible: options.lootMaxVisible ?? 4,
    lootAnchorX: options.lootAnchorX ?? 16,
    lootAnchorY: options.lootAnchorY ?? 216,
    lootGap: options.lootGap ?? 8,
    feedbackOffsetY: options.feedbackOffsetY ?? 104,
    defaultLootDuration: options.defaultLootDuration ?? 1800,
    defaultFeedbackDuration: options.defaultFeedbackDuration ?? 2000,
  };
}

export function createToastItem(
  id: number,
  channel: ToastChannel,
  type: ToastType,
  input: ToastPushInput,
  remaining: number,
): ToastItem {
  return {
    id,
    key: input.key ?? null,
    channel,
    type,
    iconKey: input.iconKey ?? null,
    label: input.label,
    count: typeof input.delta === "number" ? input.delta : null,
    remaining,
    state: "in",
    width: 0,
    height: 0,
    baseX: 0,
    targetY: 0,
    targetAlpha: 1,
    container: null,
    bg: null,
    iconObj: null,
    textObj: null,
  };
}

/** Formatting the hint: an output such as " Stone+4 " when containing an incremental quantity. */
export function formatToastText(
  item: Pick<ToastItem, "label" | "count">,
): string {
  if (typeof item.count === "number") {
    const sign = item.count >= 0 ? "+" : "";
    return `${item.label} ${sign}${item.count}`;
  }
  return item.label;
}

/** Scales the icon equivalent into a 16x16 slot to avoid a non-correctional program that is gravitationally stretching. */
export function fitToastIcon(
  icon: Phaser.GameObjects.Image,
  slotSize: number,
): void {
  const w = Math.max(1, icon.width);
  const h = Math.max(1, icon.height);
  const ratio = Math.min(slotSize / w, slotSize / h);
  const snapped = ratio >= 1 ? Math.floor(ratio) : ratio;
  icon.setDisplaySize(Math.round(w * snapped), Math.round(h * snapped));
}

const grid = (value: number) => Math.ceil(value / 4) * 4;

export function toastContentWidth(
  theme: ToastTheme,
  hasIcon: boolean,
  maxWidth: number,
): number {
  const iconWidth = hasIcon ? theme.iconSize + theme.iconGap : 0;
  return Math.max(
    1,
    maxWidth - theme.paddingX * 2 - theme.accentWidth - iconWidth - 2,
  );
}

/** Retweet the background box for the two layers of pixels by the width of the content and the 4px status bar for the left._. */
export function redrawToastBox(
  item: ToastItem,
  theme: ToastTheme,
  maxWidth: number,
): void {
  if (!item.bg || !item.textObj) return;
  const palette = theme.types[item.type] ?? theme.types.system;
  const hasIcon = Boolean(item.iconObj);
  const contentLeft = theme.accentWidth + theme.paddingX;
  const textX = hasIcon
    ? contentLeft + theme.iconSize + theme.iconGap
    : contentLeft;
  const textW = Math.ceil(item.textObj.width);
  const textH = Math.ceil(item.textObj.height);

  const width = Math.max(
    Math.min(theme.minWidth, maxWidth),
    textX + textW + theme.paddingX,
  );
  const height = Math.max(theme.iconSize, textH) + theme.paddingY * 2;

  item.width = grid(width);
  item.height = grid(height);

  // / = 0.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s
  const offsetX = item.channel === "feedback" ? -item.width / 2 : 0;
  const offsetY = -item.height / 2;

  if (item.iconObj) {
    item.iconObj.setPosition(
      Math.round(
        offsetX +
          contentLeft +
          (theme.iconSize - item.iconObj.displayWidth) / 2,
      ),
      Math.round(-item.iconObj.displayHeight / 2),
    );
  }
  item.textObj.setPosition(Math.round(offsetX + textX), Math.round(-textH / 2));

  const g = item.bg;
  g.clear();
  g.fillStyle(theme.bgColor, theme.bgAlpha);
  g.fillRect(offsetX, offsetY, item.width, item.height);

  // Deep blue gray pixels are drawn on the edge of the double layer
  g.lineStyle(2, theme.borderInner, 1);
  g.strokeRect(offsetX + 3, offsetY + 3, item.width - 6, item.height - 6);
  g.lineStyle(2, theme.borderOuter, 1);
  g.strokeRect(offsetX + 1, offsetY + 1, item.width - 2, item.height - 2);

  // Left 4px status bar
  g.fillStyle(palette.accent, 1);
  g.fillRect(offsetX + 4, offsetY + 4, theme.accentWidth, item.height - 8);
}
