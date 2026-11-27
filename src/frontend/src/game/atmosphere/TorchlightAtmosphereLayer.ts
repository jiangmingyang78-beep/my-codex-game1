import type { RunState, Systems } from "@/core/types";
import { particleBudget } from "@/core/vfxBridge";
import { forEachFireSource } from "@/systems/campCircle";
import { heroLightRadiusMultiplier } from "@/systems/itemEffects";
import Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { darknessAt } from "../world/darkness";
import { ATMOSPHERE_PRESETS, type FlamePalette } from "./atmospherePresets";
import { makePixelHole } from "./pixelLightMask";

interface TorchlightOptions {
  reducedMotion?: boolean;
  manageDarknessMask?: boolean;
  haloDepth?: number;
  emberDepth?: number;
}

const { flicker, nightTint, vignette } = ATMOSPHERE_PRESETS;
const EMBER_CAPACITY = 24;
const EMBER_MAX_LIFE = 1.5;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function createEmber() {
  return { x: 0, y: 0, sway: 0, rise: 0, age: 0, life: 0 };
}

class PixelNightMask {
  private readonly holeTexture = makePixelHole();
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly holes: number[] = [];
  private tint = "";
  private alpha = 0;

  constructor(scene: Phaser.Scene) {
    const key = `atmosphere-night-${Phaser.Utils.String.UUID()}`;
    const texture = scene.textures.createCanvas(key, 1, 1);
    if (!texture) throw new Error("无法创建夜幕纹理");
    this.texture = texture;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.image = scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setDepth(RENDER_DEPTH.night)
      .setVisible(false);
  }

  sync(elapsedSec: number, clock: Systems["data"]["balance"]["clock"]): void {
    this.holes.length = 0;
    const { daySec, nightSec } = clock;
    const cycleSec = daySec + nightSec;
    const time = elapsedSec % cycleSec;
    const nightTime = time - daySec;
    const dusk = clamp01(1 + nightTime / (daySec * 0.2));
    const nightBlend = clamp01(nightTime / (nightSec * 0.4));
    const dawn = clamp01((cycleSec - time) / (nightSec * 0.2));
    this.alpha =
      nightTint.maxNightAlpha * dusk * (0.5 + 0.5 * nightBlend) * dawn;
    const visible = this.alpha > 0;
    this.image.setVisible(visible);
    if (!visible) return;

    const start = nightTint.duskColor;
    const end = nightTint.nightColor;
    const r = Math.round(
      Phaser.Math.Linear(start >> 16, end >> 16, nightBlend),
    );
    const g = Math.round(
      Phaser.Math.Linear((start >> 8) & 255, (end >> 8) & 255, nightBlend),
    );
    const b = Math.round(
      Phaser.Math.Linear(start & 255, end & 255, nightBlend),
    );
    this.tint = `rgb(${r}, ${g}, ${b})`;
  }

  addHole(x: number, y: number, radius: number, strength: number): void {
    if (this.alpha > 0) this.holes.push(x, y, radius, strength);
  }

  render(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (this.alpha <= 0) return;
    const view = camera.worldView;
    const x = Math.floor(view.x) - 2;
    const y = Math.floor(view.y) - 2;
    const width = Math.ceil(view.width) + 4;
    const height = Math.ceil(view.height) + 4;
    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.setSize(width, height);
      this.image.setSizeToFrame().setOrigin(0);
    }
    this.image.setPosition(x, y);
    const context = this.texture.getContext();
    context.clearRect(0, 0, width, height);
    context.fillStyle = this.tint;
    context.globalAlpha = this.alpha;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";
    context.imageSmoothingEnabled = false;
    for (let i = 0; i < this.holes.length; i += 4) {
      const radius = this.holes[i + 2];
      const left = this.holes[i] - x - radius;
      const top = this.holes[i + 1] - y - radius;
      const size = radius * 2;
      if (left >= width || top >= height || left + size <= 0 || top + size <= 0)
        continue;
      context.globalAlpha = this.holes[i + 3];
      context.drawImage(this.holeTexture, left, top, size, size);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    this.texture.refresh();
  }

  destroy(): void {
    this.image.destroy();
    this.texture.destroy();
  }
}

export class TorchlightAtmosphereLayer {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly emberGraphics: Phaser.GameObjects.Graphics;
  private readonly edge: Phaser.GameObjects.Graphics;
  private readonly night: PixelNightMask | null;
  private readonly reducedMotion: boolean;
  private readonly viewOrigin = new Phaser.Math.Vector2();
  private readonly embers: ReturnType<typeof createEmber>[];
  private readonly sources: { x: number; y: number; radius: number }[] = [];
  private palette = { ...ATMOSPHERE_PRESETS.flamePalette };
  private runId: string | null = null;
  private sourceCount = 0;
  private emberSource = 0;
  private emberCredit = 1;
  private smoothLight = 0;
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
    this.night = options?.manageDarknessMask ? new PixelNightMask(scene) : null;
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
      this.smoothLight = light;
      this.edgeAlpha = 0;
      this.emberSource = 0;
      this.emberCredit = 1;
      for (const ember of this.embers) ember.life = 0;
    }
    this.smoothLight += (light - this.smoothLight) * smoothing;
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
    this.night?.sync(state.elapsedSec, sys.data.balance.clock);
    this.sourceCount = 0;
    forEachFireSource(state, sys, this.recordFire);
    for (let i = 0; i < this.sourceCount; i++) {
      const { x, y, radius } = this.sources[i];
      this.drawLight(x, y, radius, 1, timeSec + (x + y) * 0.021, 1);
    }
    if (this.smoothLight > 0.001) {
      const multiplier = heroLightRadiusMultiplier(
        sys.data,
        state.inventory,
        state.heroId,
      );
      const radius =
        sys.data.tileSize * 2.75 * multiplier * Math.sqrt(this.smoothLight);
      this.drawLight(
        hero.x,
        hero.y,
        radius,
        Math.sqrt(this.smoothLight),
        timeSec,
        0.45 + cold,
      );
    }

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

  private drawLight(
    x: number,
    y: number,
    radius: number,
    strength: number,
    time: number,
    motion: number,
  ): void {
    const wave = this.reducedMotion
      ? 0
      : Math.sin(time * flicker.speedA) * 0.66 +
        Math.sin(time * flicker.speedB) * 0.34;
    const cx = Math.round(x);
    const cy = Math.round(y);
    const r = Math.max(
      1,
      Math.round(radius + wave * flicker.radiusJitterPx * motion),
    );
    const alpha = clamp01(strength + wave * flicker.alphaJitter * motion);
    this.fillLightBand(cx, cy, r, this.palette.ember, alpha * 0.06);
    this.fillLightBand(cx, cy, r * 0.68, this.palette.mid, alpha * 0.1);
    this.fillLightBand(cx, cy, r * 0.32, this.palette.core, alpha * 0.08);
    this.night?.addHole(cx, cy, r, alpha);
  }

  private fillLightBand(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    const cells = Math.max(1, Math.round(radius / 2));
    this.halo.fillStyle(color, alpha);
    for (let row = -cells; row < cells; row++) {
      const halfWidth =
        2 * Math.round(Math.sqrt(cells ** 2 - (row + 0.5) ** 2));
      this.halo.fillRect(x - halfWidth, y + 2 * row, 2 * halfWidth, 2);
    }
  }

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
    this.night?.render(this.camera);
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
    this.night?.destroy();
  }
}
