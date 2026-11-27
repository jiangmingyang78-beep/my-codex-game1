import { EVT, type StepInputState } from "@/core";
import { summarizeRunSnapshot } from "@/core/snapshot";
import { getDashCooldownState } from "@/systems/movement";
import { nearestInteractable } from "@/systems/world/interact";
import { TILE } from "@/systems/world/worldTypes";
import Phaser from "phaser";
import { CombatMotionVfxLayer } from "../atmosphere/CombatMotionVfxLayer";
import { SnowFootprintLayer } from "../atmosphere/SnowFootprintLayer";
import { TorchlightAtmosphereLayer } from "../atmosphere/TorchlightAtmosphereLayer";
import { syncMuteState } from "../audio/sfx";
import { HUD_REFRESH_SEC, REGISTRY, SCENE } from "../config";
import { breadcrumb, setSnapshotReader } from "../diagnostics/report";
import { CombatFeelController } from "../feedback/CombatFeelController";
import { CombatInputBuffer } from "../feedback/InputBuffer";
import { TelegraphLayer } from "../feedback/TelegraphLayer";
import { InputController } from "../input/InputController";
import { RunSession, type StartMode } from "../session/RunSession";
import { reportFailure, takePendingRun } from "../session/activeRun";
import { buildCraftView } from "../session/craftView";
import { handleOutput } from "../session/outputHandler";
import { watchTab } from "../session/watchTab";
import { lockNearestFilter } from "../textures/pixelFilter";
import type { TextureGenerator } from "../textures/registerTextures";
import { uiStore } from "../ui/store";
import { toast } from "../ui/toastBridge";
import { currentPrompt, publishHud, publishPrompt } from "../ui/uiSync";
import { EntityViews } from "../world/EntityViews";
import { Scenery, prefersReducedMotion } from "../world/Scenery";
import { configureCamera } from "../world/cameraRig";
import { darknessAt } from "../world/darkness";
import {
  preloadHeroSpritesheets,
  registerHeroAnimations,
} from "../world/heroAnimations";
import type { ToastScene } from "./ToastScene";
import { type PlayScreen, bindSceneCommands } from "./bindSceneCommands";

const SNOW_TILE_IDS: ReadonlySet<number> = new Set([TILE.snow]);

/**
 * The playable scene. Time only advances through `session.advance`, which is called solely
 * while the screen is "playing"; pause, panels, the result screen and a hidden tab never step.
 */
export class GameScene extends Phaser.Scene {
  private mode: StartMode = "new";
  private heroId?: string;
  private fromTitle = false;
  private session!: RunSession;
  private scenery: Scenery | null = null;
  private entities!: EntityViews;
  private keys!: InputController;
  private inputBuffer = new CombatInputBuffer();
  private telegraphLayer: TelegraphLayer | null = null;
  private combatFeel: CombatFeelController | null = null;
  private torchlight: TorchlightAtmosphereLayer | null = null;
  private combatMotion: CombatMotionVfxLayer | null = null;
  private snowFootprints: SnowFootprintLayer | null = null;
  private ready = false;
  private screen: PlayScreen = "playing";
  private cleanups: (() => void)[] = [];
  private queued = { interact: false, attack: false };
  private hudClock = 0;

  constructor() {
    super(SCENE.game);
  }

  init(data: { mode?: StartMode; fromTitle?: boolean; heroId?: string }): void {
    this.mode = data.mode ?? "new";
    this.heroId = data.heroId;
    this.fromTitle = data.fromTitle ?? false;
  }

  preload(): void {
    preloadHeroSpritesheets(this);
  }

  create(): void {
    breadcrumb(`场景 ${SCENE.game}`);
    this.ready = false;
    this.scenery = null;
    this.cleanups = [];
    this.events.once("shutdown", () => this.teardown());
    registerHeroAnimations(this);
    const attached = takePendingRun();
    if (this.fromTitle && !attached) return;
    try {
      this.build(attached);
      this.ready = true;
    } catch (error) {
      console.error(error);
      reportFailure("游戏场景启动失败，请返回标题后重试。", error);
      this.teardown();
    }
  }

  private build(attached: RunSession | null): void {
    this.session = attached ?? new RunSession(this.mode, this.heroId);
    const { state } = this.session;
    this.cleanups.push(
      setSnapshotReader(() =>
        summarizeRunSnapshot(state, this.session.eternal),
      ),
    );
    const gen = this.registry.get(
      REGISTRY.textureGenerator,
    ) as TextureGenerator;
    this.scenery = new Scenery(
      this,
      this.session.sys,
      gen,
      state,
      !this.session.eternal,
    );
    this.entities = new EntityViews(this, this.session.sys, gen, state.heroId);
    this.inputBuffer.clear();
    this.telegraphLayer = new TelegraphLayer(this, {
      windupTimerMode: "remaining",
    });
    const reducedMotion = prefersReducedMotion();
    this.torchlight = new TorchlightAtmosphereLayer(this, { reducedMotion });
    this.combatMotion = new CombatMotionVfxLayer(this, { reducedMotion });
    this.snowFootprints = new SnowFootprintLayer(this, {
      reducedMotion,
      snowTileIds: SNOW_TILE_IDS,
    });
    this.combatFeel = new CombatFeelController(this, { reducedMotion });
    this.combatFeel.setHeroTarget(this.entities.hero);
    this.cleanups.push(lockNearestFilter(this));
    this.keys = new InputController(this);
    this.cleanups.push(
      configureCamera(this, this.session.sys, this.entities.hero),
    );
    this.cameras.main.centerOn(state.hero.x, state.hero.y);
    this.cleanups.push(
      this.bindUi(),
      watchTab(() => this.away()),
    );
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
    toast.clear();
    if (!this.scene.isActive(SCENE.toast)) this.scene.launch(SCENE.toast);
    this.scene.bringToTop(SCENE.toast);
    this.pushHud();
    if (this.session.startNotice)
      toast.warn(this.session.startNotice, "warn:start_notice");
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
      const rawStep: StepInputState = {
        moveX: input.moveX,
        moveY: input.moveY,
        attackPressed: input.attackPressed || this.queued.attack,
        interactPressed: input.interactPressed || this.queued.interact,
        itemId: null,
        pausePressed: false,
        dashPressed: input.dashPressed,
      };
      this.queued = { interact: false, attack: false };
      this.inputBuffer.record(rawStep, deltaMs);
      const { state, sys } = this.session;
      const cam = this.cameras.main;
      sys.spawnView = {
        x: cam.scrollX + (cam.width - cam.width / cam.zoom) / 2,
        y: cam.scrollY + (cam.height - cam.height / cam.zoom) / 2,
        width: cam.width / cam.zoom,
        height: cam.height / cam.zoom,
      };
      const resolved = this.inputBuffer.resolve(rawStep, {
        canAttack: state.hero.attackCooldownSec <= 0,
        canDash: getDashCooldownState(state, sys).remainingSec <= 0,
        canInteract: nearestInteractable(state, sys) !== null,
      });
      const stepDtMs = this.combatFeel
        ? this.combatFeel.consumeStepDt(deltaMs)
        : deltaMs;
      if (stepDtMs > 0) {
        this.step(Math.min(stepDtMs / 1000, 0.1), resolved);
      }
    }
    this.render(time / 1000, sec, deltaMs);
  }

  private step(sec: number, input: StepInputState): void {
    const preHero = {
      x: this.session.state.hero.x,
      y: this.session.state.hero.y,
    };
    const out = this.session.advance(sec, input, undefined);
    this.present(out, preHero);
  }

  private render(timeSec: number, sec: number, deltaMs: number): void {
    const { state, sys } = this.session;
    const scenery = this.scenery;
    if (!scenery) return;
    const darkness = darknessAt(state.elapsedSec, sys.data.balance.clock);
    this.entities.sync(state, timeSec);
    this.torchlight?.sync(state, sys, sec, timeSec);
    this.combatMotion?.syncRiposteAura(state, timeSec);
    this.combatMotion?.syncHeroSlash(state, sys);
    this.combatMotion?.syncDashAfterimage(
      state,
      this.screen === "playing" && this.session.playing
        ? this.entities.hero
        : null,
      deltaMs,
    );
    this.snowFootprints?.sync(state, sys, sec);
    this.telegraphLayer?.syncFromState(state, sys, timeSec);
    this.combatFeel?.syncHudOverlays(state, sys, timeSec);
    scenery.update(state, sec, darkness);
    if (this.screen === "playing")
      publishPrompt(currentPrompt(state, sys, this.cameras.main));
    this.hudClock += sec;
    if (this.hudClock >= HUD_REFRESH_SEC) {
      this.hudClock = 0;
      this.pushHud();
    }
  }

  private present(
    out: ReturnType<RunSession["advance"]>,
    preHero?: { x: number; y: number },
  ): void {
    handleOutput(out, this.session, this.scenery as Scenery, {
      openCraft: () => this.openCraft(),
      ended: () => this.showResult(),
      hurt: () => {
        if (!this.combatFeel) this.cameras.main.shake(110, 0.004);
      },
    });
    this.combatFeel?.processEvents(out.events);
    for (const e of out.events) {
      if (e.type !== EVT.COMBAT_RIPOSTE_STRIKE) continue;
      const { dirX, dirY, rangePx } = e.payload;
      if (
        typeof dirX === "number" &&
        typeof dirY === "number" &&
        typeof rangePx === "number"
      ) {
        this.combatMotion?.triggerCounterThrust(
          e.x ?? this.session.state.hero.x,
          e.y ?? this.session.state.hero.y,
          dirX,
          dirY,
          rangePx,
          this.entities.hero,
          preHero,
        );
      }
    }
  }

  private setScreen(screen: PlayScreen): void {
    if (screen !== "playing") this.inputBuffer.clear();
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
    return bindSceneCommands({
      session: this.session,
      getScreen: () => this.screen,
      setScreen: (s) => this.setScreen(s),
      openCraft: () => this.openCraft(),
      closeCraft: () => this.closeCraft(),
      refreshCraft: () => this.refreshCraft(),
      quickUse: (slot) => this.quickUse(slot),
      queueInteract: () => {
        this.queued.interact = true;
      },
      queueAttack: () => {
        this.queued.attack = true;
      },
      present: (out) => this.present(out),
      syncDevVisuals: () => {
        this.entities.sync(this.session.state, this.time.now / 1000);
        this.pushHud();
      },
      pushHud: () => this.pushHud(),
      toTitleScene: () => {
        this.scene.start(SCENE.title);
      },
      restartScene: (data) => {
        this.scene.restart(data);
      },
    });
  }

  private pushHud(): void {
    const { state, sys } = this.session;
    const hud = this.session.hud();
    publishHud(hud, state, sys);
    if (this.scene.isActive(SCENE.toast)) {
      const overlay = this.scene.get(SCENE.toast) as ToastScene;
      overlay.setHudEquipmentCount(hud.equipment.length);
    }
  }

  /** Pauses (and saves, outside Eternal Mode) when the tab is hidden or the window loses focus. */
  private away(): void {
    if (!this.session.playing) return;
    this.session.save();
    if (this.screen === "playing") this.setScreen("paused");
  }

  private teardown(): void {
    toast.clear();
    if (this.scene.isActive(SCENE.toast)) this.scene.stop(SCENE.toast);
    this.inputBuffer.clear();
    this.telegraphLayer?.destroy();
    this.telegraphLayer = null;
    this.combatFeel?.destroy();
    this.combatFeel = null;
    this.torchlight?.destroy();
    this.torchlight = null;
    this.combatMotion?.destroy();
    this.combatMotion = null;
    this.snowFootprints?.destroy();
    this.snowFootprints = null;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.scenery?.destroy();
    this.scenery = null;
  }
}
