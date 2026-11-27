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
import type { Screen } from "../ui/store";
import { toast } from "../ui/toastBridge";

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
        toast.info("永恒模式为单局制，不写入存档", "sys:eternal_nosave");
        return false;
      }
      const ok = session.save();
      if (ok) toast.gain("进度已保存", "sys:save");
      else toast.error("保存失败：本地存储不可用", "error:save_failed");
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
    viewRecipe: (id) => {
      if (
        hooks.getScreen() === "craft" &&
        session.state.unreadRecipeIds.delete(id)
      ) {
        session.save();
        hooks.refreshCraft();
      }
    },
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
      else toast.warn("离营火太远", "warn:too_far_camp");
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
