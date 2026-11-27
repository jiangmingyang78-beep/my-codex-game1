import type { GameEvent } from "./types";

export function makeEvent(
  type: string,
  x: number | null = null,
  y: number | null = null,
  payload: Record<string, unknown> = {},
): GameEvent {
  return { type, x, y, payload };
}

/** Stable event type names consumed by the scene, HUD, audio and VFX. */
export const EVT = {
  hit: "combat.hit",
  blocked: "combat.blocked",
  enemyAoeDetonated: "enemy.aoe_detonated",
  enemyPhaseChanged: "enemy.phase_changed",
  swing: "combat.swing",
  windup: "combat.windup",
  enemyDefeated: "enemy.defeated",
  enemySpawned: "enemy.spawned",
  collected: "resource.collected",
  itemPicked: "item.picked",
  pickupRefused: "pickup.refused",
  itemUsed: "item.used",
  useRefused: "item.use_refused",
  craftDone: "craft.done",
  craftRefused: "craft.refused",
  campUpgraded: "camp.upgraded",
  campLit: "camp.lit",
  campEmber: "camp.ember",
  openCraft: "ui.open_craft",
  gateOpened: "gate.opened",
  gateRefused: "gate.refused",
  interactRefused: "interact.refused",
  dusk: "phase.dusk",
  dawn: "phase.dawn",
  regionEntered: "region.entered",
  sealCollected: "seal.collected",
  saveDue: "save.due",
  runEnded: "run.ended",
  COMBAT_RIPOSTE_ARMED: "combat.riposte_armed",
  COMBAT_RIPOSTE_STRIKE: "combat.riposte_strike",
  notice: "ui.notice",
} as const;
