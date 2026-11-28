import { EVT, type StepInputState } from "@/core";
import { summarizeRunSnapshot } from "@/core/snapshot";
import { releasePopulation } from "@/systems/combat/spawnPopulation";
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

interface SceneView {
  scenery: Scenery;
  entities: EntityViews;
  keys: InputController;
  telegraphLayer: TelegraphLayer;
  combatFeel: CombatFeelController;
  torchlight: TorchlightAtmosphereLayer;
  combatMotion: CombatMotionVfxLayer;
  snowFootprints: SnowFootprintLayer;
}

/**
 * The playable scene. Time only advances through `session.advance`, which is called solely
 * while the screen is "playing"; pause, panels, the result screen and a hidden tab never step.
 */
export class GameScene extends Phaser.Scene {
  private mode: StartMode = "new";
  private heroId?: string;
  private fromTitle = false;
  private session!: RunSession;
  private view: SceneView | null = null;
  private wasFrozen = false;
  private inputBuffer = new CombatInputBuffer();
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
    breadcrumb(`Scene ${SCENE.game}`);
    this.view = null;
    this.cleanups = [];
    this.events.once("shutdown", () => this.teardown());
    registerHeroAnimations(this);
    const attached = takePendingRun();
    if (this.fromTitle && !attached) return;
    try {
      this.view = this.build(attached);
    } catch (error) {
      console.error(error);
      reportFailure(
        "Playground is starting unsuccessfully. Please return the title and try again.",
        error,
      );
      this.teardown();
    }
  }

  private build(attached: RunSession | null): SceneView {
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
    const scenery = new Scenery(
      this,
      this.session.sys,
      gen,
      state,
      !this.session.eternal,
    );
    this.cleanups.push(() => scenery.destroy());
    const entities = new EntityViews(this, this.session.sys, gen, state.heroId);
    this.inputBuffer.clear();
    const telegraphLayer = new TelegraphLayer(this, {
      windupTimerMode: "remaining",
    });
    const reducedMotion = prefersReducedMotion();
    const torchlight = new TorchlightAtmosphereLayer(this, { reducedMotion });
    const combatMotion = new CombatMotionVfxLayer(this, { reducedMotion });
    const snowFootprints = new SnowFootprintLayer(this, {
      reducedMotion,
      snowTileIds: SNOW_TILE_IDS,
    });
    const combatFeel = new CombatFeelController(this, { reducedMotion });
    combatFeel.setHeroTarget(entities.hero);
    const keys = new InputController(this);
    this.cleanups.push(
      () => telegraphLayer.destroy(),
      () => combatFeel.destroy(),
      () => torchlight.destroy(),
      () => combatMotion.destroy(),
      () => snowFootprints.destroy(),
      lockNearestFilter(this),
      configureCamera(this, this.session.sys, entities.hero),
      this.bindUi(),
      watchTab(() => this.away()),
    );
    this.cameras.main.centerOn(state.hero.x, state.hero.y);
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
    return {
      scenery,
      entities,
      keys,
      telegraphLayer,
      combatFeel,
      torchlight,
      combatMotion,
      snowFootprints,
    };
  }

  update(time: number, deltaMs: number): void {
    const view = this.view;
    if (!view) {
      // Failed to build: once the player leaves the error screen, go back to the title scene.
      if (!uiStore.get().error) this.scene.start(SCENE.title);
      return;
    }
    const sec = Math.min(deltaMs / 1000, 0.1);
    const input = view.keys.poll();
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
      const stepDtMs = view.combatFeel.consumeStepDt(deltaMs);
      // Keep a one-frame key edge until simulation resumes after hit stop.
      this.inputBuffer.record(rawStep, this.wasFrozen ? 0 : stepDtMs);
      this.wasFrozen = stepDtMs <= 0;
      const { state, sys } = this.session;
      const cam = this.cameras.main;
      sys.spawnView = {
        x: cam.scrollX + (cam.width - cam.width / cam.zoom) / 2,
        y: cam.scrollY + (cam.height - cam.height / cam.zoom) / 2,
        width: cam.width / cam.zoom,
        height: cam.height / cam.zoom,
      };
      if (stepDtMs > 0) {
        const resolved = this.inputBuffer.resolve(rawStep, {
          canAttack: state.hero.attackCooldownSec <= 0,
          canDash: getDashCooldownState(state, sys).remainingSec <= 0,
          canInteract: nearestInteractable(state, sys) !== null,
        });
        this.step(Math.min(stepDtMs / 1000, 0.1), resolved, view);
      }
    }
    this.render(view, time / 1000, sec, deltaMs);
  }

  private step(sec: number, input: StepInputState, view: SceneView): void {
    const preHero = {
      x: this.session.state.hero.x,
      y: this.session.state.hero.y,
    };
    const out = this.session.advance(sec, input, undefined);
    this.present(out, preHero, view);
  }

  private render(
    view: SceneView,
    timeSec: number,
    sec: number,
    deltaMs: number,
  ): void {
    const { state, sys } = this.session;
    const darkness = darknessAt(state.elapsedSec, sys.data.balance.clock);
    view.entities.sync(state, timeSec);
    view.torchlight.sync(state, sys, sec, timeSec);
    view.combatMotion.syncRiposteAura(state, timeSec);
    view.combatMotion.syncHeroSlash(state, sys);
    view.combatMotion.syncDashAfterimage(
      state,
      this.screen === "playing" && this.session.playing
        ? view.entities.hero
        : null,
      deltaMs,
    );
    view.snowFootprints.sync(state, sys, sec);
    view.telegraphLayer.syncFromState(state, sys, timeSec);
    view.combatFeel.syncHudOverlays(state, sys, timeSec);
    view.scenery.update(state, sec, darkness);
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
    view = this.view,
  ): void {
    if (!view) return;
    handleOutput(out, this.session, view.scenery, {
      openCraft: () => this.openCraft(),
      ended: () => this.showResult(),
      hurt: () => undefined,
    });
    view.combatFeel.processEvents(out.events);
    for (const e of out.events) {
      if (e.type !== EVT.COMBAT_RIPOSTE_STRIKE) continue;
      const { dirX, dirY, rangePx } = e.payload;
      if (
        typeof dirX === "number" &&
        typeof dirY === "number" &&
        typeof rangePx === "number"
      ) {
        view.combatMotion.triggerCounterThrust(
          e.x ?? this.session.state.hero.x,
          e.y ?? this.session.state.hero.y,
          dirX,
          dirY,
          rangePx,
          view.entities.hero,
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
        this.view?.entities.sync(this.session.state, this.time.now / 1000);
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
    this.view = null;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    if (this.session) releasePopulation(this.session.state);
  }
}
