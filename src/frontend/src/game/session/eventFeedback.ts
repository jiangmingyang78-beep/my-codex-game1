import {
  EVT,
  type GameEvent,
  type Systems,
  itemName,
  reasonMessage,
} from "@/core";
import { type SfxName, playSfx } from "../audio/sfx";
import { toast } from "../ui/toastBridge";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function refusalText(e: GameEvent): string {
  return text(e.payload.message) || reasonMessage(text(e.payload.reason));
}

type FeedbackToast =
  | { kind: "loot"; itemId: string; label: string; delta: number }
  | { kind: "warn"; label: string; key?: string }
  | { kind: "info"; label: string; key?: string }
  | { kind: "gain"; label: string; key?: string };

interface Feedback {
  toast?: FeedbackToast;
  sfx?: SfxName;
}

function describe(e: GameEvent, sys: Systems): Feedback | null {
  const p = e.payload;
  switch (e.type) {
    case EVT.collected: {
      const itemId = text(p.itemId);
      return {
        toast: {
          kind: "loot",
          itemId,
          label: itemName(sys.data, itemId),
          delta: Number(p.count) || 1,
        },
        sfx: "gather",
      };
    }
    case EVT.itemPicked: {
      // 采集已触发 collected，只有地面掉落物才带 pickupId
      if (!("pickupId" in p)) return null;
      const itemId = text(p.itemId);
      return {
        toast: {
          kind: "loot",
          itemId,
          label: itemName(sys.data, itemId),
          delta: Number(p.count) || 1,
        },
        sfx: "pickup",
      };
    }
    case EVT.pickupRefused:
    case EVT.useRefused:
    case EVT.interactRefused:
    case EVT.gateRefused:
    case EVT.craftRefused: {
      const msg = refusalText(e);
      const reason = text(p.reason);
      return {
        toast: {
          kind: "warn",
          label: msg,
          key: reason ? `warn:${reason}` : undefined,
        },
      };
    }
    case EVT.itemUsed: {
      const itemId = text(p.itemId);
      return {
        toast: {
          kind: "info",
          label: `使用了 ${itemName(sys.data, itemId)}`,
          key: `use:${itemId}`,
        },
        sfx: "pickup",
      };
    }
    case EVT.craftDone: {
      const recipeId = text(p.recipeId);
      const name = sys.data.recipes.get(recipeId)?.name ?? "物品";
      return {
        toast: {
          kind: "gain",
          label: `制作完成：${name}`,
          key: `craft:${recipeId}`,
        },
        sfx: "craft",
      };
    }
    case EVT.campUpgraded:
      return {
        toast: {
          kind: "gain",
          label: `营火升到 ${Number(p.level)} 级，火圈变大了`,
          key: "camp:upgrade",
        },
      };
    case EVT.campLit:
      if (p.kind === "barrel_blast") return { sfx: "hit" };
      return {
        toast: {
          kind: "gain",
          label:
            p.objectId === sys.data.worldObjects.finalBeaconId
              ? "山脊烽台已点燃"
              : "火光已点亮，火圈永久扩展",
          key: "camp:lit",
        },
        sfx: "craft",
      };
    case EVT.gateOpened: {
      const regionId = text(p.regionId);
      return {
        toast: {
          kind: "gain",
          label: `${sys.data.regions.get(regionId)?.name ?? ""}的大门敞开了`,
          key: `gate:${regionId}`,
        },
      };
    }
    case EVT.blocked:
      if (p.targetId === "hero") {
        return {
          toast: {
            kind: "gain",
            label: text(p.message) || "锻铁圆盾格挡了攻击！",
            key: "block:hero",
          },
          sfx: "block",
        };
      }
      return {
        toast: {
          kind: "warn",
          label: text(p.message) || "攻击被护盾挡住，绕到侧面再出手",
          key: "warn:blocked",
        },
        sfx: "block",
      };
    case EVT.enemyPhaseChanged:
      return Number(p.phaseIndex) > 0
        ? {
            toast: {
              kind: "warn",
              label: `${sys.data.enemies.get(text(p.enemyId))?.name ?? "守卫"}进入下一阶段`,
              key: `boss:${text(p.enemyId)}:${Number(p.phaseIndex)}`,
            },
            sfx: "boss_phase",
          }
        : { sfx: "boss_phase" };
    case EVT.sealCollected:
      return {
        toast: {
          kind: "gain",
          label: `获得炉印 ${Number(p.count)}/2`,
          key: "quest:seal",
        },
        sfx: "craft",
      };
    case EVT.regionEntered: {
      const regionId = text(p.regionId);
      const ambience = sys.data.lore.regionToasts[regionId];
      return {
        toast: {
          kind: "info",
          label: [`进入：${text(p.name)}`, ambience]
            .filter(Boolean)
            .join(" · "),
          key: `region:${regionId}`,
        },
      };
    }
    case EVT.dusk:
      return {
        toast: {
          kind: "warn",
          label: "夜幕降临，留在火圈里",
          key: "clock:dusk",
        },
        sfx: "nightfall",
      };
    case EVT.dawn:
      return {
        toast: {
          kind: "gain",
          label: "天亮了，枯枝与浆果重新长出",
          key: "clock:dawn",
        },
      };
    case EVT.notice: {
      const msg = text(p.message);
      if (!msg) return null;
      if (p.tone === "warn") return { toast: { kind: "warn", label: msg } };
      if ("objectId" in p) {
        return {
          toast: {
            kind: "info",
            label: msg,
            key: `notice:${text(p.objectId)}`,
          },
        };
      }
      return { toast: { kind: "gain", label: msg } };
    }
    case EVT.hit:
      return p.kind ? { sfx: "hit" } : null;
    default:
      return null;
  }
}

function emitToast(t: FeedbackToast): void {
  if (t.kind === "loot") {
    toast.loot(t.itemId, t.label, t.delta);
  } else if (t.kind === "warn") {
    toast.warn(t.label, t.key ?? null);
  } else if (t.kind === "info") {
    toast.info(t.label, t.key ?? null);
  } else {
    toast.gain(t.label, t.key ?? null);
  }
}

/** 将规则事件分发为双通道轻提示与程序化音效。 */
export function presentEvents(
  events: readonly GameEvent[],
  sys: Systems,
): void {
  let played = false;
  for (const e of events) {
    const fb = describe(e, sys);
    if (!fb) continue;
    if (fb.toast) emitToast(fb.toast);
    if (fb.sfx && !(played && fb.sfx === "hit")) {
      playSfx(fb.sfx);
      played = played || fb.sfx === "hit";
    }
  }
}
