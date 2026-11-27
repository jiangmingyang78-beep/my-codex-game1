import { DevToolbar } from "../dev/DevToolbar";
import { CraftPanel } from "./CraftPanel";
import { ErrorScreen } from "./ErrorScreen";
import { EternalOverlay } from "./EternalPrepPanel";
import { Hud } from "./Hud";
import { PromptBubble, Toasts } from "./Overlays";
import { PauseMenu } from "./PauseMenu";
import { ResultScreen } from "./ResultScreen";
import { TitleScreen } from "./TitleScreen";
import { useUi } from "./store";

/** DOM layer over the Phaser canvas. Everything is click-through except its buttons and panels. */
export function GameUi() {
  const screen = useUi((s) => s.screen);
  const failed = useUi((s) => s.error !== null);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {screen === "title" && (
        <>
          <div className="vignette absolute inset-0" />
          <div className="scanlines absolute inset-0 opacity-40" />
        </>
      )}
      {failed ? (
        <ErrorScreen />
      ) : screen === "title" ? (
        <TitleScreen />
      ) : (
        <>
          <Hud />
          {screen === "playing" && <PromptBubble />}
          {screen === "playing" && <EternalOverlay />}
          {import.meta.env.DEV && screen === "playing" && <DevToolbar />}
          <Toasts />
          {screen === "paused" && <PauseMenu />}
          {screen === "craft" && <CraftPanel />}
          {screen === "result" && <ResultScreen />}
        </>
      )}
    </div>
  );
}
