import type { HudModel } from "@/core";
import { Bandage, Cherry, Cookie, Heart, Soup } from "lucide-react";
import type { ReactNode } from "react";
import { commands } from "./commands";

const ICONS: Record<string, ReactNode> = {
  berry: <Cherry size={20} />,
  ration: <Cookie size={20} />,
  warm_stew: <Soup size={20} />,
  bandage: <Bandage size={20} />,
};

export function QuickSlots({ slots }: { slots: HudModel["quickSlots"] }) {
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.slot}
          type="button"
          aria-label={`快捷栏 ${slot.slot}：${slot.name}，数量 ${slot.count}`}
          onClick={(e) => {
            commands.quickUse(slot.slot);
            e.currentTarget.blur();
          }}
          className={`pixel-panel-flat pointer-events-auto relative flex h-16 w-14 select-none flex-col items-center justify-center gap-0.5 transition-step hover:border-ring sm:h-[4.5rem] sm:w-16 ${
            slot.count === 0 ? "opacity-55" : ""
          }`}
        >
          <span className="font-pixel absolute left-1 top-0.5 text-[10px] text-ember">
            {slot.slot}
          </span>
          <span className="text-foreground">
            {ICONS[slot.itemId] ?? <Heart size={20} />}
          </span>
          <span className="text-[10px] leading-none text-foreground">
            {slot.name}
          </span>
          <span className="font-pixel absolute bottom-0.5 right-1 text-[11px] tabular-nums text-ember-glow">
            ×{slot.count}
          </span>
        </button>
      ))}
    </div>
  );
}
