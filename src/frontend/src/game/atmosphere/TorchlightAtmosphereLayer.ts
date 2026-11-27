import type { RunState, Systems } from "@/core/types";
import { particleBudget } from "@/core/vfxBridge";
import { forEachFireSource } from "@/systems/campCircle";
import { syncRunLight } from "@/systems/world/runLight";
import Phaser from "phaser";
import { drawSpawnDebug } from "../dev/spawnDebug";
import { RENDER_DEPTH } from "../renderDepth";
import { darknessAt } from "../world/darkness";
import { ATMOSPHERE_PRESETS, type FlamePalette } from "./atmospherePresets";

interface TorchlightOptions {
  reducedMotion?: boolean;
  haloDepth?: number;
  emberDepth?: number;
}

const { flicker, vignette } = ATMOSPHERE_PRESETS;
const EMBER_CAPACITY = 24;
const EMBER_MAX_LIFE = 1.5;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function createEmber() {
  return { x: 0, y: 0, sway: 0, rise: 0, age: 0, life: 0 };
}

export class TorchlightAtmosphereLayer {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly emberGraphics: Phaser.GameObjects.Graphics;
  private readonly edge: Phaser.GameObjects.Graphics;
  private readonly reducedMotion: boolean;
  private readonly viewOrigin = new Phaser.Math.Vector2();
  private readonly embers: ReturnType<typeof createEmber>[];
  private readonly sources: { x: number; y: number; radius: number }[] = [];
  private palette = { ...ATMOSPHERE_PRESETS.flamePalette };
  private runId: string | null = null;
  private sourceCount = 0;
  private emberSource = 0;
  private emberCredit = 1;
  private edgeAlpha = 0;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options?: TorchlightOptions,
  ) {
    this.camera = scene.cameras.main;
    this.reducedMotion = options?.reducedMotion ?? false;
    this.embers = Array.from(
      { length: this.reducedMotion ? EMBER_CAPACITY / 2 : EMBER_CAPACITY },
      createEmber,
    );
    this.halo = scene.add
      .graphics()
      .setDepth(options?.haloDepth ?? RENDER_DEPTH.torchHalo);
    this.emberGraphics = scene.add
      .graphics()
      .setDepth(options?.emberDepth ?? RENDER_DEPTH.torchEmbers);
    this.edge = scene.add
      .graphics()
      .setDepth(vignette.depth)
      .setScrollFactor(0)
      .setVisible(false);
    this.camera.on(
      Phaser.Cameras.Scene2D.Events.PRE_RENDER,
      this.renderOverlays,
      this,
    );
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setFlamePalette(palette: FlamePalette): void {
    this.palette = { ...palette };
  }

  sync(state: RunState, sys: Systems, dtSec: number, timeSec: number): void {
    if (this.destroyed) return;
    const { hero } = state;
    const maxLight = sys.data.balance.stats.light.max;
    const light = maxLight > 0 ? clamp01(hero.light / maxLight) : 0;
    const dt = Math.max(0, dtSec);
    const smoothing = 1 - Math.exp(-8 * dt);
    if (this.runId !== state.runId) {
      this.runId = state.runId;
      this.edgeAlpha = 0;
      this.emberSource = 0;
      this.emberCredit = 1;
      for (const ember of this.embers) ember.life = 0;
    }
    const cold = hero.inFire
      ? 0
      : clamp01(1 - light / flicker.lowLightThreshold);
    this.edgeAlpha += (cold * vignette.maxAlpha - this.edgeAlpha) * smoothing;
    this.edge.setVisible(this.edgeAlpha > 0.001).setAlpha(this.edgeAlpha);

    this.halo.clear();
    this.halo.setAlpha(
      0.2 +
        0.8 *
          clamp01(darknessAt(state.elapsedSec, sys.data.balance.clock) / 0.8),
    );
    this.sourceCount = 0;
    forEachFireSource(state, sys, this.recordFire);
    const grid = syncRunLight(state, sys);
    const pulse = this.reducedMotion ? 1 : 0.96 + 0.04 * Math.sin(timeSec * 7);
    grid.forEachLitTile(this.camera.worldView, (x, y, level) => {
      if (level <= 2) return;
      this.halo
        .fillStyle(this.palette.ember, pulse * (0.035 + (0.12 * level) / 15))
        .fillRect(x, y, grid.tileSize, grid.tileSize);
    });
    if (import.meta.env.DEV) drawSpawnDebug(state, sys, grid, this.halo);

    const normalBudget = Math.min(
      EMBER_CAPACITY,
      Math.floor(particleBudget(sys.data, false)),
    );
    const budget = this.reducedMotion
      ? Math.min(
          Math.floor(normalBudget / 2),
          Math.floor(particleBudget(sys.data, true)),
        )
      : normalBudget;
    this.syncEmbers(Math.max(0, budget), dt);
  }

  private readonly recordFire = (
    x: number,
    y: number,
    radius: number,
  ): void => {
    if (!(radius > 0)) return;
    const index = this.sourceCount++;
    const source = this.sources[index];
    if (source) {
      source.x = x;
      source.y = y;
      source.radius = radius;
    } else {
      this.sources[index] = { x, y, radius };
    }
  };

  private syncEmbers(budget: number, dt: number): void {
    this.emberGraphics.clear();
    const rate = Math.min(this.sourceCount * 4, budget / EMBER_MAX_LIFE);
    this.emberCredit = Math.min(budget, this.emberCredit + dt * rate);
    for (let i = 0; i < this.embers.length; i++) {
      const ember = this.embers[i];
      if (i >= budget) {
        ember.life = 0;
        continue;
      }
      ember.age += dt;
      if (ember.age >= ember.life) {
        if (this.emberCredit < 1 || this.sourceCount === 0) continue;
        this.emberCredit -= 1;
        const source = this.sources[this.emberSource % this.sourceCount];
        this.emberSource = (this.emberSource + 1) % this.sourceCount;
        ember.x = source.x + Math.random() * 8 - 4;
        ember.y = source.y - 4 - Math.random() * 5;
        ember.sway = Math.random() * Math.PI * 2;
        ember.rise = 8 + Math.random() * 8;
        ember.age = 0;
        ember.life = 0.9 + Math.random() * (EMBER_MAX_LIFE - 0.9);
      }
      const progress = ember.age / ember.life;
      const sway = this.reducedMotion
        ? 0
        : 2 * Math.sin(ember.sway + ember.age * 3);
      const color =
        progress < 0.2
          ? this.palette.core
          : progress < 0.55
            ? this.palette.mid
            : this.palette.ember;
      this.emberGraphics
        .fillStyle(color, 0.8 * (1 - progress))
        .fillRect(
          Math.round(ember.x + sway),
          Math.round(ember.y - ember.rise * ember.age),
          2,
          2,
        );
    }
  }

  private renderOverlays(): void {
    if (!this.edge.visible) return;
    const camera = this.camera;
    const width = Math.ceil(camera.width / camera.zoomX);
    const height = Math.ceil(camera.height / camera.zoomY);
    camera.getWorldPoint(camera.x, camera.y, this.viewOrigin);
    this.edge
      .clear()
      .setPosition(
        this.viewOrigin.x - camera.scrollX,
        this.viewOrigin.y - camera.scrollY,
      );

    const band = Math.max(1, Math.floor(Math.min(width, height) / 28));
    for (let i = 0; i < 5; i++) {
      const inset = i * band;
      const w = width - 2 * inset;
      const h = height - 2 * inset;
      if (w <= 2 * band || h <= 2 * band) break;
      this.edge
        .fillStyle(vignette.lowLightColor, (1 - i / 5) ** 2)
        .fillRect(inset, inset, w, band)
        .fillRect(inset, inset + h - band, w, band)
        .fillRect(inset, inset + band, band, h - 2 * band)
        .fillRect(inset + w - band, inset + band, band, h - 2 * band);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.camera.off(
      Phaser.Cameras.Scene2D.Events.PRE_RENDER,
      this.renderOverlays,
      this,
    );
    this.halo.destroy();
    this.emberGraphics.destroy();
    this.edge.destroy();
  }
}
