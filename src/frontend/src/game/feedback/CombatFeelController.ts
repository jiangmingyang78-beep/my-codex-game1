import type { EnemyDef } from "@/core/dataTypes";
import { EVT } from "@/core/events";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { safeUnit } from "@/systems/combat/combatMath";
import { nearestInteractable } from "@/systems/world/interact";
import type { ObjectKind } from "@/systems/world/worldTypes";
import Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { COMBAT_FEEL_PRESETS, type ShakeSpec } from "./combatFeelPresets";

export type FloatingKind = "normal" | "crit" | "heal" | "heroHurt" | "block";

export interface CombatFeelOptions {
  reducedMotion?: boolean;
  shakeEnabled?: boolean;
}

interface FloatingSlot {
  text: Phaser.GameObjects.Text;
  busy: boolean;
  ageMs: number;
  lifeMs: number;
  x: number;
  y: number;
  risePx: number;
}

const FLOAT_STYLE: Record<
  FloatingKind,
  { color: string; lifeMs: number; risePx: number }
> = {
  normal: { color: "#ffffff", lifeMs: 520, risePx: 18 },
  crit: { color: "#ffd43b", lifeMs: 680, risePx: 26 },
  heal: { color: "#69db7c", lifeMs: 640, risePx: 20 },
  heroHurt: { color: "#ff6b6b", lifeMs: 640, risePx: 22 },
  block: { color: "#a5d8ff", lifeMs: 560, risePx: 16 },
};

function isBossEnemy(def: EnemyDef, enemy: EnemyState): boolean {
  return (
    def.seedType === "warden_phase" ||
    def.attack.type === "alternating" ||
    enemy.wardenPhase !== undefined
  );
}

export class CombatFeelController {
  private readonly scene: Phaser.Scene;
  private readonly reducedMotion: boolean;
  private readonly shakeEnabled: boolean;

  private readonly pool: FloatingSlot[] = [];
  private interactG: Phaser.GameObjects.Graphics | null;
  private pointerG: Phaser.GameObjects.Graphics | null;

  private hitstopLeftMs = 0;
  private hitstopCdMs = 0;
  private lastHeroX = 0;
  private lastHeroY = 0;
  private heroTarget: Phaser.GameObjects.Sprite | null = null;
  private heroFlashLeftMs = 0;
  private heroFlashColor = 0xffd43b;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: CombatFeelOptions = {}) {
    this.scene = scene;
    this.reducedMotion = options.reducedMotion ?? false;
    this.shakeEnabled = options.shakeEnabled ?? true;

    const { qol } = COMBAT_FEEL_PRESETS;
    for (let i = 0; i < qol.damagePoolSize; i += 1) {
      const text = scene.add
        .text(0, 0, "", {
          fontFamily: qol.fontFamily,
          fontSize: qol.fontSize,
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          resolution: 1,
        })
        .setOrigin(0.5, 1)
        .setDepth(RENDER_DEPTH.floatingText)
        .setVisible(false)
        .setActive(false);
      this.pool.push({
        text,
        busy: false,
        ageMs: 0,
        lifeMs: 0,
        x: 0,
        y: 0,
        risePx: 0,
      });
    }

    this.interactG = scene.add.graphics().setDepth(qol.interactDepth);
    this.pointerG = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(qol.bossPointerDepth);

    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  setHeroTarget(target: Phaser.GameObjects.Sprite | null): void {
    this.heroTarget = target;
  }

  triggerHitstop(durationMs: number, force = false): void {
    if (this.reducedMotion || durationMs <= 0) return;
    if (!force && this.hitstopCdMs > 0) return;
    this.hitstopLeftMs = Math.max(this.hitstopLeftMs, durationMs);
    this.hitstopCdMs =
      durationMs + COMBAT_FEEL_PRESETS.hitstop.globalCooldownMs;
  }

  consumeStepDt(dtMs: number): number {
    return this.hitstopLeftMs > 0 ? 0 : dtMs;
  }

  private shake(spec: ShakeSpec): void {
    if (this.reducedMotion || !this.shakeEnabled) return;
    this.scene.cameras.main?.shake(spec.durationMs, spec.intensity, false);
  }

  processEvents(events: readonly GameEvent[]): void {
    if (this.destroyed) return;
    const { hitstop, shake } = COMBAT_FEEL_PRESETS;
    const hasRiposteStrike = events.some(
      (ev) => ev.type === EVT.COMBAT_RIPOSTE_STRIKE,
    );
    const hasBucklerRiposte = events.some(
      (ev) =>
        ev.type === EVT.COMBAT_RIPOSTE_ARMED &&
        ev.payload.trigger === "buckler_block",
    );

    for (const ev of events) {
      const px = ev.x ?? this.lastHeroX;
      const py = ev.y ?? this.lastHeroY;

      if (ev.type === EVT.hit && ev.payload.kind === "hurt") {
        this.shake(shake.heroHurt);
        this.triggerHitstop(hitstop.heroHurtMs);
        if (typeof ev.payload.amount === "number") {
          this.spawnFloatingNumber(
            px,
            py - 10,
            `-${Math.round(Math.abs(ev.payload.amount))}`,
            "heroHurt",
          );
        }
      } else if (ev.type === EVT.hit && ev.payload.kind !== "hurt") {
        if (!hasRiposteStrike) {
          this.shake(shake.heroStrike);
          this.triggerHitstop(hitstop.heroStrikeMs);
        }
        if (
          ev.x !== null &&
          ev.y !== null &&
          typeof ev.payload.damage === "number"
        ) {
          const isCrit = hasRiposteStrike || ev.payload.crit === true;
          this.spawnFloatingNumber(
            ev.x,
            ev.y - 8,
            String(Math.round(Math.abs(ev.payload.damage))),
            isCrit ? "crit" : "normal",
          );
        }
      } else if (ev.type === EVT.enemyDefeated) {
        this.shake(shake.kill);
        this.triggerHitstop(hitstop.killMs);
      } else if (ev.type === EVT.blocked) {
        if (!hasBucklerRiposte) {
          this.spawnFloatingNumber(px, py - 12, "格挡", "block");
        }
      } else if (
        ev.type === EVT.campLit &&
        ev.payload.kind === "barrel_blast"
      ) {
        this.shake(shake.blast);
      } else if (ev.type === EVT.COMBAT_RIPOSTE_ARMED) {
        this.triggerHitstop(45, true);
        this.heroFlashLeftMs = 110;
        this.heroFlashColor = 0xffd43b;
        const label =
          ev.payload.trigger === "buckler_block" ? "格挡!" : "闪避!";
        this.spawnFloatingNumber(px, py - 14, label, "crit");
      } else if (ev.type === EVT.COMBAT_RIPOSTE_STRIKE) {
        this.triggerHitstop(65, true);
        this.shake(shake.kill);
        const light = Math.round(Number(ev.payload.lightRestored) || 0);
        if (light > 0) {
          this.spawnFloatingNumber(px, py - 12, `+${light} 火`, "heal");
        }
      }
    }
  }

  spawnFloatingNumber(
    x: number,
    y: number,
    text: string,
    kind: FloatingKind,
  ): void {
    if (this.destroyed || this.pool.length === 0) return;
    let slot = this.pool.find((s) => !s.busy);
    if (!slot) {
      slot = this.pool.reduce((oldest, cur) =>
        cur.ageMs > oldest.ageMs ? cur : oldest,
      );
    }
    const spec = FLOAT_STYLE[kind];
    slot.busy = true;
    slot.ageMs = 0;
    slot.lifeMs = spec.lifeMs;
    slot.x = Math.round(x);
    slot.y = Math.round(y);
    slot.risePx = spec.risePx;

    slot.text
      .setText(text)
      .setColor(spec.color)
      .setAlpha(1)
      .setVisible(true)
      .setActive(true);
    // Place simultaneous nearby hits on separate lines so their digits do not merge.
    for (const other of this.pool) {
      if (other === slot || !other.busy || other.ageMs > 120) continue;
      const spacing = (slot.text.width + other.text.width) / 2 + 4;
      if (
        Math.abs(slot.x - other.x) < spacing &&
        Math.abs(slot.y - other.text.y) < slot.text.height + 4
      ) {
        slot.y = Math.floor(other.text.y) - other.text.height - 4;
      }
    }
    slot.text.setPosition(slot.x, slot.y);
    slot.text.texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  syncHudOverlays(state: RunState, sys: Systems, timeSec: number): void {
    if (this.destroyed) return;
    this.lastHeroX = state.hero.x;
    this.lastHeroY = state.hero.y;

    if (this.heroFlashLeftMs > 0 && this.heroTarget?.scene) {
      this.heroTarget.setTintFill(this.heroFlashColor);
    }

    const { qol } = COMBAT_FEEL_PRESETS;
    if (this.interactG) {
      this.interactG.clear();
      const target = nearestInteractable(state, sys);
      if (target) {
        const breath = 1 + Math.round((Math.sin(timeSec * 4) + 1) / 2);
        const half = Math.round(sys.data.tileSize / 2) + 3 + breath;
        const arm = 6;
        const cx = Math.round(target.x);
        const cy = Math.round(target.y);
        const color =
          qol.interactColors[target.kind as ObjectKind] ??
          qol.interactDefaultColor;
        const g = this.interactG;
        g.lineStyle(2, color, 1);
        g.lineBetween(cx - half, cy - half, cx - half + arm, cy - half);
        g.lineBetween(cx - half, cy - half, cx - half, cy - half + arm);
        g.lineBetween(cx + half - arm, cy - half, cx + half, cy - half);
        g.lineBetween(cx + half, cy - half, cx + half, cy - half + arm);
        g.lineBetween(cx - half, cy + half, cx - half + arm, cy + half);
        g.lineBetween(cx - half, cy + half - arm, cx - half, cy + half);
        g.lineBetween(cx + half - arm, cy + half, cx + half, cy + half);
        g.lineBetween(cx + half, cy + half - arm, cx + half, cy + half);
      }
    }

    if (this.pointerG) {
      this.pointerG.clear();
      const cam = this.scene.cameras.main;
      if (!cam) return;
      const view = cam.worldView;
      const z = Math.max(1e-4, cam.zoom);
      const margin = qol.bossPointerMarginPx;
      const centerX = cam.width / 2;
      const centerY = cam.height / 2;
      // A zero scroll factor still inherits camera zoom. Draw around the zoom origin at 1:1.
      this.pointerG.setPosition(centerX, centerY).setScale(1 / z);
      let hudRects: DOMRect[] | undefined;
      const placed: { x: number; y: number }[] = [];

      for (const enemy of Object.values(state.enemiesById)) {
        if (enemy.hp <= 0) continue;
        const def = getEnemy(sys.data, enemy.enemyId);
        if (!def || !isBossEnemy(def, enemy) || view.contains(enemy.x, enemy.y))
          continue;

        const dx = enemy.x - view.centerX;
        const dy = enemy.y - view.centerY;
        if (Math.hypot(dx, dy) < 1e-4) continue;

        const horizontalRoom = Math.max(0, centerX - margin);
        const verticalRoom = Math.max(0, centerY - margin);
        const sx = horizontalRoom / Math.max(Math.abs(dx), 1e-6);
        const sy =
          dy === 0 ? Number.POSITIVE_INFINITY : verticalRoom / Math.abs(dy);
        const s = Math.min(sx, sy);
        let screenX = centerX + dx * s;
        let screenY = centerY + dy * s;
        hudRects ??= Array.from(
          document.querySelectorAll(
            "[data-hud-top-left], [data-hud-clock], [data-hud-actions], [data-hud-hotbar]",
          ),
          (node) => node.getBoundingClientRect(),
        );
        for (const box of hudRects) {
          if (
            screenX < box.left - margin ||
            screenX > box.right + margin ||
            screenY < box.top - margin ||
            screenY > box.bottom + margin
          )
            continue;
          screenY = box.top >= centerY ? box.top - margin : box.bottom + margin;
        }
        // Slide crowded markers along their edge without changing their bearing.
        const step = 20;
        const alongY = sx <= sy;
        const edgeLength = alongY ? cam.height : cam.width;
        for (let offset = 0; offset <= edgeLength; offset += step) {
          const shift = offset % (step * 2) ? (offset + step) / 2 : -offset / 2;
          const x = screenX + (alongY ? 0 : shift);
          const y = screenY + (alongY ? shift : 0);
          if (
            x < margin ||
            x > cam.width - margin ||
            y < margin ||
            y > cam.height - margin ||
            hudRects.some(
              (box) =>
                x > box.left - margin &&
                x < box.right + margin &&
                y > box.top - margin &&
                y < box.bottom + margin,
            ) ||
            placed.some((point) => Math.hypot(point.x - x, point.y - y) < step)
          )
            continue;
          screenX = x;
          screenY = y;
          break;
        }
        placed.push({ x: screenX, y: screenY });
        const px = screenX - centerX;
        const py = screenY - centerY;
        const { x: ux, y: uy } = safeUnit(dx, dy);
        const nx = -uy;
        const ny = ux;

        const ax = Math.round(px + ux * 8);
        const ay = Math.round(py + uy * 8);
        const bx = Math.round(px - ux * 6 + nx * 6);
        const by = Math.round(py - uy * 6 + ny * 6);
        const cx = Math.round(px - ux * 6 - nx * 6);
        const cy = Math.round(py - uy * 6 - ny * 6);
        this.pointerG
          .lineStyle(2, 0x48172a)
          .fillStyle(qol.bossPointerColor, 1)
          .fillTriangle(ax, ay, bx, by, cx, cy)
          .strokeTriangle(ax, ay, bx, by, cx, cy);
      }
    }
  }

  private onUpdate(_time: number, delta: number): void {
    if (this.destroyed) return;
    const dt = Math.max(0, delta);
    this.hitstopLeftMs = Math.max(0, this.hitstopLeftMs - dt);
    this.hitstopCdMs = Math.max(0, this.hitstopCdMs - dt);
    this.heroFlashLeftMs = Math.max(0, this.heroFlashLeftMs - dt);

    for (const slot of this.pool) {
      if (!slot.busy) continue;
      slot.ageMs += dt;
      const t = Math.min(1, slot.ageMs / Math.max(1, slot.lifeMs));
      const eased = 1 - (1 - t) * (1 - t);
      slot.text.setPosition(slot.x, Math.round(slot.y - slot.risePx * eased));
      if (t > 0.6) {
        slot.text.setAlpha(Math.max(0, (1 - t) / 0.4));
      }
      if (t >= 1) {
        slot.busy = false;
        slot.text.setVisible(false).setActive(false);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);

    for (const slot of this.pool) {
      slot.text.destroy();
    }
    this.pool.length = 0;

    this.interactG?.destroy();
    this.interactG = null;
    this.pointerG?.destroy();
    this.pointerG = null;
    this.heroTarget = null;
  }
}
