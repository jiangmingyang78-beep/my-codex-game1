import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

/** Shown when a run or the game scene fails to start; always offers a way back. */
export function ErrorScreen() {
  const error = useUi((s) => s.error);
  if (!error) return null;
  return (
    <div
      data-ocid="game.error_state"
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-night/85 p-3"
    >
      <section
        aria-label="游戏出错"
        className="pixel-panel flex w-full max-w-md flex-col gap-4 p-6"
      >
        <h2 className="font-pixel text-center text-2xl font-bold text-hp text-pixel-shadow">
          游戏无法继续
        </h2>
        <p role="alert" className="text-center text-sm text-foreground">
          {error}
        </p>
        <PixelButton
          data-ocid="game.back_to_title_button"
          onClick={() => commands.toTitle()}
          className="py-3"
        >
          返回标题
        </PixelButton>
      </section>
    </div>
  );
}
