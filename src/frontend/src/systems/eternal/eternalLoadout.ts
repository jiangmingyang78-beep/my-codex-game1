import type { ItemDef } from "@/core/dataTypes";
import type { RunState, Systems } from "@/core/types";
import { addItem } from "../inventory";
import { heroMaxHp } from "../itemEffects";
import { getEternalRuntime } from "./eternalRuntime";
import {
  ETERNAL,
  type EternalOption,
  type EternalQuota,
  type LoadoutMode,
} from "./eternalTypes";

export interface LoadoutResult {
  ok: boolean;
  message?: string;
}

const isWeapon = (id: string): boolean =>
  (ETERNAL.weaponIds as readonly string[]).includes(id);

export function equipmentItems(sys: Systems): readonly ItemDef[] {
  return sys.data.itemList.filter((item) => item.type === "equipment");
}

function owned(state: RunState, id: string): boolean {
  return (state.inventory[id] ?? 0) > 0;
}

function ownedIds(state: RunState, sys: Systems, weapon: boolean): string[] {
  return equipmentItems(sys)
    .filter((item) => isWeapon(item.id) === weapon && owned(state, item.id))
    .map((item) => item.id);
}

export function loadoutQuotas(
  state: RunState,
  sys: Systems,
): { weapon: EternalQuota; gear: EternalQuota } {
  return {
    weapon: {
      used: ownedIds(state, sys, true).length,
      max: ETERNAL.quotaWeapon,
    },
    gear: {
      used: ownedIds(state, sys, false).length,
      max: ETERNAL.quotaGear,
    },
  };
}

export function loadoutOptions(state: RunState, sys: Systems): EternalOption[] {
  return equipmentItems(sys).map(({ id, name, description }) => ({
    id,
    name,
    description,
    kind: isWeapon(id) ? "weapon" : "gear",
    selected: owned(state, id),
  }));
}

/** Applies an inventory change and keeps HP in step: full in prep, gained max HP in combat. */
function withHpSync(state: RunState, sys: Systems, change: () => void): void {
  const before = heroMaxHp(sys.data, state.inventory, state.heroId);
  change();
  const after = heroMaxHp(sys.data, state.inventory, state.heroId);
  const { hero } = state;
  if (getEternalRuntime(state)?.phase === "prep") hero.hp = after;
  else hero.hp = Math.min(after, hero.hp + Math.max(0, after - before));
}

function setOwned(state: RunState, id: string, on: boolean): void {
  if (on) state.inventory[id] = 1;
  else delete state.inventory[id];
}

/** Standard mode keeps at most 1 weapon and 2 pieces of gear (earlier items win). */
function trimToQuota(state: RunState, sys: Systems): void {
  const drop = [
    ...ownedIds(state, sys, true).slice(ETERNAL.quotaWeapon),
    ...ownedIds(state, sys, false).slice(ETERNAL.quotaGear),
  ];
  for (const id of drop) setOwned(state, id, false);
}

export function toggleEquipment(
  state: RunState,
  sys: Systems,
  id: string,
): LoadoutResult {
  const rt = getEternalRuntime(state);
  const item = sys.data.items.get(id);
  if (!rt || item?.type !== "equipment")
    return { ok: false, message: "Could not select the equipment" };
  const has = owned(state, id);
  if (rt.phase === "combat") {
    if (has)
      return {
        ok: false,
        message:
          "The fighting was unable to unload the items that were already equipped",
      };
    if (rt.pendingPicks <= 0)
      return { ok: false, message: "No by-elections available" };
    withHpSync(state, sys, () => setOwned(state, id, true));
    rt.pendingPicks--;
    return { ok: true, message: `By-election: ${item.name}` };
  }
  if (has || rt.loadoutMode === "free") {
    withHpSync(state, sys, () => setOwned(state, id, !has));
    return { ok: true };
  }
  const weapon = isWeapon(id);
  const quotas = loadoutQuotas(state, sys);
  if (!weapon && quotas.gear.used >= quotas.gear.max)
    return {
      ok: false,
      message:
        "The quota for defensive devices/lighting has been filled, please remove one",
    };
  withHpSync(state, sys, () => {
    if (weapon)
      for (const other of ownedIds(state, sys, true))
        setOwned(state, other, false);
    setOwned(state, id, true);
  });
  return { ok: true };
}

export function setLoadoutMode(
  state: RunState,
  sys: Systems,
  mode: LoadoutMode,
): LoadoutResult {
  const rt = getEternalRuntime(state);
  if (!rt || rt.phase !== "prep")
    return {
      ok: false,
      message: "The assembly mode can only be changed at the preparatory stage",
    };
  rt.loadoutMode = mode;
  if (mode === "standard")
    withHpSync(state, sys, () => trimToQuota(state, sys));
  return { ok: true };
}

/** Free mode only: select every piece of equipment, or clear the whole loadout. */
export function setAllEquipment(
  state: RunState,
  sys: Systems,
  on: boolean,
): LoadoutResult {
  const rt = getEternalRuntime(state);
  if (!rt || rt.phase !== "prep" || rt.loadoutMode !== "free")
    return {
      ok: false,
      message: "Only the preparatory stage of free assembly is available",
    };
  withHpSync(state, sys, () => {
    for (const item of equipmentItems(sys)) setOwned(state, item.id, on);
  });
  return { ok: true };
}

/** ♪ The ♪ ♪ The ♪ The ♪ ♪ The ♪ The ♪ ♪ The ♪ ♪ The ♪ The ♪ The ♪ ♪ The ♪ The ♪ The ♪ ♪ The ♪ The ♪ The ♪ ♪ The ♪ The ♪ The */
export function grantStartingSupplies(state: RunState, sys: Systems): void {
  for (const [id, count] of Object.entries(ETERNAL.startingSupplies)) {
    const missing = count - (state.inventory[id] ?? 0);
    if (missing > 0) addItem(sys.data, state.inventory, id, missing);
  }
}

/** Entering combat enforces the standard quota, in case the mode was switched late. */
export function lockLoadoutForCombat(state: RunState, sys: Systems): void {
  const rt = getEternalRuntime(state);
  if (rt?.loadoutMode === "standard")
    withHpSync(state, sys, () => trimToQuota(state, sys));
}
