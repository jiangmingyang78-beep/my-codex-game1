import type { EnemyDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { angleBetweenDeg } from "@/systems/combat/combatMath";
import type Phaser from "phaser";

interface AdventureSpecialContext {
  state: RunState;
  sys: Systems;
  enemy: EnemyState;
  config: EnemyDef;
}

export interface AdventureSpecialBehavior {
  isUnlocked?(context: AdventureSpecialContext): boolean;
  /** Return replacement damage (0 blocks) or leave damage unchanged. */
  onBeforeHit?(
    context: AdventureSpecialContext,
    damage: number,
    events: GameEvent[],
  ): number | undefined;
  /** Return true to replace the default AI for this update. */
  onUpdate?(
    context: AdventureSpecialContext,
    dt: number,
    events: GameEvent[],
    move: (enemy: EnemyState, dx: number, dy: number) => void,
  ): boolean | undefined;
  onKilled?(context: AdventureSpecialContext, events: GameEvent[]): void;
  renderOverlay?(
    graphics: Phaser.GameObjects.Graphics,
    enemy: EnemyState,
    tileSize: number,
  ): void;
}

const behaviors = new Map<string, AdventureSpecialBehavior>();

export function registerAdventureSpecial(
  id: string,
  behavior: AdventureSpecialBehavior,
): void {
  if (!id || behaviors.has(id))
    throw new Error(`Invalid or duplicate enemy special: ${id}`);
  behaviors.set(id, behavior);
}

export function getAdventureSpecial(
  enemyId: string,
  specialKey?: string,
): AdventureSpecialBehavior | undefined {
  return behaviors.get(specialKey ?? enemyId);
}

export function listAdventureSpecialIds(): string[] {
  return [...behaviors.keys()];
}

export function getActiveAdventureSpecial(
  context: AdventureSpecialContext,
): AdventureSpecialBehavior | undefined {
  const special = getAdventureSpecial(
    context.enemy.enemyId,
    context.config.specialKey,
  );
  return special?.isUnlocked?.(context) === false ? undefined : special;
}

const SHIELD_HALF_ANGLE_DEG = 60;

function shieldRaised(enemy: EnemyState): boolean {
  return enemy.phase === "idle" || enemy.phase === "chase";
}

registerAdventureSpecial("front_shield", {
  onBeforeHit({ enemy, state }, _damage, events) {
    if (!shieldRaised(enemy)) return;
    const dx = state.hero.x - enemy.x;
    const dy = state.hero.y - enemy.y;
    if (angleBetweenDeg(enemy.dirX, enemy.dirY, dx, dy) > SHIELD_HALF_ANGLE_DEG)
      return;
    events.push(
      makeEvent(EVT.blocked, enemy.x, enemy.y, {
        enemyId: enemy.enemyId,
        targetId: enemy.id,
        dx: enemy.dirX,
        dy: enemy.dirY,
      }),
    );
    return 0;
  },
  renderOverlay(graphics, enemy, tileSize) {
    if (!shieldRaised(enemy)) return;
    const facing = Math.atan2(enemy.dirY, enemy.dirX);
    const halfAngle = (SHIELD_HALF_ANGLE_DEG * Math.PI) / 180;
    graphics.lineStyle(2, 0xa6d6ee, 0.9).beginPath();
    graphics.arc(
      enemy.x,
      enemy.y - 3,
      tileSize * 0.78,
      facing - halfAngle,
      facing + halfAngle,
    );
    graphics.strokePath();
  },
});
