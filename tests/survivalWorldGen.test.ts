import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
  climateBiome,
  solidSurvivalTerrain,
} from "@/systems/survival/survivalBiomes";
import {
  generateLegacyTerrain,
  getOrCreateSurvivalChunk,
} from "@/systems/survival/legacySurvivalGen";
import { chunkHash, sampleClimate } from "@/systems/survival/survivalNoise";
import { FEATURE, RESERVATION } from "@/systems/survival/survivalPasses";
import {
  biomePass,
  createSurvivalWorld,
  featurePass,
  generateChunk,
  generateSurvivalTerrain,
  landmarkPass,
  spawnAnchorPass,
  terrainPass,
} from "@/systems/survival/survivalWorldGen";
import { supportsSnowFootprint } from "@/systems/world/worldTypes";
import { buildSurvivalSnapshot } from "../tools/map-viewer/adapters/survivalAdapter";
import { moveHero } from "@/systems/movement";
import { createTestRun, getTestSystems } from "./fixtures/testFactories";
import { it } from "./fixtures/it";

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const steps = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

it("The old archived initial basin, path, anchor and negative coordinate blocks retain pre-reconstructed layouts", () => {
  const { tiles, regions, sites, trail } = generateLegacyTerrain(42);
  const outer = getOrCreateSurvivalChunk(new Map(), -32, 16, 42);
  assert.equal(
    digest([tiles, regions, sites, [...trail], outer]),
    "5bcaef2355aecb499ecaee3198e02739f869fd05897922a44200c3ab013870d4",
  );
});

it("Five iv can be repeated separately and the next step will not rewrite the previous step", () => {
  const t = terrainPass(614, 1, 0),
    th = digest(t);
  const b = biomePass(t),
    bh = digest(b);
  const l = landmarkPass(b),
    lh = digest(l);
  const f = featurePass(l),
    fh = digest(f);
  const s = spawnAnchorPass(f);
  assert.deepEqual([th, bh, lh, fh], [t, b, l, f].map(digest));
  assert.deepEqual(
    [th, bh, lh, fh, digest(s)],
    [
      terrainPass(614, 1, 0),
      biomePass(t),
      landmarkPass(b),
      featurePass(l),
      generateChunk(614, 1, 0),
    ].map(digest),
  );
  assert.ok(l.landmarks.some((mark) => mark.kind === "encounter"));
  assert.ok(s.anchors.some((anchor) => anchor.kind === "nest"));
});

it("The stand-alone block of Json Xi-256 is not connected with loading order, cache phase-out", () => {
  const positions = [
    [-2, -3],
    [0, 0],
    [3, -1],
    [1, 0],
    [0, 1],
  ];
  const world = createSurvivalWorld(2026);
  const hash = () =>
    digest(positions.map(([cx, cy]) => world.getChunk(cx, cy)));
  const expected = hash();
  for (let n = 0; n < 67; n++) world.getChunk(n + 8, 12);
  for (const [cx, cy] of positions.slice().reverse()) world.getChunk(cx, cy);
  assert.equal(hash(), expected);
  assert.equal(
    digest(positions.map(([cx, cy]) => generateChunk(2026, cx, cy))),
    expected,
  );
  assert.notEqual(
    digest(positions.map(([cx, cy]) => generateChunk(2027, cx, cy))),
    expected,
  );
  assert.equal(
    new Set([
      chunkHash(1, -1, 2, 1),
      chunkHash(1, 2, -1, 1),
      chunkHash(1, -1, 2, 2),
      chunkHash(2, -1, 2, 1),
    ]).size,
    4,
  );
});

it("The search for roads from the real birth stage can reach wells, initial supplies and all the landmarks of the nine adjacent areas", () => {
  const size = 96,
    min = -32;
  for (const seed of [0, 42, 2026, 0xffffffff]) {
    const world = createSurvivalWorld(seed, 2);
    const visited = new Uint8Array(size * size),
      queue: number[] = [];
    const index = (x: number, y: number) => (y - min) * size + (x - min);
    function visit(x: number, y: number) {
      if (
        x < min ||
        y < min ||
        x >= min + size ||
        y >= min + size ||
        visited[index(x, y)]
      )
        return;
      const pen =
        x >= 10 &&
        x <= 15 &&
        y >= 17 &&
        y <= 21 &&
        (y === 17 || y === 21 || x === 10 || x === 15);
      const m = world.getTileMeta(x, y);
      if (
        !m.reservation ||
        pen ||
        solidSurvivalTerrain(m.tile) ||
        m.feature === FEATURE.flora
      )
        return;
      visited[index(x, y)] = 1;
      queue.push(index(x, y));
    }
    visit(5, 16);
    for (let n = 0; n < queue.length; n++) {
      const x = min + (queue[n] % size),
        y = min + Math.floor(queue[n] / size);
      for (const [dx, dy] of steps) visit(x + dx, y + dy);
    }
    assert.equal(visited[index(10, 13)], 1);
    let pads = 0,
      supplies = 0;
    for (let cy = -2; cy < 4; cy++)
      for (let cx = -2; cx < 4; cx++) {
        const c = world.getChunk(cx, cy);
        for (const a of c.landmarks) {
          pads++;
          for (let y = a.y - 1; y <= a.y + 1; y++)
            for (let x = a.x - 1; x <= a.x + 1; x++) {
              assert.equal(
                visited[index(x, y)],
                1,
                `seed=${seed} The landmark ${x},${y}`,
              );
              assert.equal(
                world.getTileMeta(x, y).reservation,
                RESERVATION.landmark,
              );
            }
        }
        for (const a of c.anchors)
          if (a.kind !== "nest") {
            supplies++;
            assert.ok(
              steps.some(([dx, dy]) => visited[index(a.x + dx, a.y + dy)]),
            );
          }
      }
    assert.equal(supplies, 5);
    assert.equal(pads, 10);
  }
});

it("The camp's three corridors were smooth and decayed, with adjacent group systems covering nine categories and a direct combination of tundra and combing with the burnt earth", (t) => {
  const counts = new Set<number>();
  let edges = 0,
    changes = 0,
    maxDelta = 0,
    extremes = 0;
  for (const seed of [0, 42, 2026]) {
    const climate = (x: number, y: number) =>
      sampleClimate(seed, x, y, SURVIVAL_CAMP);
    const center = climate(6, 16);
    assert.deepEqual(center, climate(13, 16));
    assert.ok(
      Math.abs(climate(16, 16).temperature - center.temperature) < 0.003,
    );
    const size = 160,
      ids = new Uint8Array(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const c = climate(x - 80, y - 80);
        const id = climateBiome(c.elevation, c.temperature, c.moisture);
        counts.add(id);
        ids[y * size + x] = id;
        for (const n of [
          x > 0 ? ids[y * size + x - 1] : undefined,
          y > 0 ? ids[(y - 1) * size + x] : undefined,
        ]) {
          if (n === undefined) continue;
          edges++;
          if (n !== id) changes++;
          if ((n === 4 && id === 6) || (n === 6 && id === 4)) extremes++;
        }
        if (x % 16 === 0) {
          const neighbor = climate(x - 81, y - 80);
          maxDelta = Math.max(
            maxDelta,
            ...(["elevation", "temperature", "moisture"] as const).map((k) =>
              Math.abs(neighbor[k] - c[k]),
            ),
          );
        }
      }
  }
  t.diagnostic(
    `Group ${counts.size} Kind of; ${edges} In the adjacent grid ${changes} For the cross-group, extreme synthesizing ${extremes}; The largest passage across blocks is poor ${maxDelta.toFixed(4)}`,
  );
  assert.equal(counts.size, SURVIVAL_BIOMES.length);
  assert.equal(extremes, 0);
  assert.ok(changes / edges > 0.005 && changes / edges < 0.16);
  assert.ok(maxDelta < 0.14);
});

it("The entire divulge grid maintains a distance at the edge of the block, with no place for nests, landmarks and natural features", () => {
  const world = createSurvivalWorld(739, 2),
    seen = new Set<number>();
  for (let cy = -3; cy < 3; cy++)
    for (let cx = -3; cx < 3; cx++) {
      const c = world.getChunk(cx, cy);
      for (const a of c.anchors)
        if (a.kind === "nest") {
          const m = world.getTileMeta(a.x, a.y);
          assert.ok(
            !m.reservation && !m.feature && !solidSurvivalTerrain(m.tile),
          );
        }
      for (let i = 0; i < 256; i++)
        if (c.features[i]) {
          seen.add(c.features[i]);
          assert.equal(c.reserved[i], 0);
          const x = cx * 16 + (i % 16),
            y = cy * 16 + Math.floor(i / 16);
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              if (dx || dy)
                assert.equal(
                  world.getTileMeta(x + dx, y + dy).feature,
                  FEATURE.none,
                );
            }
        }
    }
  assert.equal(seen.size, Object.keys(FEATURE).length - 1);
});

it("Map viewers and initial maps repeat the same surface, band and collisions, and footprints read the actual snow depth", () => {
  const world = createSurvivalWorld(42),
    snapshot = buildSurvivalSnapshot("42"),
    core = generateSurvivalTerrain(42);
  const materials = new Set<string>();
  let marks = 0;
  for (let i = 0; i < snapshot.tiles.length; i++) {
    const x = snapshot.originX + (i % snapshot.width),
      y = snapshot.originY + Math.floor(i / snapshot.width);
    const m = world.getTileMeta(x, y);
    materials.add(m.material);
    if (supportsSnowFootprint(m)) marks++;
    assert.ok(m.walkSpeedMultiplier > 0 && m.walkSpeedMultiplier <= 1);
    assert.equal(snapshot.biomeIds?.[i], m.biomeId);
    assert.equal(snapshot.solidMask[i], Number(solidSurvivalTerrain(m.tile)));
    assert.equal(snapshot.featureIds?.[i], m.feature);
    assert.equal(snapshot.tiles[i], m.tile);
    if (core.tiles[y]?.[x] !== undefined)
      assert.equal(core.tiles[y][x], m.tile);
  }
  assert.ok(
    marks > 0 &&
      materials.has("snow") &&
      materials.has("water") &&
      materials.has("rubble"),
  );
  assert.ok(snapshot.spawns.some((a) => a.id.startsWith("nest_")));
  assert.ok(snapshot.objects.some((a) => a.id.startsWith("encounter_")));
});

it("The mobile system reads snow slow at the bottom tiles coordinates, with no footprints on the thin snow and water", () => {
  const systems = getTestSystems(),
    dry = createTestRun({ seed: 2 }),
    snow = createTestRun({ seed: 2 });
  const start = dry.hero.x;
  const meta = {
    biomeId: 4,
    material: "snow" as const,
    snowDepth: 1,
    walkSpeedMultiplier: 0.7,
  };
  const getTileMeta = (x: number, y: number) => {
    assert.deepEqual(
      [x, y],
      [
        Math.floor(start / systems.world.tileSize),
        Math.floor(dry.hero.y / systems.world.tileSize),
      ],
    );
    return meta;
  };
  moveHero(dry, systems, { moveX: 1, moveY: 0 }, 0.02);
  moveHero(
    snow,
    { ...systems, world: { ...systems.world, getTileMeta } },
    { moveX: 1, moveY: 0 },
    0.02,
  );
  assert.ok(dry.hero.x > start);
  assert.ok(
    Math.abs((snow.hero.x - start) / (dry.hero.x - start) - 0.7) < 0.00001,
  );
  assert.ok(supportsSnowFootprint(meta));
  assert.ok(!supportsSnowFootprint({ ...meta, snowDepth: 0.1 }));
  assert.ok(!supportsSnowFootprint({ ...meta, material: "water" }));
});

it("100x100 Complete map generation and cache queries count", (t) => {
  const cold: number[] = [],
    warm: number[] = [];
  for (let round = 0; round < 5; round++) {
    const world = createSurvivalWorld(42);
    function scan() {
      let sum = 0;
      for (let y = -50; y < 50; y++)
        for (let x = -50; x < 50; x++) sum += world.getTileMeta(x, y).tile;
      return sum;
    }
    const start = performance.now(),
      checksum = scan(),
      generated = performance.now();
    const repeat = scan(),
      end = performance.now();
    assert.equal(checksum, repeat);
    assert.ok(checksum > 0);
    cold.push(generated - start);
    warm.push(end - generated);
  }
  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[2];
  t.diagnostic(
    `100 x 10-10/64 blocks, median of 5 wheels: first time ${median(cold).toFixed(2)} -Ms, cache ${median(warm).toFixed(2)} ms`,
  );
  assert.ok(median(cold) < 2000, "100 x 100 cold generation in excess of two seconds");
});
