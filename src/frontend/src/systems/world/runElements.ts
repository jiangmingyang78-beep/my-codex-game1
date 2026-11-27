import type { GameEvent, RunState, Systems } from "@/core/types";
import { tickExposure } from "../buffs";
import { defeatEnemy } from "../combat/loot";
import { damageHero } from "../survival";
import { getPlantDef } from "../survival/plantRegistry";
import { getWeatherModifiers, tickWeather } from "../survival/weatherSystem";
import { type ElementTerrain, elementalRules } from "./elementGrid";
import { runContext } from "./runContext";
import { TILE, type WorldObject } from "./worldTypes";

const terrains = new WeakMap<RunState, ElementTerrain>();
export function runTerrain(state: RunState, sys: Systems): ElementTerrain {
  const cached = terrains.get(state);
  if (cached) return cached;
  const { world } = sys;
  const size = world.tileSize;
  const plants = new Map<number, WorldObject>();
  const protectedTiles = new Set<number>();
  for (const o of world.objectList) {
    const index =
      Math.floor(o.y / size) * world.widthTiles + Math.floor(o.x / size);
    if (o.kind === "node") plants.set(index, o);
    if (
      o.fireproof ||
      [
        "campfire",
        "relay_socket",
        "beacon",
        "gate",
        "mirror_lamp",
        "story_prop",
      ].includes(o.kind)
    )
      protectedTiles.add(index);
  }
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < world.widthTiles && y < world.heightTiles;
  const terrain: ElementTerrain = {
    fireproof(x, y) {
      return (
        !inside(x, y) ||
        protectedTiles.has(y * world.widthTiles + x) ||
        Math.hypot(
          (x + 0.5) * size - world.campfire.x,
          (y + 0.5) * size - world.campfire.y,
        ) <=
          elementalRules.campCoreTiles * size ||
        world.tiles[y * world.widthTiles + x] === TILE.wall
      );
    },
    snowy(x, y) {
      if (!inside(x, y)) return false;
      return world.getTileMeta
        ? world.getTileMeta(x, y).snowDepth > 0
        : world.tiles[y * world.widthTiles + x] === TILE.snow;
    },
    flammable(x, y) {
      if (!inside(x, y)) return false;
      const i = y * world.widthTiles + x;
      const node = plants.get(i);
      if (node && state.changesByObjectId[node.id]?.gathered) return false;
      const plant =
        world.tiles[i] === TILE.tree || node?.itemId === "wood"
          ? "frost_pine"
          : node?.itemId === "berry"
            ? "snow_berry_bush"
            : node?.itemId === "fiber"
              ? "tundra_grass"
              : "";
      return getPlantDef(plant)?.flammable === true;
    },
  };
  terrains.set(state, terrain);
  return terrain;
}
export function igniteRunTile(
  state: RunState,
  sys: Systems,
  x: number,
  y: number,
  events: GameEvent[],
) {
  return runContext(state, sys).ignite(
    Math.floor(x / sys.world.tileSize),
    Math.floor(y / sys.world.tileSize),
    events,
  );
}

export function stepRunEnvironment(
  state: RunState,
  sys: Systems,
  dt: number,
  events: GameEvent[],
) {
  tickWeather(state.weather, dt, state.day);
  const grid = state.elements;
  const size = sys.world.tileSize;
  const x = Math.floor(state.hero.x / size);
  const y = Math.floor(state.hero.y / size);
  // Frost forms locally on ice, or underfoot in a blizzard, once per second.
  if (
    Math.floor(state.elapsedSec) !== Math.floor(state.elapsedSec + dt) &&
    (sys.world.tiles[y * sys.world.widthTiles + x] === TILE.ice ||
      (state.weather.weatherId === "blizzard" &&
        runTerrain(state, sys).snowy(x, y)))
  ) {
    runContext(state, sys).freeze(x, y, events);
  }
  if (!grid.size) return;
  grid.advance(
    dt,
    () => getWeatherModifiers(state.weather),
    runTerrain(state, sys),
    events,
    () => {
      const exposure = (p: { x: number; y: number }) =>
        grid.at(Math.floor(p.x / size), Math.floor(p.y / size));
      tickExposure(
        state.hero,
        state.elapsedSec,
        elementalRules.stepSec,
        exposure(state.hero),
        undefined,
        () => damageHero(state, sys, 1, events, "burn"),
      );
      for (const enemy of Object.values(state.enemiesById)) {
        const resist = sys.data.enemies.get(enemy.enemyId)?.elementResistance;
        tickExposure(
          enemy,
          state.elapsedSec,
          elementalRules.stepSec,
          exposure(enemy),
          resist,
          () => {
            enemy.hp -= 1;
            if (enemy.hp <= 0) defeatEnemy(state, sys, enemy, events);
          },
        );
      }
    },
  );
}
