import { House, Play, Save, Volume2, VolumeX } from "lucide-react";
import { toggleMuted } from "../audio/sfx";
import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

export function PauseMenu() {
  const muted = useUi((s) => s.muted);
  const eternal = useUi((s) => Boolean(s.hud?.eternal));
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/60 p-3">
      <section
        aria-label="Pause menu"
        className="pixel-panel max-h-full w-full max-w-xs space-y-3 overflow-y-auto p-5"
      >
        <h2 className="font-pixel text-center text-xl font-bold text-ember-glow">
          Paused
        </h2>
        <PixelButton
          onClick={() => commands.resume()}
          className="flex w-full items-center justify-center gap-2 py-3"
        >
          <Play size={16} /> Resume
        </PixelButton>
        {!eternal && (
          <PixelButton
            variant="ghost"
            onClick={() => commands.save()}
            className="flex w-full items-center justify-center gap-2 py-2.5"
          >
            <Save size={16} /> Save progress
          </PixelButton>
        )}
        <PixelButton
          variant="ghost"
          onClick={toggleMuted}
          className="flex w-full items-center justify-center gap-2 py-2.5"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{" "}
          {muted ? "Sound off" : "Sound on"}
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => commands.toTitle()}
          className="flex w-full items-center justify-center gap-2 py-2.5"
        >
          <House size={16} /> Return to title
        </PixelButton>
        <PixelButton
          variant="ghost"
          className="w-full"
          onClick={() => {
            if (eternal || commands.save())
              window.location.assign("./survival.html");
          }}
        >
          Go to Survival Mode
        </PixelButton>
        <p className="text-center text-xs text-muted-foreground">
          Press Esc to resume · Shift to dash (costs 3 fullness and grants brief
          invulnerability)
        </p>
      </section>
    </div>
  );
}
