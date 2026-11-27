import balance from "@/data/balance.json";
export const scenarioDefaults = {
  waves: { intervalSec: 30, count: 1 },
  resources: { renewalLimit: 1, cooldownSec: 60 },
  dash: { distanceTiles: 1.88, cooldownSec: 1.6 },
  perception: { aggroTiles: 8, leashTiles: 16 },
};
export const survivalDefaults = balance.survival;
