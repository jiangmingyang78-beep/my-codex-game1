import type { RunState } from "@/core/types";

export const BEACON_SEAL_IDS = [
  "old_mill_ember_seal",
  "summit_ember_seal",
] as const;

export function countBeaconSeals(state: RunState): number {
  return BEACON_SEAL_IDS.filter((id) => state.seals.includes(id)).length;
}
