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
    case EVT.collected:
    case EVT.itemPicked: {
      const isPickup = e.type === EVT.itemPicked;
      // Collection has been triggered by a lull in Xerox and only ground drops are carried with Id
      if (isPickup && !("pickupId" in p)) return null;
      const itemId = text(p.itemId);
      return {
        toast: {
          kind: "loot",
          itemId,
          label: itemName(sys.data, itemId),
          delta: Number(p.count) || 1,
        },
        sfx: isPickup ? "pickup" : "gather",
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
          label: `Used ${itemName(sys.data, itemId)}`,
          key: `use:${itemId}`,
        },
        sfx: "pickup",
      };
    }
    case EVT.craftDone: {
      const recipeId = text(p.recipeId);
      const name = sys.data.recipes.get(recipeId)?.name ?? "Item";
      return {
        toast: {
          kind: "gain",
          label: `Crafted: ${name}`,
          key: `craft:${recipeId}`,
        },
        sfx: "craft",
      };
    }
    case EVT.campUpgraded:
      return {
        toast: {
          kind: "gain",
          label: `Campfire upgraded to Level ${Number(p.level)}. The light reaches farther.`,
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
              ? "The Ridge Beacon is lit"
              : "Fire station lit. The light radius has permanently expanded.",
          key: "camp:lit",
        },
        sfx: "craft",
      };
    case EVT.gateOpened: {
      const regionId = text(p.regionId);
      return {
        toast: {
          kind: "gain",
          label: `Gate opened: ${sys.data.regions.get(regionId)?.name ?? regionId}`,
          key: `gate:${regionId}`,
        },
      };
    }
    case EVT.blocked:
      if (p.targetId === "hero") {
        return {
          toast: {
            kind: "gain",
            label:
              text(p.message) ||
              "Your Wrought-Iron Buckler blocked the attack!",
            key: "block:hero",
          },
          sfx: "block",
        };
      }
      return {
        toast: {
          kind: "warn",
          label:
            text(p.message) || "The shield blocked your attack. Try the flank.",
          key: "warn:blocked",
        },
        sfx: "block",
      };
    case EVT.COMBAT_RIPOSTE_ARMED:
      return {
        toast: {
          kind: "gain",
          label: "Ember Riposte ready!",
          key: "riposte:armed",
        },
        sfx: "riposte_arm",
      };
    case EVT.COMBAT_RIPOSTE_STRIKE: {
      const hits = Number(p.hitCount) || 0;
      const light = Math.round(Number(p.lightRestored) || 0);
      return hits > 0 && light > 0
        ? {
            toast: {
              kind: "gain",
              label: `Riposte landed! Torchlight +${light}`,
              key: "riposte:strike",
            },
            sfx: "riposte_strike",
          }
        : { sfx: "riposte_strike" };
    }
    case EVT.enemyPhaseChanged:
      return Number(p.phaseIndex) > 0
        ? {
            toast: {
              kind: "warn",
              label: `${sys.data.enemies.get(text(p.enemyId))?.name ?? "Guardian"} entered a new phase`,
              key: `boss:${text(p.enemyId)}:${Number(p.phaseIndex)}`,
            },
            sfx: "boss_phase",
          }
        : { sfx: "boss_phase" };
    case EVT.sealCollected:
      return {
        toast: {
          kind: "gain",
          label: `Ember Seals collected: ${Number(p.count)}/2`,
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
          label: [`Entered: ${text(p.name)}`, ambience]
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
          label: "Night is falling. Stay near firelight.",
          key: "clock:dusk",
        },
        sfx: "nightfall",
      };
    case EVT.dawn:
      return {
        toast: {
          kind: "gain",
          label: "Dawn. Branches and berries are growing again.",
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

/** Distribute rule events as two-channel light hints and program-based sound effects. */
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
