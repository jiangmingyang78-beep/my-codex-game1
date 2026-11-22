import type { World } from "../systems/world/worldTypes";
import type { GameData } from "./dataTypes";

export type RunStatus = "playing" | "won" | "dead" | "storm_lost";
export type DayPhase = "day" | "night";
export type Inventory = Record<string, number>;

export interface HeroState {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  hp: number;
  hunger: number;
  light: number;
  attackCooldownSec: number;
  attackAnimSec: number;
  invulnerableSec: number;
  hungerDamageSec: number;
  darknessDamageSec: number;
  inFire: boolean;
}

/** Per-object persistent changes (gathered, opened, lit, fixed loot). */
export interface ObjectChange {
  gathered?: boolean;
  renewals?: number;
  opened?: boolean;
  lit?: boolean;
  defeated?: boolean;
  loot?: "pending" | "picked";
}

export type EnemyPhase = "idle" | "chase" | "windup" | "attack" | "recovery";

export interface EnemyState {
  id: string;
  enemyId: string;
  spawnId: string;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  hp: number;
  phase: EnemyPhase;
  phaseSec: number;
  cooldownSec: number;
  dirX: number;
  dirY: number;
  moveIndex: number;
  hitDone: boolean;
  nightRound: number | null;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeSec: number;
  damage: number;
}

export interface GroundLoot {
  id: string;
  itemId: string;
  count: number;
  x: number;
  y: number;
  pickupId: string | null;
  refusedNotified: boolean;
}

export interface BuffState {
  effect: "night_light_drain_multiplier";
  multiplier: number;
  remainingSec: number;
}

export interface NightRaid {
  regionId: string;
  round: number;
  spawnedIds: string[];
}

export interface RunState {
  schemaVersion: number;
  runId: string;
  seed: number;
  rngState: number;
  elapsedSec: number;
  status: RunStatus;
  phase: DayPhase;
  day: number;
  regionId: string;
  hero: HeroState;
  inventory: Inventory;
  campLevel: number;
  seals: string[];
  changesByObjectId: Record<string, ObjectChange>;
  enemiesById: Record<string, EnemyState>;
  projectiles: Projectile[];
  groundLoot: Record<string, GroundLoot>;
  buffs: Record<string, BuffState>;
  nightRaid: NightRaid | null;
  autosaveSec: number;
  idCounter: number;
}

/** {type, x, y, payload}; x and y are world pixels or null when position does not apply. */
export interface GameEvent {
  type: string;
  x: number | null;
  y: number | null;
  payload: Record<string, unknown>;
}

export interface StepInputState {
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  interactPressed: boolean;
  itemId: string | null;
  pausePressed: boolean;
}

/** Read-only snapshot supplied by the scene when Arcade physics owns hero movement. */
export interface StepFrame {
  hero?: { x: number; y: number };
  contacts?: readonly string[];
}

export interface Command {
  type: "craft" | "use" | "interact";
  id: string;
}

export interface StepRequest {
  sec: number;
  input?: Partial<StepInputState>;
  frame?: StepFrame;
  commands?: readonly Command[];
}

/** Everything the rule systems read: static configuration plus the generated world. */
export interface Systems {
  data: GameData;
  world: World;
}

export interface RunConfig {
  systems?: Systems;
  seed?: number;
  runId?: string;
}

/** Outcome of a rule action. `reason` is a stable machine code; see reasonMessage(). */
export interface ActionResult {
  ok: boolean;
  reason?: string;
  events: GameEvent[];
  detail?: Record<string, unknown>;
}
