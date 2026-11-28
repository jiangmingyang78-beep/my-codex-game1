import type { RunState, Systems } from "@/core";
import { BEACON_SEAL_IDS, countBeaconSeals } from "@/systems/world/beacon";

/** Current objective derived from run progress, including the seal count. */
export function objectiveLine(state: RunState, sys: Systems): string {
  const seals = `Ember Seal ${countBeaconSeals(state)}/${BEACON_SEAL_IDS.length}`;
  if (countBeaconSeals(state) === BEACON_SEAL_IDS.length)
    return `Objective: Reach the east end of the ridge and light the beacon  ·  ${seals}`;
  const millGate = sys.data.regions.get("old_mill")?.entry.gateId;
  const gateOpen = millGate
    ? state.changesByObjectId[millGate]?.opened === true
    : false;
  if (state.campLevel < 2)
    return `Objective: Gather wood and stone and upgrade the campfire to Level 2  ·  ${seals}`;
  if (!gateOpen)
    return `Objective: Head east to the Old Mill and open its gate  ·  ${seals}`;
  if (state.seals.includes("old_mill_ember_seal"))
    return `Objective: Head east through the woods and defeat the Summit Pyre Warden  ·  ${seals}`;
  if ((state.inventory.iron_spear ?? 0) < 1)
    return `Objective: Mine and smelt iron outside the mill, then forge an Iron Spear before facing the Overseer  ·  ${seals}`;
  return `Objective: Defeat the Old Mill Overseer and recover the Ember Seal  ·  ${seals}`;
}
