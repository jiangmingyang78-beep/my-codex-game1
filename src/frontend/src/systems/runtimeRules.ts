import config from "@/data/encounters.json";
export const rules: {
  dash?: { distanceTiles?: number; cooldownSec?: number };
  perception?: { aggroTiles?: number; leashTiles?: number };
  weights?: Record<string, number>;
  waves?: { count?: number; intervalSec?: number };
  resources?: { renewalLimit?: number; cooldownSec?: number };
} = config;
