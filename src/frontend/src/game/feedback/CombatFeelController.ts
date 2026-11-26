import type { EnemyDef } from "@/core/dataTypes";
import { getEnemy } from "@/core/gameData";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { nearestInteractable } from "@/systems/world/interact";
import type { ObjectKind } from "@/systems/world/worldTypes";
import Phaser from "phaser";
import { RENDER_DEPTH } from "../renderDepth";
import { COMBAT_FEEL_PRESETS, type ShakeSpec } from "./combatFeelPresets";

export interface CombatEventTypeMap {
  enemyHit: string;
  enemyDefeated: string;
  heroDamaged: string;
  heroBlocked: string;
  heroHealed: string;
  barrelExploded: string;
}

/** 默认事件映射，对应 core/events.ts 中的 EVT 常量。 */
export const DEFAULT_COMBAT_EVENT_TYPES: CombatEventTypeMap = {
  enemyHit: "combat.hit",
  enemyDefeated: "enemy.defeated",
  heroDamaged: "combat.hit",
  heroBlocked: "combat.blocked",
  heroHealed: "item.used",
  barrelExploded: "camp.lit",
};

export type FloatingKind = "normal" | "crit" | "heal" | "heroHurt" | "block";
export type BossPredicate = (def: EnemyDef, enemy: EnemyState) => boolean;

export interface CombatFeelOptions {
  reducedMotion?: boolean;
  shakeEnabled?: boolean;
  eventTypes?: Partial<CombatEventTypeMap>;
  isBossPredicate?: BossPredicate;
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

type Tintable = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Tint;

interface TintSnapshot {
  obj: Tintable;
  fill: boolean;
  tl: number;
  tr: number;
  bl: number;
  br: number;
}

interface FlashEntry {
  leftMs: number;
  snapshots: TintSnapshot[];
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

function isTintable(obj: Phaser.GameObjects.GameObject): obj is Tintable {
  const candidate = obj as unknown as {
    setTintFill?: unknown;
    clearTint?: unknown;
  };
  return (
    typeof candidate.setTintFill === "function" &&
    typeof candidate.clearTint === "function"
  );
}

function collectTintables(
  obj: Phaser.GameObjects.GameObject,
  out: Tintable[],
): void {
  if (obj instanceof Phaser.GameObjects.Container) {
    for (const child of obj.list) {
      collectTintables(child, out);
    }
    return;
  }
  if (isTintable(obj)) {
    out.push(obj);
  }
}

function readAmount(payload: Record<string, unknown>): number | null {
  for (const key of ["damage", "amount", "value", "heal"]) {
    const v = payload[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.round(Math.abs(v));
    }
  }
  return null;
}

function defaultIsBoss(def: EnemyDef, enemy: EnemyState): boolean {
  const meta = def as unknown as {
    seedType?: unknown;
    attack?: { type?: unknown };
  };
  return (
    meta.seedType === "warden_phase" ||
    meta.attack?.type === "alternating" ||
    enemy.wardenPhase !== undefined
  );
}

function resolveTarget(
  raw: unknown,
  tileSize: number,
): { x: number; y: number; size: number; kind: string } | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const inner =
    (rec.object as Record<string, unknown> | undefined) ??
    (rec.obj as Record<string, unknown> | undefined) ??
    (rec.target as Record<string, unknown> | undefined) ??
    rec;

  const num = (k: string): number | undefined => {
    const v = inner[k];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  let x = num("x");
  let y = num("y");
  if (x === undefined || y === undefined) {
    const tx = num("tx") ?? num("tileX");
    const ty = num("ty") ?? num("tileY");
    if (tx === undefined || ty === undefined) {
      return null;
    }
    x = (tx + 0.5) * tileSize;
    y = (ty + 0.5) * tileSize;
  }

  const radius = num("radius");
  const rawSize =
    num("w") ?? num("width") ?? (radius !== undefined ? radius * 2 : tileSize);
  const safeTile = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 32;
  const size = rawSize > 0 ? rawSize : safeTile;
  const kind = typeof inner.kind === "string" ? inner.kind : "";
  return { x, y, size, kind };
}

export class CombatFeelController {
  private readonly scene: Phaser.Scene;
  private reducedMotion: boolean;
  private shakeEnabled: boolean;
  private eventTypes: CombatEventTypeMap;
  private bossPredicate?: BossPredicate;

  private readonly pool: FloatingSlot[] = [];
  private interactG: Phaser.GameObjects.Graphics | null;
  private pointerG: Phaser.GameObjects.Graphics | null;
  private readonly flashes = new Map<
    Phaser.GameObjects.GameObject,
    FlashEntry
  >();

  private hitstopLeftMs = 0;
  private hitstopCdMs = 0;
  private lastHeroX = 0;
  private lastHeroY = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: CombatFeelOptions = {}) {
    this.scene = scene;
    this.reducedMotion = options.reducedMotion ?? false;
    this.shakeEnabled = options.shakeEnabled ?? true;
    this.eventTypes = { ...DEFAULT_COMBAT_EVENT_TYPES, ...options.eventTypes };
    this.bossPredicate = options.isBossPredicate;

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

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    if (v) {
      this.hitstopLeftMs = 0;
    }
  }

  setShakeEnabled(v: boolean): void {
    this.shakeEnabled = v;
  }

  setEventTypes(partial: Partial<CombatEventTypeMap>): void {
    this.eventTypes = { ...this.eventTypes, ...partial };
  }

  setBossPredicate(pred?: BossPredicate): void {
    this.bossPredicate = pred;
  }

  triggerHitstop(durationMs: number): void {
    if (this.reducedMotion || durationMs <= 0 || this.hitstopCdMs > 0) {
      return;
    }
    this.hitstopLeftMs = Math.max(this.hitstopLeftMs, durationMs);
    this.hitstopCdMs =
      durationMs + COMBAT_FEEL_PRESETS.hitstop.globalCooldownMs;
  }

  consumeStepDt(dtMs: number): number {
    return this.hitstopLeftMs > 0 ? 0 : dtMs;
  }

  isHitstopActive(): boolean {
    return this.hitstopLeftMs > 0;
  }

  private shake(spec: ShakeSpec): void {
    if (this.reducedMotion || !this.shakeEnabled || this.destroyed) {
      return;
    }
    this.scene.cameras.main?.shake(spec.durationMs, spec.intensity, false);
  }

  processEvents(events: readonly GameEvent[]): void {
    if (this.destroyed) {
      return;
    }
    const { hitstop, shake } = COMBAT_FEEL_PRESETS;
    const et = this.eventTypes;

    for (const ev of events) {
      const ex = ev.x;
      const ey = ev.y;
      const amount = readAmount(ev.payload);

      if (ev.type === et.heroDamaged && ev.payload.kind === "hurt") {
        this.shake(shake.heroHurt);
        this.triggerHitstop(hitstop.heroHurtMs);
        const px = ex ?? this.lastHeroX;
        const py = ey ?? this.lastHeroY;
        if (amount !== null) {
          this.spawnFloatingNumber(px, py - 10, `-${amount}`, "heroHurt");
        }
      } else if (ev.type === et.enemyHit && ev.payload.kind !== "hurt") {
        this.shake(shake.heroStrike);
        this.triggerHitstop(hitstop.heroStrikeMs);
        if (ex !== null && ey !== null && amount !== null) {
          const isCrit = ev.payload.crit === true || ev.payload.isCrit === true;
          this.spawnFloatingNumber(
            ex,
            ey - 8,
            String(amount),
            isCrit ? "crit" : "normal",
          );
        }
      } else if (ev.type === et.enemyDefeated) {
        this.shake(shake.kill);
        this.triggerHitstop(hitstop.killMs);
      } else if (ev.type === et.heroBlocked) {
        const px = ex ?? this.lastHeroX;
        const py = ey ?? this.lastHeroY;
        this.spawnFloatingNumber(px, py - 12, "格挡", "block");
      } else if (ev.type === et.heroHealed) {
        const px = ex ?? this.lastHeroX;
        const py = ey ?? this.lastHeroY;
        if (amount !== null) {
          this.spawnFloatingNumber(px, py - 10, `+${amount}`, "heal");
        }
      } else if (
        ev.type === et.barrelExploded &&
        (et.barrelExploded !== "camp.lit" || ev.payload.kind === "barrel_blast")
      ) {
        this.shake(shake.blast);
      }
    }
  }

  spawnFloatingNumber(
    x: number,
    y: number,
    text: string,
    kind: FloatingKind,
  ): void {
    if (this.destroyed || this.pool.length === 0) {
      return;
    }
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
      .setPosition(slot.x, slot.y)
      .setAlpha(1)
      .setVisible(true)
      .setActive(true);
    slot.text.texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  syncHudOverlays(state: RunState, sys: Systems, timeSec: number): void {
    if (this.destroyed) {
      return;
    }
    this.lastHeroX = state.hero.x;
    this.lastHeroY = state.hero.y;

    const { qol } = COMBAT_FEEL_PRESETS;
    if (this.interactG) {
      this.interactG.clear();
      const target = resolveTarget(
        nearestInteractable(state, sys) as unknown,
        sys.data.tileSize,
      );
      if (target) {
        const safeTime = Number.isFinite(timeSec) ? timeSec : 0;
        const breath = 1 + Math.round((Math.sin(safeTime * 4) + 1) / 2);
        const half = Math.round(target.size / 2) + 3 + breath;
        const arm = 6;
        const cx = Math.round(target.x);
        const cy = Math.round(target.y);
        const color =
          qol.interactColors[target.kind as ObjectKind] ??
          qol.interactDefaultColor;
        const g = this.interactG;
        g.lineStyle(2, color, 1);
        // 左上 / 右上 / 左下 / 右下 四角括号
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
      if (!cam) {
        return;
      }
      const view = cam.worldView;
      const z = Math.max(1e-4, cam.zoom);
      const margin = qol.bossPointerMarginPx;
      const hw = Math.max(8, (cam.width / 2 - margin) / z);
      const hh = Math.max(8, (cam.height / 2 - margin) / z);

      for (const enemy of Object.values(state.enemiesById)) {
        if (enemy.hp <= 0) {
          continue;
        }
        const def = getEnemy(sys.data, enemy.enemyId);
        if (!def) {
          continue;
        }
        const isBoss = this.bossPredicate
          ? this.bossPredicate(def, enemy)
          : defaultIsBoss(def, enemy);
        if (!isBoss || view.contains(enemy.x, enemy.y)) {
          continue;
        }

        const dx = enemy.x - view.centerX;
        const dy = enemy.y - view.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1e-4) {
          continue;
        }
        const s = Math.min(
          hw / Math.max(Math.abs(dx), 1e-6),
          hh / Math.max(Math.abs(dy), 1e-6),
        );
        const px = cam.width / 2 + dx * s * z;
        const py = cam.height / 2 + dy * s * z;
        const ux = dx / dist;
        const uy = dy / dist;
        const nx = -uy;
        const ny = ux;

        this.pointerG.fillStyle(qol.bossPointerColor, 1);
        this.pointerG.fillTriangle(
          Math.round(px + ux * 8),
          Math.round(py + uy * 8),
          Math.round(px - ux * 6 + nx * 6),
          Math.round(py - uy * 6 + ny * 6),
          Math.round(px - ux * 6 - nx * 6),
          Math.round(py - uy * 6 - ny * 6),
        );
      }
    }
  }

  flashObject(
    obj: Phaser.GameObjects.GameObject,
    durationMs = 80,
    color = 0xffffff,
  ): void {
    if (this.destroyed || durationMs <= 0) {
      return;
    }
    const existing = this.flashes.get(obj);
    if (existing) {
      existing.leftMs = durationMs;
      return;
    }
    const targets: Tintable[] = [];
    collectTintables(obj, targets);
    if (targets.length === 0) {
      return;
    }
    const snapshots: TintSnapshot[] = targets.map((t) => ({
      obj: t,
      fill: t.tintFill,
      tl: t.tintTopLeft,
      tr: t.tintTopRight,
      bl: t.tintBottomLeft,
      br: t.tintBottomRight,
    }));
    for (const t of targets) {
      t.setTintFill(color);
    }
    this.flashes.set(obj, { leftMs: durationMs, snapshots });
  }

  private restoreSnapshots(snapshots: TintSnapshot[]): void {
    for (const s of snapshots) {
      if (!s.obj.scene) {
        continue;
      }
      if (s.fill) {
        s.obj.setTintFill(s.tl, s.tr, s.bl, s.br);
      } else if (
        s.tl === 0xffffff &&
        s.tr === 0xffffff &&
        s.bl === 0xffffff &&
        s.br === 0xffffff
      ) {
        s.obj.clearTint();
      } else {
        s.obj.setTint(s.tl, s.tr, s.bl, s.br);
      }
    }
  }

  private onUpdate(_time: number, delta: number): void {
    if (this.destroyed) {
      return;
    }
    const dt = Math.max(0, delta);
    this.hitstopLeftMs = Math.max(0, this.hitstopLeftMs - dt);
    this.hitstopCdMs = Math.max(0, this.hitstopCdMs - dt);

    for (const slot of this.pool) {
      if (!slot.busy) {
        continue;
      }
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

    for (const [obj, entry] of this.flashes.entries()) {
      entry.leftMs -= dt;
      if (entry.leftMs <= 0) {
        this.restoreSnapshots(entry.snapshots);
        this.flashes.delete(obj);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);

    for (const entry of this.flashes.values()) {
      this.restoreSnapshots(entry.snapshots);
    }
    this.flashes.clear();

    for (const slot of this.pool) {
      slot.text.destroy();
    }
    this.pool.length = 0;

    this.interactG?.destroy();
    this.interactG = null;
    this.pointerG?.destroy();
    this.pointerG = null;
  }
}
