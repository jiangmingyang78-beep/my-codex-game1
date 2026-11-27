import { heroMaxHp } from "@/systems/itemEffects";
import { SnapshotError, isRecord } from "./saveMigration";
import { type Rec, int, num, rec, str } from "./snapshotFields";
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
  Systems,
} from "./types";

const PHASES: readonly EnemyPhase[] = [
  "idle",
  "SKIRT_LIGHT",
  "chase",
  "windup",
  "attack",
  "recovery",
];

export function readHero(
  raw: unknown,
  sys: Systems,
  inventory: Inventory,
  heroId: string,
): HeroState {
  const h = rec(raw, "hero");
  const { stats } = sys.data.balance;
  return {
    x: num(h.x, "hero_x"),
    y: num(h.y, "hero_y"),
    facingX: num(h.facingX, "facing", -1, 1),
    facingY: num(h.facingY, "facing", -1, 1),
    hp: int(h.hp, "hp", 0, heroMaxHp(sys.data, inventory, heroId)),
    hunger: num(h.hunger, "hunger", 0, stats.hunger.max),
    light: num(h.light, "light", 0, stats.light.max),
    attackCooldownSec: num(h.attackCooldownSec ?? 0, "timer", 0, 60),
    attackAnimSec: num(h.attackAnimSec ?? 0, "timer", 0, 60),
    invulnerableSec: num(h.invulnerableSec ?? 0, "timer", 0, 60),
    hungerDamageSec: num(h.hungerDamageSec ?? 0, "timer", 0, 600),
    darknessDamageSec: num(h.darknessDamageSec ?? 0, "timer", 0, 600),
    inFire: h.inFire === true,
  };
}

// Previous releases allowed 30 of these drops. Existing excess stays usable.
const LEGACY_STACK_LIMIT = new Map([
  ["raw_meat", 30],
  ["pelt", 30],
  ["herb", 30],
]);

export function readInventory(raw: unknown, sys: Systems): Inventory {
  const out: Inventory = {};
  for (const [id, n] of Object.entries(rec(raw, "inventory"))) {
    const item = sys.data.items.get(id);
    if (!item) throw new SnapshotError("invalid_inventory_item");
    const count = int(
      n,
      "inventory_count",
      0,
      Math.max(item.maxStack, LEGACY_STACK_LIMIT.get(id) ?? 0),
    );
    if (count > 0) out[id] = count;
  }
  return out;
}

export function readChanges(raw: unknown): Record<string, ObjectChange> {
  const out: Record<string, ObjectChange> = {};
  for (const [id, v] of Object.entries(rec(raw, "changes"))) {
    const c = rec(v, "change");
    const change: ObjectChange = {};
    for (const key of ["gathered", "opened", "lit", "defeated"] as const)
      if (c[key] === true) change[key] = true;
    if (c.renewals !== undefined) change.renewals = int(c.renewals, "renewals");
    if (Object.hasOwn(c, "loot") && Object.keys(change).length === 0) continue;
    out[id] = change;
  }
  return out;
}

export function readEnemies(
  raw: unknown,
  sys: Systems,
): Record<string, EnemyState> {
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
      targetId: typeof e.targetId === "string" ? e.targetId : undefined,
      threatId: typeof e.threatId === "string" ? e.threatId : undefined,
      threatUntil: num(e.threatUntil ?? 0, "threat_time", 0),
      retreating: e.retreating === true,
      persistent:
        e.persistent === true || sys.world.spawns.has(String(e.spawnId)),
      taskLocked: e.taskLocked === true,
      playerInteracted: e.playerInteracted === true,
      boss: e.boss === true || Boolean(def.phases),
      category:
        e.category === "neutral" ||
        e.category === "elite" ||
        e.category === "hostile"
          ? e.category
          : undefined,
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
      aimX: e.aimX === undefined ? undefined : num(e.aimX, "enemy_aim"),
      aimY: e.aimY === undefined ? undefined : num(e.aimY, "enemy_aim"),
      wardenPhase:
        e.wardenPhase === undefined
          ? undefined
          : int(e.wardenPhase, "warden_phase"),
      hurtTimer: num(e.hurtTimer ?? 0, "enemy_hurt", 0, 1),
      knockbackTimer: num(e.knockbackTimer ?? 0, "enemy_knockback", 0, 1),
      knockbackVx: num(e.knockbackVx ?? 0, "enemy_knockback"),
      knockbackVy: num(e.knockbackVy ?? 0, "enemy_knockback"),
      nightRound:
        e.nightRound === null || e.nightRound === undefined
          ? null
          : int(e.nightRound, "night_round"),
    };
  }
  return out;
}

export function readExtras(
  r: Rec,
  sys: Systems,
  collectedPickups: ReadonlySet<string>,
) {
  const projectiles: Projectile[] = (
    Array.isArray(r.projectiles) ? r.projectiles : []
  )
    .slice(0, sys.data.balance.limits.activeProjectiles)
    .map((v) => {
      const p = rec(v, "projectile");
      return {
        targetId: typeof p.targetId === "string" ? p.targetId : undefined,
        sourceId: typeof p.sourceId === "string" ? p.sourceId : undefined,
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
    const pickupId = typeof l.pickupId === "string" ? l.pickupId : null;
    if (pickupId && collectedPickups.has(pickupId)) continue;
    const lootId = pickupId ?? id;
    const item = sys.data.items.get(str(l.itemId, "loot_item"));
    if (!item) throw new SnapshotError("invalid_loot_item");
    groundLoot[lootId] = {
      id: lootId,
      itemId: item.id,
      count: int(l.count, "loot_count", 1, item.maxStack),
      x: num(l.x, "loot_pos"),
      y: num(l.y, "loot_pos"),
      pickupId,
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
  if (isRecord(r.nightRaid)) {
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

export function pickupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
}
