import type { HudEquipmentItem } from "@/core/hud";
import {
  Flame,
  Footprints,
  HardHat,
  type LucideIcon,
  Shield,
  Shirt,
  Sword,
  Wind,
} from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { getEquipmentIconUrl } from "../textures/equipmentIcons";

const FALLBACK_ICONS = new Map<string, LucideIcon>([
  ["iron_buckler", Shield],
  ["iron_armor", Shirt],
  ["iron_helm", HardHat],
  ["iron_boots", Footprints],
  ["iron_spear", Sword],
  ["iron_blade", Sword],
  ["fur_cloak", Wind],
  ["lantern", Flame],
  ["ember_lantern", Flame],
]);
const RING_RADIUS = 17.5;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function EquipmentBadge({ item }: { item: HudEquipmentItem }) {
  const tooltipId = useId();
  const pulse = useRef<HTMLSpanElement>(null);
  const wasCooling = useRef(false);
  const remaining = item.cooldownSec;
  const max = item.maxCooldownSec ?? 0;
  const cooling = remaining !== null && remaining > 0;
  const ready = remaining === 0;
  const seconds = Math.ceil(remaining ?? 0);
  const readyRatio =
    max > 0 ? Math.min(1, Math.max(0, 1 - (remaining ?? 0) / max)) : 1;
  const status = cooling ? `冷却 ${seconds} 秒` : ready ? "就绪" : "常驻生效";
  const url = getEquipmentIconUrl(item.id);
  const FallbackIcon = FALLBACK_ICONS.get(item.id) ?? Shield;

  useEffect(() => {
    const becameReady = wasCooling.current && ready;
    wasCooling.current = cooling;
    if (
      !becameReady ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const animation = pulse.current?.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.28)" },
      ],
      { duration: 350, easing: "steps(4)" },
    );
    return () => animation?.cancel();
  }, [cooling, ready]);

  return (
    <li className="group pointer-events-auto relative shrink-0 hover:z-10 focus-within:z-10">
      <button
        type="button"
        aria-label={item.name}
        aria-describedby={tooltipId}
        onClick={(event) => event.currentTarget.focus()}
        className="relative isolate flex h-9 w-9 items-center justify-center rounded-full before:absolute before:inset-0 before:-z-10 before:rounded-full before:bg-card before:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:h-10 sm:w-10"
      >
        <svg
          viewBox="0 0 40 40"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        >
          <circle
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2"
            className="stroke-border opacity-70"
          />
          {remaining !== null && (
            <circle
              cx="20"
              cy="20"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - readyRatio)}
              strokeLinecap="butt"
              className={ready ? "stroke-primary" : "stroke-accent"}
            />
          )}
        </svg>
        <span
          aria-hidden="true"
          className={
            cooling
              ? "text-frost opacity-45 grayscale-[40%]"
              : ready
                ? "text-ember-glow"
                : "text-frost"
          }
        >
          {url !== null ? (
            <img
              src={url}
              alt=""
              aria-hidden="true"
              className="h-6 w-6 select-none [image-rendering:pixelated]"
              draggable={false}
            />
          ) : (
            <FallbackIcon size={20} />
          )}
        </span>
        {cooling && (
          <span
            aria-hidden="true"
            className="font-pixel absolute bottom-0 right-0 border border-border bg-card px-1 text-xs leading-none tabular-nums text-accent"
          >
            {seconds}
          </span>
        )}
        <span
          ref={pulse}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary opacity-0"
        />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pixel-panel-flat pointer-events-none invisible absolute left-full top-0 ml-2 w-52 max-w-[calc(100vw_-_8rem)] px-3 py-2 text-xs group-hover:visible group-focus-within:visible"
      >
        <p className="font-pixel font-bold text-foreground">{item.name}</p>
        <p className={ready ? "text-ember-glow" : "text-frost"}>{status}</p>
        <p className="mt-1 leading-snug text-muted-foreground">
          {item.description}
        </p>
      </div>
    </li>
  );
}

export function EquipmentRingRail({ items }: { items: HudEquipmentItem[] }) {
  return (
    <ul
      aria-label="已锻装备"
      className="flex max-h-[42dvh] flex-col flex-wrap content-start items-start gap-2 overflow-visible"
    >
      {items.map((item) => (
        <EquipmentBadge key={item.id} item={item} />
      ))}
    </ul>
  );
}
