/** Types describing the JSON configuration files (the source of truth for rules). */

import type { ItemDef, RecipeDef } from "./itemTypes";

export type {
  ItemDef,
  ItemEffect,
  OwnedStatName,
  RecipeDef,
  RecipeOutput,
} from "./itemTypes";

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
  type?: AttackMove["type"] | "melee" | "alternating";
  moves?: AttackMove[];
  enrage?: { hpRatioAtOrBelow: number; intervalSec: number };
  mode?: "projectile" | "aoe";
  triggerTiles?: number;
  dashDurationSec?: number;
  recoverSec?: number;
  reachTiles?: number;
  cooldownSec?: number;
  preferredTiles?: number;
  radiusTiles?: number;
}

export interface EnemyPhaseStage {
  hpThreshold: number;
  seedType: "lunge" | "stalk_melee" | "ranged_telegraph";
  overrides?: {
    moveSpeedPxPerSec?: number;
    attackDamage?: number;
    attack?: Partial<EnemyAttack>;
  };
}

export interface DropDef {
  itemId: string;
  count: number;
  probability: number;
  pickupId?: string;
  oncePerRun?: boolean;
}

export interface EnemyDef {
  specialKey?: string;
  scope?: "shared" | "adventure_only";
  id: string;
  name: string;
  regionIds: string[];
  maxHp: number;
  attackDamage: number;
  moveSpeedPxPerSec: number;
  attack: EnemyAttack;
  drops: DropDef[];
  seedType?: "lunge" | "stalk_melee" | "ranged_telegraph" | "warden_phase";
  phases?: EnemyPhaseStage[];
  knockbackSpeed?: number;
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

export type RegionEnvironmentRule =
  | { type: "slippery_ice"; drag: number }
  | {
      type: "dense_fog_bog";
      bogSpeedMult: number;
      fogLightDrainMult: number;
      safeTile: "path" | "floor";
    }
  | {
      type: "periodic_gale";
      intervalSec: number;
      durationSec: number;
      lightRadiusMult: number;
      pushSpeedPxPerSec: number;
      pushDirX: number;
      pushDirY: number;
    }
  | { type: "low_pressure_storm"; lightDrainMult: number; coldScale: number }
  | { type: "explosive_barrels"; blastRadiusTiles: number; blastDamage: number }
  | { type: "mirror_darkroom"; requiredLamps: number };

export interface StoryPropDef {
  id: string;
  tileX: number;
  tileY: number;
  spriteKey: string;
  toast: string;
  heroToasts?: Record<string, string>;
  unlockNoteId?: string;
  rewardItem?: { itemId: string; count: number; pickupId: string };
}

export interface RegionDef {
  id: string;
  name: string;
  act?: number;
  kind?: "main" | "side";
  environmentRule?: RegionEnvironmentRule;
  storyProps?: StoryPropDef[];
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
  survival: import("../systems/survivalOverrides").SurvivalTuning;
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
  heroIds: string[];
  plantIds: string[];
  weatherIds: string[];
}

export type HeroUnlock =
  | { type: "default" }
  | { type: "boss_defeated"; enemyId: string }
  | { type: "consumables_crafted" | "kills" | "camp_notes"; count: number };

export interface HeroDef {
  id: string;
  name: string;
  epithet: string;
  roleTag: string;
  bio: string;
  quote: string;
  traitName: string;
  traitDesc: string;
  traits: {
    maxHpDelta?: number;
    attackDamageDelta?: number;
    moveSpeedMult?: number;
    lightRadiusMult?: number;
    lightDrainMult?: number;
    immunityBonusSec?: number;
    inFireRegenMult?: number;
    healBonus?: number;
  };
  startingInventory: Record<string, number>;
  unlock: HeroUnlock;
  palette: Record<"o" | "f" | "s" | "e" | "p" | "b" | "d", string>;
}

export interface LoreData {
  worldTagline: string;
  regionToasts: Record<string, string>;
  campNotes: Record<string, { title: string; body: string }>;
  endings: Record<
    "won" | "dead" | "storm_lost",
    { title: string; epilogue: string }
  >;
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
  heroes: ReadonlyMap<string, HeroDef>;
  defaultHeroId: string;
  lore: LoreData;
  worldObjects: RegionsFile["worldObjects"];
  dawnRenewal: RegionsFile["dawnRenewal"];
  catalog: CatalogDefinitions;
  tileSize: number;
  /** Relay socket ids declared by regions.json (total slots in the whole game). */
  relaySocketIds: readonly string[];
}
