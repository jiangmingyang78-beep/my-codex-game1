import { House, Play, Save, Volume2, VolumeX } from "lucide-react";
import { toggleMuted } from "../audio/sfx";
import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

export function PauseMenu() {
  const muted = useUi((s) => s.muted);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/60 p-3">
      <section
        aria-label="暂停菜单"
        className="pixel-panel flex w-full max-w-xs flex-col gap-3 p-5"
      >
        <h2 className="font-pixel text-center text-xl font-bold text-ember-glow">
          已暂停
        </h2>
        <PixelButton
          onClick={() => commands.resume()}
          className="flex items-center justify-center gap-2 py-3"
        >
          <Play size={16} /> 继续
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => commands.save()}
          className="flex items-center justify-center gap-2 py-2.5"
        >
          <Save size={16} /> 保存进度
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={toggleMuted}
          className="flex items-center justify-center gap-2 py-2.5"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{" "}
          {muted ? "声音：关" : "声音：开"}
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => commands.toTitle()}
          className="flex items-center justify-center gap-2 py-2.5"
        >
          <House size={16} /> 返回标题
        </PixelButton>
        <p className="text-center text-xs text-muted-foreground">
          Esc 也可继续游戏
        </p>
      </section>
    </div>
  );
}
