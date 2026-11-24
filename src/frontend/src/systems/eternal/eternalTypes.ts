/** Shared types and tuning constants of the Eternal Mode (永恒模式). Runtime state lives in memory only. */

export type EternalPhase = "prep" | "combat";
export type LoadoutMode = "standard" | "free";

/** In-memory director state, attached to a RunState through a WeakMap (never saved). */
export interface EternalRunRuntime {
  phase: EternalPhase;
  prepRemainingSec: number;
  loadoutMode: LoadoutMode;
  combatElapsedSec: number;
  kills: number;
  credits: number;
  spawnTimerSec: number;
  nextBossSec: number;
  bossWaveCount: number;
  nextSupplySec: number;
  pendingPicks: number;
}

export const ETERNAL = {
  prepSec: 20,
  /** Daylight lasts through the prep and the first dusk; night then never ends. */
  daySec: 90,
  nightSec: 1_000_000,
  campLevel: 3,
  enemyCap: 14,
  firstBossSec: 120,
  bossIntervalSec: 120,
  supplyIntervalSec: 90,
  spawnMinTiles: 10,
  spawnMaxTiles: 13,
  safeHeroTiles: 6,
  supplyDropChance: 0.28,
  maxCredits: 60,
  hpScaleStartSec: 180,
  hpScaleStepSec: 120,
  hpScaleStep: 0.15,
  weaponIds: ["iron_spear", "iron_blade"],
  quotaWeapon: 1,
  quotaGear: 2,
  startingSupplies: { ration: 2, bandage: 2, herb_salve: 1 },
  supplyDrops: [
    { itemId: "berry", weight: 4 },
    { itemId: "roast_meat", weight: 3 },
    { itemId: "bandage", weight: 2 },
    { itemId: "herb_salve", weight: 1 },
  ],
  bossOrder: ["mill_overseer", "summit_pyre_warden", "beacon_keeper"],
} as const;

export interface EternalOption {
  id: string;
  name: string;
  description: string;
  kind: "weapon" | "gear";
  selected: boolean;
}

export interface EternalQuota {
  used: number;
  max: number;
}

/** Everything the React layer needs for the Eternal HUD and the loadout panel. */
export interface EternalHud {
  phase: EternalPhase;
  prepRemainingSec: number;
  combatSec: number;
  kills: number;
  bossInSec: number;
  bossWave: number;
  loadoutMode: LoadoutMode;
  pendingPicks: number;
  clockText: string;
  threatText: string;
  objective: string;
  options: EternalOption[];
  weaponQuota: EternalQuota;
  gearQuota: EternalQuota;
}
