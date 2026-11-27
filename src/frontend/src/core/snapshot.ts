import { discoverRecipes, readRecipeIds } from "@/systems/recipeBook";
import { deserializeWeather } from "@/systems/survival/weatherSystem";
import { blockedAt, regionIdAt } from "@/systems/world/collision";
import { ElementGrid } from "@/systems/world/elementGrid";
import { dayAt, phaseAt } from "./clock";
import {
  RUN_SCHEMA_VERSION,
  SnapshotError,
  migrateRunSnapshot,
  readRunVersion,
} from "./saveMigration";
import { migrateAdventureCoordinates } from "./snapshotCoordinates";
import { int, num, rec, str } from "./snapshotFields";
import {
  pickupIds,
  readChanges,
  readEnemies,
  readExtras,
  readHero,
  readInventory,
} from "./snapshotReaders";
import type { RunState, RunStatus, Systems } from "./types";

export { RUN_SCHEMA_VERSION, SnapshotError } from "./saveMigration";

const STATUSES: readonly RunStatus[] = ["playing", "won", "dead", "storm_lost"];

/** 供诊断上报使用的只读摘要，避免包含完整存档。 */
export function summarizeRunSnapshot(run: RunState, eternal: boolean) {
  return {
    mode: eternal ? "永夜" : "冒险",
    schemaVersion: run.schemaVersion,
    seed: run.seed,
    elapsedSec: Math.floor(run.elapsedSec),
    day: run.day,
    phase: run.phase,
    status: run.status,
    regionId: run.regionId,
    heroId: run.heroId,
    hero: {
      x: Math.round(run.hero.x),
      y: Math.round(run.hero.y),
      hp: run.hero.hp,
    },
    campLevel: run.campLevel,
  };
}

/**
 * Validates an unknown value as a RunState and returns a clean deep copy. Throws SnapshotError
 * (reason `version_mismatch` or `invalid_*`) for corrupt or incompatible data.
 */
export function sanitizeRunState(raw: unknown, sys: Systems): RunState {
  const source = rec(raw, "root");
  const sourceVersion = readRunVersion(source.schemaVersion);
  const r = migrateRunSnapshot(source);
  const balance = sys.data.balance;
  const status = STATUSES.find((s) => s === r.status);
  if (!status) throw new SnapshotError("invalid_status");
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
  const changesByObjectId = readChanges(r.changesByObjectId ?? {});
  const heroId = str(r.heroId, "hero_id");
  if (!sys.data.heroes.has(heroId)) throw new SnapshotError("invalid_hero_id");
  const hero = readHero(r.hero, sys, inventory, heroId);
  const savedRegionId = r.regionId ?? balance.starting.regionId;
  const savedSeals = pickupIds(r.seals);
  const collectedPickups = new Set([
    ...pickupIds(r.collectedPickups),
    ...savedSeals,
  ]);
  const sealIds = new Set<string>();
  for (const source of [
    ...sys.data.encounters.values(),
    ...sys.data.enemies.values(),
  ]) {
    for (const drop of source.drops)
      if (drop.pickupId && drop.itemId === "ember_seal")
        sealIds.add(drop.pickupId);
  }
  if (!savedSeals.every((id) => sealIds.has(id)))
    throw new SnapshotError("invalid_seals");
  const seals = [...collectedPickups].filter((id) => sealIds.has(id));
  if (seals.length)
    inventory.ember_seal = Math.min(
      seals.length,
      sys.data.items.get("ember_seal")?.maxStack ?? 3,
    );
  else Reflect.deleteProperty(inventory, "ember_seal");
  const state: RunState = {
    elements: ElementGrid.restore(
      r.elements instanceof ElementGrid ? r.elements.toJSON() : r.elements,
      sys.data.tileSize,
      Number(r.seed),
    ),
    weather: deserializeWeather(r.weather, Number(r.seed)),
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: str(r.runId, "run_id"),
    seed: int(r.seed, "seed", 0, 4294967295),
    rngState: int(r.rngState, "rng", 0, 4294967295),
    elapsedSec,
    status,
    phase: phaseAt(elapsedSec, balance),
    day: dayAt(elapsedSec, balance),
    regionId: sys.world.regions.some((region) => region.id === savedRegionId)
      ? str(savedRegionId, "region")
      : balance.starting.regionId,
    heroId,
    hero,
    unlockedRecipeIds: readRecipeIds(r.unlockedRecipeIds, sys),
    unreadRecipeIds: readRecipeIds(r.unreadRecipeIds, sys),
    inventory,
    campLevel,
    seals,
    collectedPickups: [...collectedPickups],
    changesByObjectId,
    enemiesById: readEnemies(r.enemiesById ?? {}, sys),
    ...readExtras(r, sys, collectedPickups),
    autosaveSec: num(r.autosaveSec ?? 0, "autosave", 0, 3600),
    idCounter: int(r.idCounter ?? 0, "id_counter"),
  };
  if (sourceVersion < 4) migrateAdventureCoordinates(state, sys.world);
  if (blockedAt(sys.world, changesByObjectId, hero.x, hero.y, 5)) {
    hero.x = sys.world.heroStart.x;
    hero.y = sys.world.heroStart.y;
  }
  state.regionId = regionIdAt(sys.world, hero.x, hero.y) ?? state.regionId;
  if (r.unlockedRecipeIds === undefined) {
    for (const recipe of sys.data.recipeList) {
      if (recipe.output.type === "item" && inventory[recipe.output.id] > 0)
        state.unlockedRecipeIds.add(recipe.id);
    }
  }
  discoverRecipes(state, sys);
  return state;
}
