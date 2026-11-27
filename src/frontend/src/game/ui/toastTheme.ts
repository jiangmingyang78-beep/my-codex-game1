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

/** 格式化提示文案：含数量增量时输出如“石料 +4”。 */
export function formatToastText(
  item: Pick<ToastItem, "label" | "count">,
): string {
  if (typeof item.count === "number") {
    const sign = item.count >= 0 ? "+" : "";
    return `${item.label} ${sign}${item.count}`;
  }
  return item.label;
}

/** 将图标等比缩放进 16×16 槽位，避免非正方形程序化纹理拉伸畸变。 */
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

const even = (value: number) => Math.ceil(value / 2) * 2;

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

/** 按内容宽度重绘像素双层描边底框与左侧 4px 状态色条。 */
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

  item.width = even(width);
  item.height = even(height);

  // feedback 居中对齐，loot 左对齐，统一以垂直中线为 y=0
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

  // 深蓝灰像素双层描边
  g.lineStyle(1, theme.borderInner, 0.95);
  g.strokeRect(offsetX + 1.5, offsetY + 1.5, item.width - 3, item.height - 3);
  g.lineStyle(1, theme.borderOuter, 1);
  g.strokeRect(offsetX + 0.5, offsetY + 0.5, item.width - 1, item.height - 1);

  // 左侧 4px 状态色条
  g.fillStyle(palette.accent, 1);
  g.fillRect(offsetX + 1, offsetY + 1, theme.accentWidth, item.height - 2);
}
