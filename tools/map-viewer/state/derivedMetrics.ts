import items from "@/data/items.json";
import type { Draft } from "./documents";
export type Attack = {
  windupSec?: number;
  activeSec?: number;
  travelSec?: number;
  dashDurationSec?: number;
  recoverSec?: number;
  recoverySec?: number;
  cooldownSec?: number;
  intervalSec?: number;
  moves?: Attack[];
  enrage?: { intervalSec: number; hpRatioAtOrBelow: number };
  triggerRangeTiles?: number;
  triggerTiles?: number;
  preferredTiles?: number;
  distanceTiles?: number;
  reachTiles?: number;
  rangeTiles?: number;
  arcDegrees?: number;
  radiusTiles?: number;
  projectileLifetimeSec?: number;
  projectileSpeedPxPerSec?: number;
};
export type Combatant = {
  id: string;
  name: string;
  maxHp: number;
  attackDamage: number;
  attack?: Attack;
  phases?: { hpThreshold: number; overrides: { attack?: Attack; attackDamage?: number } }[];
};
function effect(id: string, stat: string) {
  const e = items.items.find((i) => i.id === id)?.effects.find((e) => "stat" in e && e.stat === stat);
  return e && "value" in e ? Number(e.value) : 0;
}
const fmt = (n: number) => (Number.isFinite(n) ? String(Number(n.toFixed(2))) : "∞");
export const bossEnemy = (id: string) =>
  ["mill_overseer", "summit_pyre_warden", "beacon_keeper", "scarred_alpha", "spore_matriarch"].includes(id);
export function lookupEnemy(d: Draft, id: string): Combatant | undefined {
  return [...d["enemies.json"].enemies, ...d["legacyEnemies.json"].enemies].find((e) => e.id === id);
}
function cycle(a: Attack): number {
  const action = a.moves?.length
    ? a.moves.reduce((sum, m) => sum + cycle(m), 0) / a.moves.length
    : (a.windupSec ?? 0) +
      (a.activeSec ?? a.travelSec ?? a.dashDurationSec ?? 0) +
      (a.recoverSec ?? a.recoverySec ?? 0);
  const interval = a.intervalSec ?? a.cooldownSec ?? 0;
  return (
    action +
    (a.enrage
      ? interval * (1 - a.enrage.hpRatioAtOrBelow) + a.enrage.intervalSec * a.enrage.hpRatioAtOrBelow
      : interval)
  );
}
export function enemyMetrics(d: Draft, id: string, heroId: string) {
  const e = lookupEnemy(d, id);
  const rows: Record<string, string> = {};
  if (!e) return rows;
  const b = d["balance.json"].hero;
  const hero = d["heroes.json"].heroes.find((h) => h.id === heroId);
  const delta = hero?.traits.attackDamageDelta ?? 0;
  for (const [weapon, damage] of [
    ["徒手", b.attackDamage],
    ["铁矛", Math.max(b.attackDamage, Number(effect("iron_spear", "attackDamage")))],
    ["淬炭短刃", b.attackDamage + Number(effect("iron_blade", "attackDamage"))],
  ] as const) {
    const hits = Math.ceil(e.maxHp / Math.max(0, damage + delta));
    rows[weapon + " TTK"] = fmt(hits) + " 刀 · " + fmt((hits - 1) * b.attackCooldownSec) + " 秒";
  }
  const phases = e.phases ?? [{ hpThreshold: 1, overrides: {} }];
  let dps = 0,
    peak = 0;
  phases.forEach((p, i) => {
    const damage = p.overrides.attackDamage ?? e.attackDamage;
    peak = Math.max(peak, damage);
    const period = cycle(p.overrides.attack ?? e.attack ?? {});
    dps += ((p.hpThreshold - (phases[i + 1]?.hpThreshold ?? 0)) * damage) / period;
  });
  rows["敌方理论 DPS"] = fmt(dps);
  const survive = (hp: number, dr: number) =>
    fmt(peak === 0 ? Infinity : Math.ceil(hp / Math.max(1, peak - dr)) - 1) + " 下";
  rows["6 血裸装可存活"] = survive(6, 0);
  rows["锻铁胸甲可存活"] = survive(
    6 + Number(effect("iron_armor", "maxHp")),
    Number(effect("iron_armor", "damageReduction")),
  );
  return rows;
}
export function heroMetrics(d: Draft, id: string) {
  const b = d["balance.json"],
    hero = d["heroes.json"].heroes.find((h) => h.id === id);
  const t = hero?.traits,
    bag = hero?.startingInventory as Record<string, number | undefined> | undefined;
  const owned = items.items.filter((item) => Number(bag?.[item.id]) > 0);
  const bonus = (stat: string) =>
    owned.reduce(
      (sum, item) =>
        sum +
        item.effects.reduce(
          (n, e) =>
            n + (e.type === "add_owned_stat" && "stat" in e && e.stat === stat && "value" in e ? Number(e.value) : 0),
          0,
        ),
      0,
    );
  const baseDamage = bag?.iron_spear
    ? Math.max(b.hero.attackDamage, effect("iron_spear", "attackDamage"))
    : b.hero.attackDamage;
  const drain = owned.reduce(
    (factor, item) =>
      factor *
      item.effects.reduce(
        (n, e) => n * (e.type === "night_light_drain_multiplier" && "multiplier" in e ? Number(e.multiplier) : 1),
        1,
      ),
    1,
  );
  const dash =
    d["encounters.json"].dash?.distanceTiles ??
    (b.hero.moveSpeedPxPerSec * (t?.moveSpeedMult ?? 1) * (1 + bonus("moveSpeedBonus")) * 2.35 * 0.16) /
      b.world.tileSizePx;
  return {
    "初始装备 DPS": fmt((baseDamage + bonus("attackDamage") + (t?.attackDamageDelta ?? 0)) / b.hero.attackCooldownSec),
    移动速度:
      fmt((b.hero.moveSpeedPxPerSec * (1 + bonus("moveSpeedBonus")) * (t?.moveSpeedMult ?? 1)) / b.world.tileSizePx) +
      " 格/秒",
    急步覆盖: fmt(dash) + " 格",
    "满血容错（每击 1 伤）": fmt(Math.ceil(b.stats.hp.max + bonus("maxHp") + (t?.maxHpDelta ?? 0)) - 1) + " 下",
    夜间满火炬续航:
      fmt(b.stats.light.max / (b.stats.light.nightDrainPerSec * drain * (t?.lightDrainMult ?? 1))) + " 秒",
  };
}
