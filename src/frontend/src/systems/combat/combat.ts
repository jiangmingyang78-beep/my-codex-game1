import type {
  GameEvent,
  RunState,
  StepInputState,
  Systems,
} from "@/core/types";
import { updateEnemies } from "../EnemyManager.js";
import { heroAttack } from "./heroAttack";
import { collectGroundLoot } from "./loot";

/**
 * One combat step: hero attack, enemy telegraph/attack state machines, projectiles and
 * walk-over loot pickup. Order matters: the hero strikes before enemies act.
 */
export function stepCombat(
  state: RunState,
  sys: Systems,
  input: Pick<StepInputState, "attackPressed">,
  sec: number,
  events: GameEvent[],
): void {
  if (input.attackPressed) heroAttack(state, sys, events);
  updateEnemies(state, sys, sec, events);
  collectGroundLoot(state, sys, events);
}
