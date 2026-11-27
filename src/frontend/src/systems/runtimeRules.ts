import encounterConfig from "@/data/encounters.json";
const { setPieces: _setPieces, ...config } = encounterConfig;
export const rules: {
  dash?: { distanceTiles?: number; cooldownSec?: number };
  perception?: { aggroTiles?: number; leashTiles?: number };
  weights?: Record<string, number>;
  waves?: { count?: number; intervalSec?: number };
  resources?: { renewalLimit?: number; cooldownSec?: number };
} = config;
