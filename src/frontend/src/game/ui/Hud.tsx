import {
  Flame,
  Heart,
  Infinity as InfinityIcon,
  Moon,
  Pause,
  Sun,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";
import { type ReactNode, memo } from "react";
import { toggleMuted } from "../audio/sfx";
import { EquipmentRingRail } from "./EquipmentRingRail";
import { PixelButton } from "./PixelButton";
import { QuickSlots } from "./QuickSlots";
import { commands } from "./commands";
import { useUi } from "./store";

interface BarProps {
  icon: ReactNode;
  label: string;
  value: number;
  max: number;
  tone: "bar-hp" | "bar-hunger" | "bar-torch";
}

const HP_ICON = <Heart size={14} />;
const HUNGER_ICON = <Utensils size={14} />;
const LIGHT_ICON = <Flame size={14} />;

const StatBar = memo(function StatBar({
  icon,
  label,
  value,
  max,
  tone,
}: BarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <span className="w-4 shrink-0 text-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className={`pixel-bar ${tone} min-w-0 flex-1`} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="pixel-hud-text w-12 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-pixel-shadow sm:w-[3.75rem]">
        {label} {Math.ceil(value)}
      </span>
    </div>
  );
});

function formatStorm(sec: number): string {
  const total = Math.max(0, Math.ceil(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Hud() {
  const hud = useUi((s) => s.hud);
  const objective = useUi((s) => s.objective);
  if (!hud) return null;
  const night = hud.phase === "night";
  return (
    <>
      <div className="absolute left-2 top-2 flex w-[min(11rem,42vw)] flex-col gap-2 sm:left-3 sm:top-3 sm:w-48">
        <div data-hud-top-left className="flex flex-col gap-2">
          <div className="pixel-panel flex flex-col gap-2 p-2">
            <StatBar
              icon={HP_ICON}
              label="Health"
              value={hud.hp}
              max={hud.maxHp}
              tone="bar-hp"
            />
            <StatBar
              icon={HUNGER_ICON}
              label="Fullness"
              value={hud.hunger}
              max={hud.maxHunger}
              tone="bar-hunger"
            />
            <StatBar
              icon={LIGHT_ICON}
              label="Torch"
              value={hud.light}
              max={hud.maxLight}
              tone="bar-torch"
            />
            <p className="text-xs text-frost">
              {hud.inFire
                ? "In firelight: torch recharging"
                : night
                  ? "The torch fades at night"
                  : "The torch stays lit during daylight"}
              {hud.buffSecondsLeft > 0 &&
                `  ·  Hot soup ${Math.ceil(hud.buffSecondsLeft)} s`}
            </p>
          </div>
          <p className="pixel-panel-flat px-3 py-2 text-xs leading-4 text-foreground">
            {objective}
          </p>
        </div>
        {hud.equipment.length > 0 && (
          <EquipmentRingRail items={hud.equipment} />
        )}
      </div>

      <HudClock
        eternal={!!hud.eternal}
        night={night}
        clockText={hud.eternal?.clockText ?? `${hud.dayLabel} · ${hud.clock}`}
        threatText={
          hud.eternal?.threatText ??
          `${hud.regionName}  ·  Storm ${formatStorm(hud.stormRemainingSec)}`
        }
      />
      <HudActions />
      <QuickSlots slots={hud.quickSlots} />
    </>
  );
}

const HudClock = memo(function HudClock({
  eternal,
  night,
  clockText,
  threatText,
}: {
  eternal: boolean;
  night: boolean;
  clockText: string;
  threatText: string;
}) {
  return (
    <div
      data-hud-clock
      className={`pixel-panel absolute right-2 top-14 flex max-w-[calc(58vw_-_1.5rem)] items-center gap-2 px-2 py-2 md:left-1/2 md:right-auto md:top-3 md:max-w-none md:-translate-x-1/2 md:justify-center md:gap-3 md:px-3 ${eternal ? "md:w-80" : "md:w-52"}`}
    >
      {eternal ? (
        <InfinityIcon
          size={18}
          className="hidden shrink-0 text-accent md:block"
        />
      ) : night ? (
        <Moon size={18} className="text-accent" />
      ) : (
        <Sun size={18} className="text-warning" />
      )}
      <div className="leading-tight">
        <p className="font-pixel flex flex-wrap gap-x-2 text-xs leading-4 text-pixel-shadow md:gap-x-0 md:text-sm">
          {clockText.split(" · ").map((part, index) => (
            <span key={part} className="inline-block whitespace-nowrap">
              {index > 0 && <span className="hidden md:inline">{" · "}</span>}
              {part}
            </span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground">{threatText}</p>
      </div>
    </div>
  );
});

const HudActions = memo(function HudActions() {
  const muted = useUi((s) => s.muted);
  const nearCamp = useUi((s) => s.nearCamp);
  return (
    <>
      <div
        data-hud-actions
        className="absolute right-2 top-2 flex gap-2 sm:right-3 sm:top-3"
      >
        <PixelButton
          variant="ghost"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={toggleMuted}
          className="p-2 [@media(pointer:coarse)]:min-h-11"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </PixelButton>
        <PixelButton
          variant="ghost"
          aria-label="Pause"
          onClick={() => commands.pause()}
          className="p-2 [@media(pointer:coarse)]:min-h-11"
        >
          <Pause size={16} />
        </PixelButton>
      </div>

      {nearCamp && (
        <PixelButton
          onClick={() => commands.openCraft()}
          className="absolute bottom-24 right-3 sm:bottom-28"
        >
          Campfire: Craft
        </PixelButton>
      )}
    </>
  );
});
