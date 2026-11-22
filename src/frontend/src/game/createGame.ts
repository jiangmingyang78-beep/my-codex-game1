import Phaser from "phaser";
import { bindAudioUnlock, syncMuteState } from "./audio/sfx";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { TitleScene } from "./scenes/TitleScene";
import { discardPendingRun } from "./session/activeRun";
import { uiStore } from "./ui/store";
import { refreshTitleInfo } from "./ui/titleInfo";

/** True when the browser can create a WebGL context; otherwise Phaser must use the 2D canvas renderer. */
function webglAvailable(): boolean {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

function launch(parent: HTMLElement, type: number): Phaser.Game {
  return new Phaser.Game({
    type,
    parent,
    backgroundColor: "#0b0f1e",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    banner: false,
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    scene: [BootScene, TitleScene, GameScene],
  });
}

/** Keeps the React title available when Phaser cannot launch. */
function launchSafely(parent: HTMLElement): Phaser.Game | null {
  const first = webglAvailable() ? Phaser.AUTO : Phaser.CANVAS;
  try {
    return launch(parent, first);
  } catch (error) {
    console.error(error);
  }
  if (first === Phaser.CANVAS) return null;
  parent.replaceChildren();
  try {
    return launch(parent, Phaser.CANVAS);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Creates the Phaser game inside `parent`. Returns a disposer that destroys it (StrictMode-safe). */
export function createGame(parent: HTMLElement): () => void {
  const unbindAudio = bindAudioUnlock();
  syncMuteState();
  refreshTitleInfo();
  const game = launchSafely(parent);
  return () => {
    unbindAudio();
    game?.destroy(true);
    discardPendingRun();
    uiStore.reset();
  };
}
