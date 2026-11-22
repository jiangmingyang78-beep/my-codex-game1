import {
  EVT,
  type GameEvent,
  type Systems,
  itemName,
  reasonMessage,
} from "@/core";
import { type SfxName, playSfx } from "../audio/sfx";
import { type ToastTone, uiStore } from "../ui/store";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function refusalText(e: GameEvent): string {
  return text(e.payload.message) || reasonMessage(text(e.payload.reason));
}

interface Feedback {
  toast?: [string, ToastTone];
  sfx?: SfxName;
}

function describe(e: GameEvent, sys: Systems): Feedback | null {
  const p = e.payload;
  switch (e.type) {
    case EVT.collected:
      return {
        toast: [
          `获得 ${itemName(sys.data, text(p.itemId))} ×${Number(p.count) || 1}`,
          "good",
        ],
        sfx: "gather",
      };
    case EVT.itemPicked:
      // Gathering also reports collected; only ground loot carries a pickupId key.
      if (!("pickupId" in p)) return null;
      return {
        toast: [
          `拾取 ${itemName(sys.data, text(p.itemId))} ×${Number(p.count) || 1}`,
          "good",
        ],
        sfx: "pickup",
      };
    case EVT.pickupRefused:
    case EVT.useRefused:
    case EVT.interactRefused:
    case EVT.gateRefused:
    case EVT.craftRefused:
      return { toast: [refusalText(e), "warn"] };
    case EVT.itemUsed:
      return {
        toast: [`使用了 ${itemName(sys.data, text(p.itemId))}`, "info"],
        sfx: "pickup",
      };
    case EVT.craftDone: {
      const name = sys.data.recipes.get(text(p.recipeId))?.name ?? "物品";
      return { toast: [`制作完成：${name}`, "good"], sfx: "craft" };
    }
    case EVT.campUpgraded:
      return { toast: [`营火升到 ${Number(p.level)} 级，火圈变大了`, "good"] };
    case EVT.campLit:
      return { toast: ["接力火盆已点亮，火圈永久扩展", "good"], sfx: "craft" };
    case EVT.gateOpened:
      return { toast: ["废磨坊的大门敞开了", "good"] };
    case EVT.sealCollected:
      return { toast: [`获得炉印 ${Number(p.count)}/2`, "good"], sfx: "craft" };
    case EVT.regionEntered:
      return { toast: [`进入：${text(p.name)}`, "info"] };
    case EVT.dusk:
      return { toast: ["夜幕降临，留在火圈里", "warn"], sfx: "nightfall" };
    case EVT.dawn:
      return { toast: ["天亮了，枯枝与浆果重新长出", "good"] };
    case EVT.hit:
      return p.kind ? { sfx: "hit" } : null;
    default:
      return null;
  }
}

/** Turns rule events into short Chinese toasts and generated sound effects. */
export function presentEvents(
  events: readonly GameEvent[],
  sys: Systems,
): void {
  let played = false;
  for (const e of events) {
    const fb = describe(e, sys);
    if (!fb) continue;
    if (fb.toast) uiStore.toast(fb.toast[0], fb.toast[1]);
    if (fb.sfx && !(played && fb.sfx === "hit")) {
      playSfx(fb.sfx);
      played = played || fb.sfx === "hit";
    }
  }
}
