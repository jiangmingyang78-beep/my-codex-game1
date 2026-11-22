import { nearestInteractable } from "@/systems";
import Phaser from "phaser";
import { playSfx, syncMuteState } from "../audio/sfx";
import { HUD_REFRESH_SEC, REGISTRY, SCENE } from "../config";
import { InputController } from "../input/InputController";
import { RunSession, type StartMode } from "../session/RunSession";
import {
  reportFailure,
  returnToTitle,
  takePendingRun,
} from "../session/activeRun";
import { buildCraftView } from "../session/craftView";
import { handleOutput } from "../session/outputHandler";
import type { TextureGenerator } from "../textures/registerTextures";
import { bindCommands } from "../ui/commands";
import { type Screen, uiStore } from "../ui/store";
import { currentPrompt, publishHud, publishPrompt } from "../ui/uiSync";
import { EntityViews } from "../world/EntityViews";
import { Scenery } from "../world/Scenery";
import { configureCamera } from "../world/cameraRig";
import { darknessAt } from "../world/darkness";

type PlayScreen = Exclude<Screen, "title">;

/**
 * The playable scene. Time only advances through `session.advance`, which is called solely
 * while the screen is "playing"; pause, panels, the result screen and a hidden tab never step.
 */
export class GameScene extends Phaser.Scene {
  private mode: StartMode = "new";
  private fromTitle = false;
  private session!: RunSession;
  private scenery: Scenery | null = null;
  private entities!: EntityViews;
  private keys!: InputController;
  private ready = false;
  private screen: PlayScreen = "playing";
  private cleanups: (() => void)[] = [];
  private queued = { interact: false, attack: false };
  private hudClock = 0;

  constructor() {
    super(SCENE.game);
  }

  init(data: { mode?: StartMode; fromTitle?: boolean }): void {
    this.mode = data.mode ?? "new";
    this.fromTitle = data.fromTitle ?? false;
  }

  create(): void {
    this.ready = false;
    this.scenery = null;
    this.cleanups = [];
    this.events.once("shutdown", () => this.teardown());
    const attached = takePendingRun();
    if (this.fromTitle && !attached) return;
    try {
      this.build(attached);
      this.ready = true;
    } catch (error) {
      console.error(error);
      this.teardown();
      reportFailure("游戏场景启动失败，请返回标题后重试。");
    }
  }

  private build(attached: RunSession | null): void {
    this.session = attached ?? new RunSession(this.mode);
    const { state } = this.session;
    const gen = this.registry.get(
      REGISTRY.textureGenerator,
    ) as TextureGenerator;
    this.scenery = new Scenery(this, this.session.sys, gen, state);
    this.entities = new EntityViews(this, this.session.sys);
    this.keys = new InputController(this);
    this.cleanups.push(
      configureCamera(this, this.session.sys, this.entities.hero),
    );
    this.cameras.main.centerOn(state.hero.x, state.hero.y);
    this.cleanups.push(this.bindUi(), this.watchTab());
    this.screen = "playing";
    syncMuteState();
    uiStore.set({
      screen: "playing",
      craft: null,
      result: null,
      prompt: null,
      nearCamp: false,
      error: null,
      toasts: [],
    });
    publishHud(this.session.hud(), state, this.session.sys);
    if (this.session.startNotice)
      uiStore.toast(this.session.startNotice, "warn");
  }

  update(time: number, deltaMs: number): void {
    if (!this.ready) {
      // Failed to build: once the player leaves the error screen, go back to the title scene.
      if (!uiStore.get().error) this.scene.start(SCENE.title);
      return;
    }
    const sec = Math.min(deltaMs / 1000, 0.1);
    const input = this.keys.poll();
    if (input.pausePressed) this.togglePause();
    if (this.screen === "playing" && this.session.playing) {
      if (input.slot !== null) this.quickUse(input.slot);
      this.step(sec, input);
    }
    this.render(time / 1000, sec);
  }

  private step(sec: number, input: ReturnType<InputController["poll"]>): void {
    const interactPressed = input.interactPressed || this.queued.interact;
    const attackPressed = input.attackPressed || this.queued.attack;
    this.queued = { interact: false, attack: false };
    const out = this.session.advance(
      sec,
      {
        moveX: input.moveX,
        moveY: input.moveY,
        attackPressed,
        interactPressed,
        itemId: null,
        pausePressed: false,
      },
      undefined,
    );
    this.present(out);
  }

  private render(timeSec: number, sec: number): void {
    const { state, sys } = this.session;
    const scenery = this.scenery;
    if (!scenery) return;
    const darkness = darknessAt(state.elapsedSec, sys.data.balance.clock);
    this.entities.sync(state, timeSec);
    scenery.update(state, sec, darkness);
    const { stats } = sys.data.balance;
    const glow = 22 + 40 * (state.hero.light / stats.light.max);
    scenery.overlay.heroLight = {
      x: state.hero.x,
      y: state.hero.y - 6,
      radius: glow,
      alpha: 0.85,
    };
    if (this.screen === "playing")
      publishPrompt(currentPrompt(state, sys, this.cameras.main));
    this.hudClock += sec;
    if (this.hudClock >= HUD_REFRESH_SEC) {
      this.hudClock = 0;
      publishHud(this.session.hud(), state, sys);
    }
  }

  private present(out: ReturnType<RunSession["advance"]>): void {
    handleOutput(out, this.session, this.scenery as Scenery, {
      openCraft: () => this.openCraft(),
      ended: () => this.showResult(),
      hurt: () => this.cameras.main.shake(110, 0.004),
    });
  }

  private setScreen(screen: PlayScreen): void {
    this.screen = screen;
    uiStore.set({ screen });
  }

  private togglePause(): void {
    if (this.screen === "playing") this.setScreen("paused");
    else if (this.screen === "paused") this.setScreen("playing");
    else if (this.screen === "craft") this.closeCraft();
  }

  private openCraft(): void {
    if (this.screen !== "playing") return;
    this.setScreen("craft");
    this.refreshCraft();
  }

  private closeCraft(): void {
    if (this.screen === "craft") this.setScreen("playing");
  }

  private refreshCraft(): void {
    uiStore.set({
      craft: buildCraftView(this.session.state, this.session.sys),
    });
  }

  private showResult(): void {
    this.setScreen("result");
    uiStore.set({ result: this.session.result(), prompt: null });
  }

  private quickUse(slot: number): void {
    const itemId = this.session.sys.data.balance.hero.quickUseItemIds[slot - 1];
    if (itemId && this.screen === "playing" && this.session.playing)
      this.present(this.session.consumeItem(itemId));
  }

  private bindUi(): () => void {
    return bindCommands({
      pause: () => this.screen === "playing" && this.setScreen("paused"),
      resume: () => this.screen === "paused" && this.setScreen("playing"),
      save: () => {
        const ok = this.session.save();
        uiStore.toast(
          ok ? "进度已保存" : "保存失败：本地存储不可用",
          ok ? "good" : "warn",
        );
        playSfx("ui");
      },
      toTitle: () => {
        this.session.save();
        returnToTitle();
        this.scene.start(SCENE.title);
      },
      restart: () => this.scene.restart({ mode: "new" }),
      craft: (id) => {
        if (this.screen !== "craft") return;
        this.present(this.session.craft(id));
        this.refreshCraft();
      },
      quickUse: (slot) => this.quickUse(slot),
      interact: () => {
        this.queued.interact = true;
      },
      attack: () => {
        this.queued.attack = true;
      },
      openCraft: () => {
        const near = nearestInteractable(this.session.state, this.session.sys);
        if (near?.kind === "campfire") this.openCraft();
        else uiStore.toast("离营火太远", "warn");
      },
      closeCraft: () => this.closeCraft(),
    });
  }

  /** Saves and pauses when the tab is hidden or the window loses focus. */
  private watchTab(): () => void {
    const away = (): void => {
      if (!this.session.playing) return;
      this.session.save();
      if (this.screen === "playing") this.setScreen("paused");
    };
    const onVisibility = (): void => {
      if (document.hidden) away();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", away);
    };
  }

  private teardown(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.scenery?.destroy();
    this.scenery = null;
  }
}
