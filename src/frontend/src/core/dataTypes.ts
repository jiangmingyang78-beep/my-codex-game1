/** Types describing the JSON configuration files (the source of truth for rules). */

export type ItemEffect =
  | {
      trigger: "use";
      type: "restore_stat";
      stat: "hunger" | "hp";
      amount: number;
      requiresBelowMax?: boolean;
    }
  | {
      trigger: "use" | "owned";
      type: "night_light_drain_multiplier";
      multiplier: number;
      durationSec?: number;
      reapply?: "refresh_duration";
    }
  | {
      trigger: "owned";
      type: "set_combat_stat";
      stat: "attackDamage" | "attackRangeTiles";
      value: number;
    }
  | {
      trigger: "place";
      type: "ignite_relay";
      targetType: string;
      radiusTiles: number;
      consumeCount: number;
    }
  | {
      trigger: "owned" | "interact";
      type: "quest_requirement" | "ignite_beacon";
      targetId: string;
      requiredCount: number;
    };

export interface ItemDef {
  id: string;
  name: string;
  type: string;
  maxStack: number;
  effects: ItemEffect[];
  description: string;
}

export type RecipeOutput =
  | { type: "item"; id: string; count: number }
  | { type: "camp_level"; level: number };

export interface RecipeDef {
  id: string;
  name: string;
  stationId: string;
  minCampLevel: number;
  inputs: Record<string, number>;
  output: RecipeOutput;
  constraints?: {
    uniqueOutput?: boolean;
    inventoryCapSource?: string;
    exactCampLevel?: number;
  };
}

export interface AttackMove {
  type: "lunge" | "projectile" | "charge" | "sweep";
  triggerRangeTiles: number;
  windupSec: number;
  recoverySec: number;
  intervalSec?: number;
  distanceTiles?: number;
  travelSec?: number;
  rangeTiles?: number;
  arcDegrees?: number;
  activeSec?: number;
  lightDamage?: number;
  projectileSpeedPxPerSec?: number;
  projectileLifetimeSec?: number;
}

export interface EnemyAttack extends Omit<Partial<AttackMove>, "type"> {
  type: AttackMove["type"] | "alternating";
  moves?: AttackMove[];
  enrage?: { hpRatioAtOrBelow: number; intervalSec: number };
}

export interface DropDef {
  itemId: string;
  count: number;
  probability: number;
  pickupId?: string;
  oncePerRun?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  regionIds: string[];
  maxHp: number;
  attackDamage: number;
  moveSpeedPxPerSec: number;
  attack: EnemyAttack;
  drops: DropDef[];
}

export interface EncounterRewardDef {
  encounterId: string;
  regionId: string;
  trigger: "all_members_defeated";
  members: { enemyId: string; count: number }[];
  drops: DropDef[];
}

export interface SpawnDef {
  spawnId: string;
  enemyId: string;
}

export interface RegionDef {
  id: string;
  name: string;
  entry: {
    gateId: string | null;
    minCampLevel: number;
    requiredPickupIds: string[];
  };
  encounterId: string | null;
  relaySocketId: string | null;
  minimumStartingSupply: Record<string, number>;
  residentSpawns: SpawnDef[];
  nightSpawns: SpawnDef[];
  bossTrigger?: { objectId: string; spawnId: string; lightZoneId: string };
}

export interface RegionsFile {
  regions: RegionDef[];
  worldObjects: {
    heroSpawnId: string;
    mainCampfireId: string;
    finalBeaconId: string;
    renewableWoodNodeIds: string[];
  };
  dawnRenewal: { renewableItemIds: string[] };
}

export interface StatDef {
  initial: number;
  max: number;
}

export interface BalanceData {
  schemaVersion: number;
  world: {
    mapKey: string;
    widthTiles: number;
    heightTiles: number;
    tileSizePx: number;
    logicalWidthPx: number;
    logicalHeightPx: number;
  };
  clock: {
    daySec: number;
    nightSec: number;
    runLimitSec: number;
    maxStepSec: number;
  };
  starting: {
    regionId: string;
    campLevel: number;
    inventory: Record<string, number>;
  };
  stats: {
    hp: StatDef & { damageImmunitySec: number };
    hunger: StatDef & {
      dayDrainPerMinute: number;
      nightDrainPerMinute: number;
      zeroDamage: number;
      zeroDamageIntervalSec: number;
    };
    light: StatDef & {
      nightDrainPerSec: number;
      inFireRegenPerSec: number;
      zeroDamage: number;
      zeroDamageIntervalSec: number;
    };
  };
  hero: {
    moveSpeedPxPerSec: number;
    interactRangeTiles: number;
    attackDamage: number;
    attackRangeTiles: number;
    attackArcDegrees: number;
    attackCooldownSec: number;
    quickUseItemIds: string[];
  };
  camp: { radiiTilesByLevel: Record<string, number>; relayRadiusTiles: number };
  storage: {
    runKey: string;
    runBackupKey: string;
    metaKey: string;
    autosaveIntervalSec: number;
  };
  limits: {
    activeEnemies: number;
    activeProjectiles: number;
    maxParticles: number;
    reducedMotionMaxParticles: number;
  };
  meta: { notes: { id: string; trigger: string }[] };
}

export interface CatalogDefinitions {
  schemaVersion: number;
  itemIds: string[];
  recipeIds: string[];
  enemyIds: string[];
  regionIds: string[];
}

/** Indexed, read-only game data built once from the JSON files. */
export interface GameData {
  balance: BalanceData;
  items: ReadonlyMap<string, ItemDef>;
  itemList: readonly ItemDef[];
  recipes: ReadonlyMap<string, RecipeDef>;
  recipeList: readonly RecipeDef[];
  enemies: ReadonlyMap<string, EnemyDef>;
  encounters: ReadonlyMap<string, EncounterRewardDef>;
  regions: ReadonlyMap<string, RegionDef>;
  regionList: readonly RegionDef[];
  worldObjects: RegionsFile["worldObjects"];
  dawnRenewal: RegionsFile["dawnRenewal"];
  catalog: CatalogDefinitions;
  tileSize: number;
  /** Relay socket ids declared by regions.json (total slots in the whole game). */
  relaySocketIds: readonly string[];
}
