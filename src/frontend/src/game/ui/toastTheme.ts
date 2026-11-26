import type Phaser from "phaser";

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
  fontFamily: '"Microsoft YaHei", "PingFang SC", monospace',
  fontSize: "14px",
  paddingX: 12,
  paddingY: 7,
  iconSize: 16,
  iconGap: 8,
  accentWidth: 3,
  minWidth: 112,
  maxWidth: 360,
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
    types: {
      ...DEFAULT_TOAST_THEME.types,
      ...(options.theme?.types ?? {}),
    },
  };
}

export function resolveToastConfig(options: ToastOptions): ToastConfig {
  return {
    depth: options.depth ?? 10000,
    lootMaxVisible: options.lootMaxVisible ?? 4,
    lootAnchorX: options.lootAnchorX ?? 16,
    lootAnchorY: options.lootAnchorY ?? 186,
    lootGap: options.lootGap ?? 6,
    feedbackOffsetY: options.feedbackOffsetY ?? 106,
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

/** 按内容宽度重绘像素双层描边底框与左侧 3px 状态色条。 */
export function redrawToastBox(item: ToastItem, theme: ToastTheme): void {
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
    theme.minWidth,
    Math.min(theme.maxWidth, textX + textW + theme.paddingX),
  );
  const height = Math.max(theme.iconSize, textH) + theme.paddingY * 2;

  item.width = Math.round(width);
  item.height = Math.round(height);

  // feedback 居中对齐，loot 左对齐，统一以垂直中线为 y=0
  const offsetX = item.channel === "feedback" ? -Math.round(item.width / 2) : 0;
  const offsetY = -Math.round(item.height / 2);

  if (item.iconObj) {
    item.iconObj.setPosition(
      Math.round(offsetX + contentLeft + theme.iconSize / 2),
      0,
    );
  }
  item.textObj.setPosition(Math.round(offsetX + textX), 0);

  const g = item.bg;
  g.clear();
  g.fillStyle(theme.bgColor, theme.bgAlpha);
  g.fillRect(offsetX, offsetY, item.width, item.height);

  // 深蓝灰像素双层描边
  g.lineStyle(1, theme.borderInner, 0.95);
  g.strokeRect(offsetX + 1.5, offsetY + 1.5, item.width - 3, item.height - 3);
  g.lineStyle(1, theme.borderOuter, 1);
  g.strokeRect(offsetX + 0.5, offsetY + 0.5, item.width - 1, item.height - 1);

  // 左侧 3px 状态色条
  g.fillStyle(palette.accent, 1);
  g.fillRect(offsetX + 1, offsetY + 1, theme.accentWidth, item.height - 2);
}
