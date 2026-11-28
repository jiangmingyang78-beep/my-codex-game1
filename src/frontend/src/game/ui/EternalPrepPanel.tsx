import type { EternalHud, EternalOption } from "@/systems/eternal/eternalTypes";
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { getEquipmentIconUrl } from "../textures/equipmentIcons";
import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

function OptionCard({
  option,
  locked,
}: {
  option: EternalOption;
  locked: boolean;
}) {
  const url = getEquipmentIconUrl(option.id);
  const tone = option.selected
    ? "border-ember bg-ember/10 text-ember"
    : "border-border bg-muted text-foreground";
  return (
    <li>
      <button
        type="button"
        aria-pressed={option.selected}
        disabled={locked}
        title={option.description}
        onClick={(event) => {
          commands.eternal?.toggleEquipment(option.id);
          event.currentTarget.blur();
        }}
        className={`pointer-events-auto flex w-full items-center gap-2 border-2 px-2 py-1 text-left hover:border-frost focus-visible:outline-2 focus-visible:outline-frost disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
      >
        {url !== null ? (
          <img
            src={url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-6 w-6 shrink-0 select-none [image-rendering:pixelated]"
          />
        ) : (
          <Shield size={20} aria-hidden="true" className="shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-pixel block truncate text-xs font-bold">
            {option.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {option.kind === "weapon" ? "Weapon" : "Armor / light"}
          </span>
        </span>
      </button>
    </li>
  );
}

function ModeSwitch({ eternal }: { eternal: EternalHud }) {
  const modes = [
    ["standard", "Standard allowance"],
    ["free", "Free selection"],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {modes.map(([mode, label]) => (
        <PixelButton
          key={mode}
          variant={eternal.loadoutMode === mode ? "ember" : "ghost"}
          aria-pressed={eternal.loadoutMode === mode}
          onClick={() => commands.eternal?.setLoadoutMode(mode)}
          className="px-2 py-1 text-xs"
        >
          {label}
        </PixelButton>
      ))}
    </div>
  );
}

function QuotaLine({ eternal }: { eternal: EternalHud }) {
  const prep = eternal.phase === "prep";
  if (!prep)
    return (
      <p className="text-xs text-frost">
        Sub-election {eternal.pendingPicks} • One out of every 90 seconds
      </p>
    );
  if (eternal.loadoutMode === "free")
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-frost">
        <span>Free selection: no item limit</span>
        <span className="flex gap-1">
          <PixelButton
            variant="ghost"
            onClick={() => commands.eternal?.selectAllEquipment()}
            className="px-2 py-0.5 text-xs"
          >
            Select all
          </PixelButton>
          <PixelButton
            variant="ghost"
            onClick={() => commands.eternal?.clearEquipment()}
            className="px-2 py-0.5 text-xs"
          >
            Clear
          </PixelButton>
        </span>
      </div>
    );
  const { weaponQuota: w, gearQuota: g } = eternal;
  return (
    <p className="text-xs text-frost">
      Weapon {w.used}/{w.max} · Armor / light {g.used}/{g.max} · Start with the
      berries x 2, bandages x 2, snow herb ointment x 1
    </p>
  );
}

function LoadoutPanel({
  eternal,
  onClose,
}: {
  eternal: EternalHud;
  onClose: () => void;
}) {
  const prep = eternal.phase === "prep";
  return (
    <section
      aria-label="Eternal Mode loadout"
      className="pixel-panel pointer-events-auto absolute right-2 top-16 flex max-h-[calc(100dvh-11rem)] w-[min(20rem,calc(100vw-1rem))] flex-col gap-2 overflow-y-auto p-3 sm:right-3"
    >
      <h2 className="font-pixel text-sm font-bold text-ember-glow">
        {prep
          ? "Eternal Trial · Prepare your loadout"
          : "Resupply · Choose more gear"}
      </h2>
      {prep && <ModeSwitch eternal={eternal} />}
      <QuotaLine eternal={eternal} />
      <ul className="grid grid-cols-2 gap-2">
        {eternal.options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            locked={!prep && option.selected}
          />
        ))}
      </ul>
      {prep ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-pixel text-xs tabular-nums text-warning">
            Time to prepare {eternal.prepRemainingSec}s
          </span>
          <PixelButton
            onClick={() => commands.eternal?.startCombat()}
            className="px-3 py-1 text-xs"
          >
            Start fighting
          </PixelButton>
        </div>
      ) : (
        <PixelButton
          variant="ghost"
          onClick={onClose}
          className="px-3 py-1 text-xs"
        >
          Close
        </PixelButton>
      )}
    </section>
  );
}

/** Eternal Mode overlay: the loadout panel during prep or while claiming a supply pick. */
export function EternalOverlay() {
  const eternal = useUi((s) => s.hud?.eternal);
  const [open, setOpen] = useState(false);
  const picks = eternal?.pendingPicks ?? 0;
  useEffect(() => {
    if (picks <= 0) setOpen(false);
  }, [picks]);
  if (!eternal) return null;
  if (eternal.phase === "prep" || open)
    return <LoadoutPanel eternal={eternal} onClose={() => setOpen(false)} />;
  if (picks <= 0) return null;
  return (
    <PixelButton
      onClick={() => setOpen(true)}
      className="absolute bottom-40 right-3 px-3 py-2 text-xs"
    >
      Replenishment equipment (+){picks})
    </PixelButton>
  );
}
