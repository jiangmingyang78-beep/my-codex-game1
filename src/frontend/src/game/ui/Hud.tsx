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
import type { ReactNode } from "react";
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

function StatBar({ icon, label, value, max, tone }: BarProps) {
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
}

function formatStorm(sec: number): string {
  const total = Math.max(0, Math.ceil(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Hud() {
  const hud = useUi((s) => s.hud);
  const objective = useUi((s) => s.objective);
  const muted = useUi((s) => s.muted);
  const nearCamp = useUi((s) => s.nearCamp);
  if (!hud) return null;
  const night = hud.phase === "night";
  return (
    <>
      <div className="absolute left-2 top-2 flex w-[min(11rem,42vw)] flex-col gap-2 sm:left-3 sm:top-3 sm:w-48">
        <div data-hud-top-left className="flex flex-col gap-2">
          <div className="pixel-panel flex flex-col gap-2 p-2">
            <StatBar
              icon={<Heart size={14} />}
              label="生命"
              value={hud.hp}
              max={hud.maxHp}
              tone="bar-hp"
            />
            <StatBar
              icon={<Utensils size={14} />}
              label="饱食"
              value={hud.hunger}
              max={hud.maxHunger}
              tone="bar-hunger"
            />
            <StatBar
              icon={<Flame size={14} />}
              label="火炬"
              value={hud.light}
              max={hud.maxLight}
              tone="bar-torch"
            />
            <p className="text-xs text-frost">
              {hud.inFire
                ? "在火圈内：火炬恢复中"
                : night
                  ? "夜里火炬会渐渐熄灭"
                  : "白天火炬不会消耗"}
              {hud.buffSecondsLeft > 0 &&
                ` · 暖汤 ${Math.ceil(hud.buffSecondsLeft)} 秒`}
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

      <div
        data-hud-clock
        className={`pixel-panel absolute right-2 top-14 flex max-w-[calc(58vw_-_1.5rem)] items-center gap-2 px-2 py-2 md:left-1/2 md:right-auto md:top-3 md:max-w-none md:-translate-x-1/2 md:justify-center md:gap-3 md:px-3 ${hud.eternal ? "md:w-80" : "md:w-52"}`}
      >
        {hud.eternal ? (
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
            {(hud.eternal?.clockText ?? `${hud.dayLabel} · ${hud.clock}`)
              .split(" · ")
              .map((part, index) => (
                <span key={part} className="inline-block whitespace-nowrap">
                  {index > 0 && (
                    <span className="hidden md:inline">{" · "}</span>
                  )}
                  {part}
                </span>
              ))}
          </p>
          <p className="text-xs text-muted-foreground">
            {hud.eternal
              ? hud.eternal.threatText
              : `${hud.regionName} · 风暴 ${formatStorm(hud.stormRemainingSec)}`}
          </p>
        </div>
      </div>

      <div
        data-hud-actions
        className="absolute right-2 top-2 flex gap-2 sm:right-3 sm:top-3"
      >
        <PixelButton
          variant="ghost"
          aria-label={muted ? "取消静音" : "静音"}
          onClick={toggleMuted}
          className="p-2"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </PixelButton>
        <PixelButton
          variant="ghost"
          aria-label="暂停"
          onClick={() => commands.pause()}
          className="p-2"
        >
          <Pause size={16} />
        </PixelButton>
      </div>

      {nearCamp && (
        <PixelButton
          onClick={() => commands.openCraft()}
          className="absolute bottom-24 right-3 sm:bottom-28"
        >
          营火：制作
        </PixelButton>
      )}
      <QuickSlots slots={hud.quickSlots} />
    </>
  );
}
