import { blockedAt } from "@/systems/world/collision";
import { dayAt, phaseAt } from "./clock";
import type {
  BuffState,
  EnemyPhase,
  EnemyState,
  GroundLoot,
  HeroState,
  Inventory,
  ObjectChange,
  Projectile,
  RunState,
  RunStatus,
  Systems,
} from "./types";

export const RUN_SCHEMA_VERSION = 1;

const STATUSES: readonly RunStatus[] = ["playing", "won", "dead", "storm_lost"];
const PHASES: readonly EnemyPhase[] = [
  "idle",
  "chase",
  "windup",
  "attack",
  "recovery",
];

export class SnapshotError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function num(
  v: unknown,
  field: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new SnapshotError(`invalid_${field}`);
  return v;
}
function int(
  v: unknown,
  field: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const n = num(v, field, min, max);
  if (!Number.isInteger(n)) throw new SnapshotError(`invalid_${field}`);
  return n;
}
function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0)
    throw new SnapshotError(`invalid_${field}`);
  return v;
}
function rec(v: unknown, field: string): Rec {
  if (!isRec(v)) throw new SnapshotError(`invalid_${field}`);
  return v;
}

function readHero(
  raw: unknown,
  sys: Systems,
  changes: Record<string, ObjectChange>,
): HeroState {
  const h = rec(raw, "hero");
  const { stats } = sys.data.balance;
  const w = sys.world;
  const hero: HeroState = {
    x: num(h.x, "hero_x", 0, w.widthTiles * w.tileSize),
    y: num(h.y, "hero_y", 0, w.heightTiles * w.tileSize),
    facingX: num(h.facingX, "facing", -1, 1),
    facingY: num(h.facingY, "facing", -1, 1),
    hp: int(h.hp, "hp", 0, stats.hp.max),
    hunger: num(h.hunger, "hunger", 0, stats.hunger.max),
    light: num(h.light, "light", 0, stats.light.max),
    attackCooldownSec: num(h.attackCooldownSec ?? 0, "timer", 0, 60),
    attackAnimSec: num(h.attackAnimSec ?? 0, "timer", 0, 60),
    invulnerableSec: num(h.invulnerableSec ?? 0, "timer", 0, 60),
    hungerDamageSec: num(h.hungerDamageSec ?? 0, "timer", 0, 600),
    darknessDamageSec: num(h.darknessDamageSec ?? 0, "timer", 0, 600),
    inFire: h.inFire === true,
  };
  if (blockedAt(w, changes, hero.x, hero.y, 5)) {
    hero.x = w.heroStart.x;
    hero.y = w.heroStart.y;
  }
  return hero;
}

function readInventory(raw: unknown, sys: Systems): Inventory {
  const out: Inventory = {};
  for (const [id, n] of Object.entries(rec(raw, "inventory"))) {
    const item = sys.data.items.get(id);
    if (!item) throw new SnapshotError("invalid_inventory_item");
    const count = int(n, "inventory_count", 0, item.maxStack);
    if (count > 0) out[id] = count;
  }
  return out;
}

function readChanges(raw: unknown): Record<string, ObjectChange> {
  const out: Record<string, ObjectChange> = {};
  for (const [id, v] of Object.entries(rec(raw, "changes"))) {
    const c = rec(v, "change");
    const change: ObjectChange = {};
    for (const key of ["gathered", "opened", "lit", "defeated"] as const)
      if (c[key] === true) change[key] = true;
    if (c.renewals !== undefined) change.renewals = int(c.renewals, "renewals");
    if (c.loot === "pending" || c.loot === "picked") change.loot = c.loot;
    out[id] = change;
  }
  return out;
}

function readEnemies(raw: unknown, sys: Systems): Record<string, EnemyState> {
  const out: Record<string, EnemyState> = {};
  for (const [id, v] of Object.entries(rec(raw, "enemies"))) {
    const e = rec(v, "enemy");
    const def = sys.data.enemies.get(str(e.enemyId, "enemy_id"));
    if (!def) throw new SnapshotError("invalid_enemy_id");
    const phase = PHASES.find((p) => p === e.phase);
    if (!phase) throw new SnapshotError("invalid_enemy_phase");
    out[id] = {
      id,
      enemyId: def.id,
      spawnId: str(e.spawnId, "spawn_id"),
      homeX: num(e.homeX, "enemy_pos"),
      homeY: num(e.homeY, "enemy_pos"),
      x: num(e.x, "enemy_pos"),
      y: num(e.y, "enemy_pos"),
      hp: num(e.hp, "enemy_hp", 1, def.maxHp),
      phase,
      phaseSec: num(e.phaseSec ?? 0, "enemy_timer", -10, 60),
      cooldownSec: num(e.cooldownSec ?? 0, "enemy_timer", 0, 60),
      dirX: num(e.dirX ?? 0, "enemy_dir", -1, 1),
      dirY: num(e.dirY ?? 1, "enemy_dir", -1, 1),
      moveIndex: int(e.moveIndex ?? 0, "enemy_move"),
      hitDone: e.hitDone === true,
      nightRound:
        e.nightRound === null || e.nightRound === undefined
          ? null
          : int(e.nightRound, "night_round"),
    };
  }
  return out;
}

function readExtras(r: Rec, sys: Systems) {
  const projectiles: Projectile[] = (
    Array.isArray(r.projectiles) ? r.projectiles : []
  )
    .slice(0, sys.data.balance.limits.activeProjectiles)
    .map((v) => {
      const p = rec(v, "projectile");
      return {
        id: str(p.id, "projectile"),
        x: num(p.x, "projectile"),
        y: num(p.y, "projectile"),
        vx: num(p.vx, "projectile"),
        vy: num(p.vy, "projectile"),
        lifeSec: num(p.lifeSec, "projectile", 0, 60),
        damage: int(p.damage, "projectile", 1, 9),
      };
    });
  const groundLoot: Record<string, GroundLoot> = {};
  for (const [id, v] of Object.entries(rec(r.groundLoot ?? {}, "loot"))) {
    const l = rec(v, "loot");
    const item = sys.data.items.get(str(l.itemId, "loot_item"));
    if (!item) throw new SnapshotError("invalid_loot_item");
    groundLoot[id] = {
      id,
      itemId: item.id,
      count: int(l.count, "loot_count", 1, item.maxStack),
      x: num(l.x, "loot_pos"),
      y: num(l.y, "loot_pos"),
      pickupId: typeof l.pickupId === "string" ? l.pickupId : null,
      refusedNotified: false,
    };
  }
  const buffs: Record<string, BuffState> = {};
  for (const [id, v] of Object.entries(rec(r.buffs ?? {}, "buffs"))) {
    const b = rec(v, "buff");
    if (b.effect !== "night_light_drain_multiplier")
      throw new SnapshotError("invalid_buff");
    buffs[id] = {
      effect: b.effect,
      multiplier: num(b.multiplier, "buff", 0.01, 1),
      remainingSec: num(b.remainingSec, "buff", 0.001, 3600),
    };
  }
  let nightRaid: RunState["nightRaid"] = null;
  if (isRec(r.nightRaid)) {
    const n = r.nightRaid;
    nightRaid = {
      regionId: str(n.regionId, "raid"),
      round: int(n.round, "raid", 1),
      spawnedIds: Array.isArray(n.spawnedIds)
        ? n.spawnedIds.filter((s): s is string => typeof s === "string")
        : [],
    };
  }
  return { projectiles, groundLoot, buffs, nightRaid };
}

/**
 * Validates an unknown value as a RunState and returns a clean deep copy. Throws SnapshotError
 * (reason `version_mismatch` or `invalid_*`) for corrupt or incompatible data.
 */
export function sanitizeRunState(raw: unknown, sys: Systems): RunState {
  const r = rec(raw, "root");
  if (r.schemaVersion !== RUN_SCHEMA_VERSION)
    throw new SnapshotError("version_mismatch");
  const balance = sys.data.balance;
  const status = STATUSES.find((s) => s === r.status);
  if (!status) throw new SnapshotError("invalid_status");
  const regionId = str(r.regionId, "region");
  if (!sys.data.regions.has(regionId))
    throw new SnapshotError("invalid_region");
  const campLevel = int(r.campLevel, "camp_level", 1);
  if (!(String(campLevel) in balance.camp.radiiTilesByLevel))
    throw new SnapshotError("invalid_camp_level");
  const elapsedSec = num(
    r.elapsedSec,
    "elapsed",
    0,
    balance.clock.runLimitSec * 2,
  );
  const inventory = readInventory(r.inventory, sys);
  const changesByObjectId = readChanges(r.changesByObjectId);
  const seals = Array.isArray(r.seals)
    ? [...new Set(r.seals.filter((s): s is string => typeof s === "string"))]
    : [];
  const fixedIds = new Set<string>();
  for (const reward of sys.data.encounters.values())
    for (const d of reward.drops) if (d.pickupId) fixedIds.add(d.pickupId);
  if (!seals.every((s) => fixedIds.has(s)))
    throw new SnapshotError("invalid_seals");
  if (seals.length)
    inventory.ember_seal = Math.min(
      seals.length,
      sys.data.items.get("ember_seal")?.maxStack ?? 2,
    );
  else Reflect.deleteProperty(inventory, "ember_seal");
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: str(r.runId, "run_id"),
    seed: int(r.seed, "seed", 0, 4294967295),
    rngState: int(r.rngState, "rng", 0, 4294967295),
    elapsedSec,
    status,
    phase: phaseAt(elapsedSec, balance),
    day: dayAt(elapsedSec, balance),
    regionId,
    hero: readHero(r.hero, sys, changesByObjectId),
    inventory,
    campLevel,
    seals,
    changesByObjectId,
    enemiesById: readEnemies(r.enemiesById, sys),
    ...readExtras(r, sys),
    autosaveSec: num(r.autosaveSec ?? 0, "autosave", 0, 3600),
    idCounter: int(r.idCounter ?? 0, "id_counter"),
  };
}
