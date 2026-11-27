import type { HeroDef } from "@/core";
import { UserRound } from "lucide-react";
import { useState } from "react";

interface HeroPortraitProps {
  hero: Pick<HeroDef, "id" | "name">;
  unlocked: boolean;
}

export function HeroPortrait({ hero, unlocked }: HeroPortraitProps) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const failed = failedId === hero.id;
  const stateTone = unlocked ? "" : "grayscale brightness-50";
  const frame = `h-24 w-24 shrink-0 border border-border select-none ${stateTone}`;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={hero.id}
        className={`${frame} flex flex-col items-center justify-center gap-0.5 bg-night/80 text-frost`}
      >
        <UserRound size={18} aria-hidden="true" className="opacity-75" />
        <span className="font-pixel text-xs font-bold leading-none">
          {hero.name.slice(0, 1)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/portraits/${hero.id}.png`}
      className={`${frame} object-cover object-center [image-rendering:auto]`}
      alt={hero.id}
      draggable={false}
      onError={() => setFailedId(hero.id)}
    />
  );
}
