import { RunSession } from "@/game/session/RunSession";
import { rules } from "@/systems/runtimeRules";
import { blockedAt, solidAt } from "@/systems/world/collision";
import type { StepRequest } from "@/core/types";

const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};
const tile = (n: number) => (n + 0.5) * 16;
const dt = 0.05;
const seed = 438724;
function scenario(high: boolean) {
  for (const key of Object.keys(rules) as (keyof typeof rules)[]) delete rules[key];
  if (high)
    Object.assign(rules, {
      weights: { camp_edge: 4, old_mill: 4 },
      waves: { count: 6, intervalSec: 20 },
      resources: { cooldownSec: 3, renewalLimit: 1 },
      dash: { distanceTiles: 8, cooldownSec: 1 },
    });
  const random = Math.random;
  Math.random = () => seed / 4294967296;
  let run: RunSession;
  try {
    run = new RunSession("new");
  } finally {
    Math.random = random;
  }
  const { sys } = run,
    label = high ? "High pressure" : "Default";
  const move = (x: number, y: number) => Object.assign(run.state.hero, { x, y });
  const advance = (input: StepRequest["input"] = {}) => {
    // Keep both runs alive for two full nights while all movement, AI, spawns and survival clocks step normally.
    Object.assign(run.state.hero, { hp: 6, hunger: 100, light: 100 });
    return run.advance(dt, input, []).events;
  };
  const node = sys.world.objects.get("camp_dawn_wood_4")!;
  move(node.x, node.y);
  const harvest = () =>
    advance({ interactPressed: true }).some((e) => e.type === "resource.collected" && e.payload.objectId === node.id);
  const renewals = () => run.state.changesByObjectId[node.id]?.renewals ?? 0;
  const gathered = () => !!run.state.changesByObjectId[node.id]?.gathered;
  function reload() {
    check(run.save(), label + " Writing to _Other Organiser failed.___BAR__Return_reform_reform_reform_");
    const elapsed = run.state.elapsedSec;
    run = new RunSession("continue");
    check(run.state.seed === seed && run.state.elapsedSec === elapsed, label + " The game continues without the test file being restored");
  }
  check(harvest(), label + " The first collection failed");
  while (run.state.elapsedSec < 1) advance();
  reload();
  while (run.state.elapsedSec < 2.9) advance();
  check(gathered(), label + " The cooling is updated before the expiration date");
  while (run.state.elapsedSec < 3.15 && gathered()) advance();
  const afterCooldown = renewals();
  const readyAt = afterCooldown ? Number(run.state.elapsedSec.toFixed(2)) : null;
  check(high ? afterCooldown === 1 && !gathered() : afterCooldown === 0 && gathered(), label + " The first regeneration did not match the configuration");
  if (high) {
    check(harvest(), label + " Secondary collection failed");
    reload();
    check(renewals() === 1 && gathered(), label + " Number of loads lost or collected");
  }

  // Find a one-tile wall with open approaches on both sides in the real map.
  let wall: { x: number; y: number } | undefined;
  for (let y = 4; y < 55 && !wall; y++)
    for (let x = 6; x < 42 && !wall; x++) {
      if (!solidAt(sys.world, {}, x, y)) continue;
      if ([-2, -1, 1, 2, 3].every((offset) => !solidAt(sys.world, {}, x + offset, y))) wall = { x, y };
    }
  if (!wall) throw Error("No wall-to-wall blocks found");
  move(tile(wall.x - 1), tile(wall.y));
  for (let i = 0; i < 4; i++) advance({ moveX: i === 0 ? 1 : 0, dashPressed: i === 0 });
  const wallX = run.state.hero.x;
  check(
    wallX + 5 <= wall.x * 16 + 1e-5 && !blockedAt(sys.world, run.state.changesByObjectId, wallX, run.state.hero.y, 5),
    label + " Step through the single-gauge wall",
  );

  // Stage a resident near the open mill gate, then cross with actual movement input.
  run.state.changesByObjectId.old_mill_gate = { opened: true };
  const resident = run.state.enemiesById.camp_edge_weasel;
  Object.assign(resident, { x: tile(42), y: tile(24), homeX:tile(42),homeY:tile(24),nextSense:0,targetId:undefined,phase: "idle", cooldownSec: 4 });
  move(tile(46), tile(24));
  advance();
  const before = resident.phase;
  for (let i = 0; i < 12; i++) advance({ moveX: 1 });
  const after = resident.phase,
    destination = run.state.regionId;
  check(before === "chase" && after === "idle" && destination === "old_mill", label + " The permanent residence is off the hook");

  move(sys.world.heroStart.x, sys.world.heroStart.y);
  const counts = () =>
    Object.values(run.state.enemiesById).reduce(
      (out, e) => {
        if (e.nightRound !== null) {
          out.raid++;
          out.active++;
        } else if (sys.world.spawns.get(e.spawnId)?.regionId === run.state.regionId) out.active++;
        return out;
      },
      { raid: 0, active: 0 },
    );
  const nights = [
    { raid: 0, active: 0, spawned: 0 },
    { raid: 0, active: 0, spawned: 0 },
  ];
  let crossed = false,
    crossing = 0,
    raidAfterDawn = -1;
  let trackedRaidId: string | undefined;
  let raidChasedAcross = false;
  while (run.state.elapsedSec < 900.05) {
    const stepEvents = advance(
      crossed && run.state.day === 1 && run.state.phase === "night" && run.state.regionId === "camp_edge"
        ? { moveX: 1 }
        : {},
    );
    if (run.state.phase === "night") {
      const night = nights[run.state.day - 1];
      if (!night) throw Error("Dates are abnormal");
      const current = counts();
      night.active = Math.max(night.active, current.active);
      night.raid = Math.max(night.raid, current.raid);
      night.spawned += stepEvents.filter((e) => e.type === "enemy.spawned" && e.payload.night === run.state.day).length;
      if (!crossed && run.state.day === 1) {
        crossed = true;
        move(tile(47), tile(24));
        const raider = Object.values(run.state.enemiesById).find((e) => e.nightRound === 1);
        if (raider) {
          trackedRaidId = raider.id;
          Object.assign(raider, { x: tile(44), y: tile(24), cooldownSec: 4 });
        }
      }
      if (run.state.day === 1 && run.state.regionId === "old_mill") {
        crossing = Math.max(crossing, current.active);
        if (trackedRaidId && run.state.enemiesById[trackedRaidId]?.phase === "chase") raidChasedAcross = true;
      }
    }
    if (run.state.phase === "day" && run.state.day === 2) {
      raidAfterDawn = counts().raid;
      if (run.state.hero.x !== sys.world.heroStart.x) move(sys.world.heroStart.x, sys.world.heroStart.y);
    }
    if (!high && run.state.phase === "day" && run.state.day === 2 && renewals() === 1 && !gathered()) {
      move(node.x, node.y);
      check(harvest(), "Default second collection failed");
      reload();
      move(sys.world.heroStart.x, sys.world.heroStart.y);
    }
  }
  const limit = sys.data.balance.limits.activeEnemies;
  check(crossing > 0, label + " The first night was not in the mill");
  check(raidChasedAcross, label + " The nearby night raiders did not pursue the area");
  check(
    nights.every((n) => n.active <= limit),
    label + " Night raids across the area have been active against more enemies " + limit,
  );
  check(
    nights.every((n) => n.raid > 0) && raidAfterDawn === 0 && counts().raid === 0,
    label + " Night raids are generated or dawn exits are abnormal",
  );
  check(high ? renewals() === 1 && gathered() : renewals() === 2 && !gathered(), label + " The rebirths after two nights or the state of the wrong");
  return {
    label,
    seed,
    seconds: Math.round(run.state.elapsedSec),
    wall,
    wallX,
    before,
    after,
    destination,
    afterCooldown,
    readyAt,
    nights,
    crossing,
    raidChasedAcross,
    raidAfterDawn,
    renewals: renewals(),
    gathered: gathered(),
  };
}
try {
  const results = [scenario(false), scenario(true)];
  document.documentElement.dataset.emberResult = encodeURIComponent(JSON.stringify({ results, failures }));
} catch (e) {
  failures.push(e instanceof Error ? (e.stack ?? e.message) : String(e));
  document.documentElement.dataset.emberResult = encodeURIComponent(JSON.stringify({ failures }));
}
