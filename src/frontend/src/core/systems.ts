import { getWorld } from "@/systems/world/worldGen";
import { loadGameData } from "./gameData";
import type { Systems } from "./types";

/** Builds the immutable rule context: JSON data plus the generated world. */
export function createSystems(data = loadGameData()): Systems {
  return { data, world: getWorld(data) };
}

let cached: Systems | null = null;
/** Shared memoized rule context. */
export function getSystems(): Systems {
  if (!cached) cached = createSystems();
  return cached;
}
