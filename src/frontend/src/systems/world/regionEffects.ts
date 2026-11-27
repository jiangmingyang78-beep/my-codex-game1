import { EVT, makeEvent } from "@/core/events";
import type { GameEvent, RunState, Systems } from "@/core/types";
import { hitEnemy } from "../EnemyManager";
import { countOf } from "../inventory";
import { ownedStatBonus } from "../itemEffects";
import { type MoveOut, moveWithCollision } from "./collision";
import { ignite } from "./runLight";
import { TILE } from "./worldTypes";

const HERO_PUSH_RADIUS = 5;

export interface RegionModifiers {
  speedMult: number;
  lightDrainMult: number;
  lightRadiusMult: number;
  slipperyDrag: number | null;
  galeActive: boolean;
}

const pushScratch: MoveOut = { x: 0, y: 0 };

function tileAtHero(state: RunState, sys: Systems): number {
  const tx = Math.floor(state.hero.x / sys.data.tileSize);
  const ty = Math.floor(state.hero.y / sys.data.tileSize);
  const { widthTiles, heightTiles, tiles } = sys.world;
  if (tx < 0 || ty < 0 || tx >= widthTiles || ty >= heightTiles)
    return TILE.wall;
  return tiles[ty * widthTiles + tx];
}

export function evaluateRegionModifiers(
  state: RunState,
  sys: Systems,
): RegionModifiers {
  const out: RegionModifiers = {
    speedMult: 1,
    lightDrainMult: 1,
    lightRadiusMult: 1,
    slipperyDrag: null,
    galeActive: false,
  };
  const rule = sys.data.regions.get(state.regionId)?.environmentRule;
  if (!rule) return out;
  const tile = tileAtHero(state, sys);

  if (rule.type === "slippery_ice" && tile === TILE.ice) {
    out.slipperyDrag = rule.drag;
  } else if (rule.type === "dense_fog_bog") {
    const onSafe = tile === TILE[rule.safeTile];
    if (!onSafe && tile === TILE.bog) out.speedMult = rule.bogSpeedMult;
    const hasLantern =
      countOf(state.inventory, "ember_lantern") > 0 ||
      countOf(state.inventory, "lantern") > 0;
    if (!hasLantern) out.lightDrainMult = rule.fogLightDrainMult;
  } else if (rule.type === "periodic_gale") {
    const phaseSec = state.elapsedSec % rule.intervalSec;
    if (phaseSec >= rule.intervalSec - rule.durationSec) {
      out.galeActive = true;
      out.lightRadiusMult = rule.lightRadiusMult;
    }
  } else if (rule.type === "low_pressure_storm") {
    const resist = ownedStatBonus(sys.data, state.inventory, "coldResist");
    out.lightDrainMult = Math.max(
      0.4,
      rule.lightDrainMult * (1 - resist * rule.coldScale),
    );
  } else if (rule.type === "mirror_darkroom") {
    const litLamps = sys.world.objectList.filter(
      (o) =>
        o.regionId === state.regionId &&
        o.kind === "mirror_lamp" &&
        state.changesByObjectId[o.id]?.lit,
    ).length;
    out.lightRadiusMult = litLamps >= rule.requiredLamps ? 1.15 : 0.7;
  }
  return out;
}

export function tickRegionEffects(
  state: RunState,
  sys: Systems,
  sec: number,
  events: GameEvent[],
): RegionModifiers {
  const mods = evaluateRegionModifiers(state, sys);
  const rule = sys.data.regions.get(state.regionId)?.environmentRule;
  if (rule?.type === "periodic_gale" && mods.galeActive && !state.hero.inFire) {
    moveWithCollision(
      sys.world,
      state.changesByObjectId,
      state.hero.x,
      state.hero.y,
      rule.pushDirX * rule.pushSpeedPxPerSec * sec,
      rule.pushDirY * rule.pushSpeedPxPerSec * sec,
      HERO_PUSH_RADIUS,
      pushScratch,
    );
    state.hero.x = pushScratch.x;
    state.hero.y = pushScratch.y;
    events.push(
      makeEvent("env.gale_tick", state.hero.x, state.hero.y, {
        dirX: rule.pushDirX,
        dirY: rule.pushDirY,
      }),
    );
  }
  return mods;
}

export function detonateResinBarrel(
  state: RunState,
  sys: Systems,
  barrelId: string,
  events: GameEvent[],
): boolean {
  const barrel = sys.world.objects.get(barrelId);
  if (
    !barrel ||
    barrel.kind !== "explosive_barrel" ||
    state.changesByObjectId[barrelId]?.opened
  )
    return false;
  const rule = sys.data.regions.get(barrel.regionId)?.environmentRule;
  const radiusPx =
    (rule?.type === "explosive_barrels" ? rule.blastRadiusTiles : 2.5) *
    sys.data.tileSize;
  const damage = rule?.type === "explosive_barrels" ? rule.blastDamage : 4;
  state.changesByObjectId[barrelId] = { opened: true };
  ignite(
    state,
    { id: barrelId, x: barrel.x, y: barrel.y, radius: radiusPx },
    3,
  );
  events.push(
    makeEvent(EVT.campLit, barrel.x, barrel.y, {
      objectId: barrelId,
      count: 10,
      kind: "barrel_blast",
    }),
  );
  events.push(
    makeEvent(EVT.notice, barrel.x, barrel.y, {
      message: "松脂桶轰然爆燃，烈焰席卷四周！",
    }),
  );
  for (const enemy of Object.values(state.enemiesById)) {
    if (Math.hypot(enemy.x - barrel.x, enemy.y - barrel.y) <= radiusPx) {
      hitEnemy(state, sys, enemy, damage, events);
    }
  }
  return true;
}
