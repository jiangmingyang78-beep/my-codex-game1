import type { AttackMove } from "@/core/dataTypes";
import type { EnemyState, HeroState } from "@/core/types";

interface AttackContext {
  move: AttackMove;
  tileSize: number;
  contactRadiusPx: number;
  moveBy(dx: number, dy: number): void;
  strikeHero(): void;
}

interface AttackSeed {
  update(
    enemy: EnemyState,
    dt: number,
    player: Pick<HeroState, "x" | "y">,
    context: AttackContext,
  ): void;
}

/** The rule engine owns windup and recovery; the seed executes the active dash. */
const lunge: AttackSeed = {
  update(enemy, dt, player, context) {
    const { move, tileSize, contactRadiusPx } = context;
    const travelSec = move.travelSec ?? 0.2;
    const speed = ((move.distanceTiles ?? 2) * tileSize) / travelSec;
    context.moveBy(enemy.dirX * speed * dt, enemy.dirY * speed * dt);
    if (
      !enemy.hitDone &&
      Math.hypot(player.x - enemy.x, player.y - enemy.y) <= contactRadiusPx
    )
      context.strikeHero();
  },
};

/** Selects attack execution by the existing enemies.json attack.type field. */
export const attackSeeds: Readonly<
  Partial<Record<AttackMove["type"], AttackSeed>>
> = {
  lunge,
  charge: lunge,
};
