import type Phaser from "phaser";
import { TEX } from "../textures/registerTextures";
import type { ToastManager } from "./ToastManager";

type QueuedCall = (
  manager: ToastManager,
  textures: Phaser.Textures.TextureManager,
) => void;

let activeManager: ToastManager | null = null;
let activeTextures: Phaser.Textures.TextureManager | null = null;
const pending: QueuedCall[] = [];

/** 优先匹配项目现有程序化纹理（采集点纹理 -> 地面掉落物纹理），不存在时返回 null 触发静默回退。 */
export function resolveItemIconKey(
  itemId: string,
  textures: Phaser.Textures.TextureManager | null,
): string | null {
  if (!textures || !itemId) return null;
  const candidates = [TEX.node(itemId), TEX.lootByItem(itemId)];
  for (const key of candidates) {
    if (textures.exists(key) && textures.get(key).key !== "__MISSING") {
      return key;
    }
  }
  return null;
}

/** 绑定当前活跃场景的 ToastManager，并冲刷场景启动期间暂存的提示。 */
export function attachToastManager(
  manager: ToastManager,
  textures: Phaser.Textures.TextureManager,
): void {
  activeManager = manager;
  activeTextures = textures;
  while (pending.length > 0) {
    const fn = pending.shift();
    if (fn) fn(manager, textures);
  }
}

/** 场景销毁时解除绑定，防止跨场景引用泄漏。 */
export function detachToastManager(manager: ToastManager): void {
  if (activeManager !== manager) return;
  activeManager = null;
  activeTextures = null;
}

/** 判断 Phaser 侧 ToastManager 是否已挂载就绪。 */
export function hasToastManager(): boolean {
  return activeManager !== null;
}

function dispatch(fn: QueuedCall): void {
  if (activeManager && activeTextures) {
    fn(activeManager, activeTextures);
    return;
  }
  pending.push(fn);
  if (pending.length > 16) pending.shift();
}

/** 供场景、会话事件与 React 命令层统一调用的轻提示门面。 */
export const toast = {
  loot(
    itemId: string,
    label: string,
    delta = 1,
    iconKey?: string | null,
  ): void {
    dispatch((mgr, textures) => {
      const resolved =
        iconKey !== undefined ? iconKey : resolveItemIconKey(itemId, textures);
      mgr.loot(itemId, label, delta, resolved);
    });
  },
  warn(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.warn(label, key);
    });
  },
  error(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.error(label, key);
    });
  },
  info(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.info(label, key);
    });
  },
  gain(label: string, key: string | null = null): void {
    dispatch((mgr) => {
      mgr.gain(label, key);
    });
  },
  /** 兼容旧版通用签名 (text, tone)。 */
  show(label: string, tone: "info" | "good" | "warn" | "error" = "info"): void {
    dispatch((mgr) => {
      mgr.show(label, tone);
    });
  },
  clear(): void {
    pending.length = 0;
    activeManager?.clear();
  },
};
