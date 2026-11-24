import type { RunState, Systems } from "@/core";
import { BEACON_SEAL_IDS, countBeaconSeals } from "@/systems/world/beacon";

/** One-line Chinese objective derived from run progress; always ends with the seal count. */
export function objectiveLine(state: RunState, sys: Systems): string {
  const seals = `炉印 ${countBeaconSeals(state)}/${BEACON_SEAL_IDS.length}`;
  if (countBeaconSeals(state) === BEACON_SEAL_IDS.length)
    return `目标：前往山脊东端，点燃烽台 · ${seals}`;
  const millGate = sys.data.regions.get("old_mill")?.entry.gateId;
  const gateOpen = millGate
    ? state.changesByObjectId[millGate]?.opened === true
    : false;
  if (state.campLevel < 2)
    return `目标：采集木材与石料，升级二级营火 · ${seals}`;
  if (!gateOpen) return `目标：前往东侧废磨坊，打开大门 · ${seals}`;
  if (state.seals.includes("old_mill_ember_seal"))
    return `目标：向东穿过密林，击败霜渊守炬者 · ${seals}`;
  if ((state.inventory.iron_spear ?? 0) < 1)
    return `目标：先在磨坊外围采矿熔炼，打造铁矛再挑战督工 · ${seals}`;
  return `目标：在废磨坊击败督工，取得炉印 · ${seals}`;
}
