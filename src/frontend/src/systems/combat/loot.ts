import type { DropDef } from "@/core/dataTypes";
import { EVT, makeEvent } from "@/core/events";
import { rollRun } from "@/core/rng";
import type { EnemyState, GameEvent, RunState, Systems } from "@/core/types";
import { addItem, canAdd } from "../inventory";
import { countBeaconSeals } from "../world/beacon";

const PICKUP_RADIUS_PX = 20;

function spawnLoot(
  state: RunState,
  itemId: string,
  count: number,
  x: number,
  y: number,
  pickupId: string | null,
): void {
  const id = pickupId ?? `loot_${state.idCounter++}`;
  state.groundLoot[id] = {
    id,
    itemId,
    count,
    x,
    y,
    pickupId,
    refusedNotified: false,
  };
}

function fixedDropIssued(state: RunState, pickupId: string): boolean {
  return (
    Object.hasOwn(state.groundLoot, pickupId) ||
    state.collectedPickups.includes(pickupId)
  );
}

/** Each entry rolls independently; fixed drops keep the same ID until collected. */
export function rollDrops(
  state: RunState,
  drops: readonly DropDef[],
  x: number,
  y: number,
): void {
  for (const drop of drops) {
    if (drop.pickupId && fixedDropIssued(state, drop.pickupId)) continue;
    if (
      drop.probability < 1 &&
      !(drop.probability > 0 && rollRun(state) < drop.probability)
    )
      continue;
    spawnLoot(state, drop.itemId, drop.count, x, y, drop.pickupId ?? null);
  }
}

function checkEncounter(
  state: RunState,
  sys: Systems,
  regionId: string,
  x: number,
  y: number,
  events: GameEvent[],
): void {
  const region = sys.data.regions.get(regionId);
  const reward = region?.encounterId
    ? sys.data.encounters.get(region.encounterId)
    : undefined;
  if (!region || !reward) return;
  const cleared = reward.members.every((m) => {
    const defeated = region.residentSpawns.filter(
      (s) =>
        s.enemyId === m.enemyId && state.changesByObjectId[s.spawnId]?.defeated,
    );
    return defeated.length >= m.count;
  });
  if (!cleared) return;
  const fresh = reward.drops.some(
    (d) => !d.pickupId || !fixedDropIssued(state, d.pickupId),
  );
  rollDrops(state, reward.drops, x, y);
  if (fresh)
    events.push(
      makeEvent("encounter.cleared", x, y, {
        encounterId: reward.encounterId,
        regionId,
      }),
    );
}

/** Removes a defeated enemy, records resident defeats by spawn id, drops loot and checks rewards. */
export function defeatEnemy(
  state: RunState,
  sys: Systems,
  enemy: EnemyState,
  events: GameEvent[],
): void {
  delete state.enemiesById[enemy.id];
  const def = sys.data.enemies.get(enemy.enemyId);
  if (enemy.nightRound === null) {
    state.changesByObjectId[enemy.spawnId] = { defeated: true };
  }
  events.push(
    makeEvent(EVT.enemyDefeated, enemy.x, enemy.y, {
      enemyId: enemy.enemyId,
      id: enemy.id,
    }),
  );
  if (def) rollDrops(state, def.drops, enemy.x, enemy.y);
  if (enemy.nightRound === null) {
    const region = sys.data.regionList.find((r) =>
      r.residentSpawns.some((s) => s.spawnId === enemy.spawnId),
    );
    if (region) checkEncounter(state, sys, region.id, enemy.x, enemy.y, events);
  }
}

/**
 * Walk-over pickup of ground loot. A full stack leaves the loot on the ground (notified once)
 * until the player makes room. Fixed pickups update collectedPickups and, for seals, seals.
 */
export function collectGroundLoot(
  state: RunState,
  sys: Systems,
  events: GameEvent[],
): void {
  const { hero } = state;
  for (const id in state.groundLoot) {
    const loot = state.groundLoot[id];
    if (Math.hypot(loot.x - hero.x, loot.y - hero.y) > PICKUP_RADIUS_PX) {
      loot.refusedNotified = false;
      continue;
    }
    if (!canAdd(sys.data, state.inventory, loot.itemId, loot.count)) {
      if (!loot.refusedNotified) {
        loot.refusedNotified = true;
        events.push(
          makeEvent(EVT.pickupRefused, loot.x, loot.y, {
            itemId: loot.itemId,
            reason: "inventory_full",
          }),
        );
      }
      continue;
    }
    addItem(sys.data, state.inventory, loot.itemId, loot.count);
    delete state.groundLoot[id];
    events.push(
      makeEvent(EVT.itemPicked, loot.x, loot.y, {
        itemId: loot.itemId,
        count: loot.count,
        pickupId: loot.pickupId,
      }),
    );
    if (loot.pickupId) {
      state.collectedPickups.push(loot.pickupId);
      if (
        loot.itemId === "ember_seal" &&
        !state.seals.includes(loot.pickupId)
      ) {
        state.seals.push(loot.pickupId);
        events.push(
          makeEvent(EVT.sealCollected, loot.x, loot.y, {
            pickupId: loot.pickupId,
            count: countBeaconSeals(state),
          }),
        );
      }
    }
  }
}
