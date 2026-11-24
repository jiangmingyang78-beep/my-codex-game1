import { nearestInteractable } from "@/systems";
import { playSfx } from "../audio/sfx";
import { createDevCommands } from "../dev/devTools";
import type {
  RunSession,
  SessionOutput,
  StartMode,
} from "../session/RunSession";
import { returnToTitle } from "../session/activeRun";
import { createEternalCommands } from "../session/eternalCommands";
import { bindCommands } from "../ui/commands";
import { type Screen, uiStore } from "../ui/store";

export type PlayScreen = Exclude<Screen, "title">;

export interface SceneCommandHooks {
  session: RunSession;
  getScreen(): PlayScreen;
  setScreen(screen: PlayScreen): void;
  openCraft(): void;
  closeCraft(): void;
  refreshCraft(): void;
  quickUse(slot: number): void;
  queueInteract(): void;
  queueAttack(): void;
  present(out: SessionOutput): void;
  syncDevVisuals(): void;
  pushHud(): void;
  toTitleScene(): void;
  restartScene(data: { mode: StartMode; heroId: string }): void;
}

/** Binds React UI commands to the active GameScene lifecycle; returns the unbind cleanup. */
export function bindSceneCommands(hooks: SceneCommandHooks): () => void {
  const { session } = hooks;
  return bindCommands({
    pause: () => hooks.getScreen() === "playing" && hooks.setScreen("paused"),
    resume: () => hooks.getScreen() === "paused" && hooks.setScreen("playing"),
    save: () => {
      if (session.eternal) {
        uiStore.toast("永恒模式为单局制，不写入存档", "info");
        return false;
      }
      const ok = session.save();
      uiStore.toast(
        ok ? "进度已保存" : "保存失败：本地存储不可用",
        ok ? "good" : "warn",
      );
      playSfx("ui");
      return ok;
    },
    toTitle: () => {
      session.save();
      returnToTitle();
      hooks.toTitleScene();
    },
    restart: () =>
      hooks.restartScene({
        mode: session.eternal ? "eternal" : "new",
        heroId: session.state.heroId,
      }),
    craft: (id) => {
      if (hooks.getScreen() !== "craft") return;
      hooks.present(session.craft(id));
      hooks.refreshCraft();
    },
    quickUse: (slot) => hooks.quickUse(slot),
    interact: () => hooks.queueInteract(),
    attack: () => hooks.queueAttack(),
    openCraft: () => {
      const near = nearestInteractable(session.state, session.sys);
      if (near?.kind === "campfire") hooks.openCraft();
      else uiStore.toast("离营火太远", "warn");
    },
    closeCraft: () => hooks.closeCraft(),
    ...(import.meta.env.DEV && {
      dev: createDevCommands(
        session.state,
        session.sys,
        (out) => hooks.present(out),
        () => hooks.syncDevVisuals(),
      ),
    }),
    ...(session.eternal && {
      eternal: createEternalCommands(session, () => hooks.pushHud()),
    }),
  });
}
