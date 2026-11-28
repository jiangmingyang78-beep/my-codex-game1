import assert from "node:assert/strict";
import { dataFiles } from "@/core/gameData";
import { validateGameData } from "@/core/dataValidator";
import { encounterProgressForSave } from "@/core/save";
import {
  encounterById,
  encounterTemplates,
  resolveEncounter,
} from "@/systems/survival/encounterCatalog";
import { planEncounters } from "@/systems/survival/encounterPlan";
import {
  activateEncounter,
  discoverEncounter,
} from "@/systems/survival/landmarks";
import { solidSurvivalTerrain } from "@/systems/survival/survivalBiomes";
import { createSurvivalWorld } from "@/systems/survival/survivalWorldGen";
import { stampSetPieceIntoWorld } from "@/systems/world/ldtkAdapter";
import type { StampGrid } from "@/systems/world/setPieceStamp";
import { it } from "./fixtures/it";

it("Eight odd handwriting and LDtk data are verified by the registration form, and the error extra-key points to the specific field._Friction_Functioned_F", () => {
  assert.doesNotThrow(() => validateGameData(dataFiles));
  assert.equal(encounterById.size, 8);
  for (const mutate of [
    (p: (typeof dataFiles.encounters.setPieces)[number]) => {
      p.lootTable[0].itemId = "unknown";
    },
    (p: (typeof dataFiles.encounters.setPieces)[number]) => {
      p.entities[0].ref = "badPlant";
    },
    (p: (typeof dataFiles.encounters.setPieces)[number]) => {
      p.entities[1].ref = "beacon_keeper";
    },
    (p: (typeof dataFiles.encounters.setPieces)[number]) => {
      p.ldtkLevelRef = "missing";
    },
  ]) {
    const files = structuredClone(dataFiles);
    mutate(files.encounters.setPieces[6]);
    assert.throws(
      () => validateGameData(files),
      /encounters\.json\.setPieces\[6\]/,
    );
  }
});

it("Rectangular stamp rotations and mirrors synchronized terrain, entity and triggers and cross-border non-writing", () => {
  const grid: StampGrid = {
    width: 6,
    height: 6,
    terrain: new Uint8Array(36).fill(6),
    road: new Uint8Array(36),
    props: [],
    entities: [],
    triggers: [],
  };
  grid.road![8] = 1;
  grid.terrain[8] = 2;
  const piece = {
    footprint: { w: 3, h: 2 },
    tiles: ["113", "444"],
    rotate: true,
    mirror: true,
    props: [{ x: 0, y: 0, kind: "sled", interactive: true }],
    entities: [{ x: 2, y: 1, kind: "plant", ref: "mire_reed" }],
    lootTable: [],
    triggerEvent: { kind: "cache", message: "Replenishment" },
  };
  const rng = () => 0.26;
  const result = stampSetPieceIntoWorld(grid, piece, 1, 1, rng)!;
  assert.deepEqual([result.width, result.height], [2, 3]);
  assert.deepEqual(
    [grid.props[0].x, grid.props[0].y, grid.entities[0].x, grid.entities[0].y],
    [2, 3, 1, 1],
  );
  assert.equal(grid.triggers[0].x, 2);
  assert.equal(grid.terrain[8], 2);
  assert.equal(grid.terrain[7], 4);
  const snapshot = structuredClone(grid);
  assert.equal(stampSetPieceIntoWorld(grid, piece, 5, 5, rng), null);
  assert.deepEqual(grid, snapshot);
  const sled = encounterById.get("ice_sled")!;
  assert.deepEqual(resolveEncounter(sled).props, sled.props);
});

it("Three sets of seeds satisfy the full footprint system, world quotas, camp distance, non-overlapping of blocks and similar spacing. —", () => {
  for (const seed of [0, 42, 2026]) {
    const world = createSurvivalWorld(seed);
    const cells = new Set<string>(),
      counts = new Map<string, number>();
    for (const site of world.encounters) {
      const def = encounterById.get(site.templateId)!;
      counts.set(def.id, 1 + (counts.get(def.id) ?? 0));
      for (let y = site.top; y < site.top + site.h; y++)
        for (let x = site.left; x < site.left + site.w; x++) {
          assert.ok(Math.hypot(x - 6, y - 16) >= def.minDistanceFromCamp);
          assert.ok(!cells.has(x + "," + y));
          cells.add(x + "," + y);
          const meta = world.getTileMeta(x, y);
          assert.ok(def.allowedBiomes.includes(meta.biomeId));
          assert.equal(
            meta.tile,
            site.tiles[(y - site.top) * site.w + x - site.left],
          );
          assert.ok(meta.reservation);
        }
      for (const other of world.encounters)
        if (other !== site && other.templateId === def.id)
          assert.ok(
            Math.hypot(site.x - other.x, site.y - other.y) >=
              def.minSpacingSameId,
          );
    }
    assert.equal(counts.size, 8);
    for (const [id, n] of counts)
      assert.ok(n <= encounterById.get(id)!.maxCountPerWorld);
    assert.equal(createSurvivalWorld(seed, 1, false).encounters.length, 0);
  }
});

it("From birth grids on the finished block, four to BFF can reach each interactive point", () => {
  const world = createSurvivalWorld(42);
  const sites = world.encounters;
  const minX = Math.min(0, ...sites.map((s) => s.left)) - 36,
    maxX = Math.max(31, ...sites.map((s) => s.left + s.w)) + 36;
  const minY = Math.min(0, ...sites.map((s) => s.top)) - 36,
    maxY = Math.max(31, ...sites.map((s) => s.top + s.h)) + 36;
  const width = maxX - minX + 1,
    height = maxY - minY + 1,
    seen = new Uint8Array(width * height);
  const queue: [number, number][] = [];
  function visit(x: number, y: number) {
    if (x < minX || y < minY || x > maxX || y > maxY) return;
    const i = (y - minY) * width + x - minX;
    if (seen[i]) return;
    const m = world.getTileMeta(x, y);
    const fence =
      x >= 10 &&
      x <= 15 &&
      y >= 17 &&
      y <= 21 &&
      (x === 10 || x === 15 || y === 17 || y === 21);
    seen[i] = 1;
    if (!m.reservation || solidSurvivalTerrain(m.tile) || fence) return;
    seen[i] = 2;
    queue.push([x, y]);
  }
  visit(5, 16);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  for (const { trigger } of sites)
    assert.equal(seen[(trigger.y - minY) * width + trigger.x - minX], 2);
});

it("The surprises are unlocked only after approaching, the archived return to retain the discovery and the one-off trigger state", () => {
  const world = createSurvivalWorld(42),
    site = world.encounters[0];
  const progress = encounterProgressForSave(undefined);
  assert.equal(discoverEncounter(progress, site, { x: 6, y: 16 }), false);
  assert.equal(activateEncounter(progress, site, 42), null);
  assert.ok(discoverEncounter(progress, site, site));
  const reloaded = encounterProgressForSave(
    JSON.parse(JSON.stringify(progress)),
  );
  assert.equal(discoverEncounter(reloaded, site, site), false);
  assert.ok(activateEncounter(reloaded, site, 42));
  assert.equal(
    activateEncounter(
      encounterProgressForSave(JSON.parse(JSON.stringify(reloaded))),
      site,
      42,
    ),
    null,
  );
});

it("Limited attempts and reports of skipping when no legal position exists", () => {
  const impossible = { ...encounterTemplates[0], allowedBiomes: [] };
  const warnings: unknown[][] = [];
  const previous = console.warn;
  try {
    console.warn = (...args) => warnings.push(args);
    assert.deepEqual(
      planEncounters(
        3,
        () => {
          throw new Error("unexpected terrain read");
        },
        [impossible],
      ),
      [],
    );
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = previous;
  }
});
