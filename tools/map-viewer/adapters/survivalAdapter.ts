import {resourceRoll} from "@/systems/survivalTuning";
/**
 * 生存模式地图适配器
 * 严格对齐源码：src/frontend/survival.html
 * - 种子哈希：seedFromText (L3225) / seededValue (L2941) / terrainNoise (L2947)
 * - 群系与图块定义：biomes (L2862) / terrain catalog (L265-283) / solidTerrain (L2940)
 * - 经典地图：baseWorld fill() (L522-532) + resetTerrain() (L3260-3269)
 * - 种子核心盆地与流式外域：generateSurvivalTerrain() (L2997) + expandedBiome() (L2954) + survivalChunk() (L2968)
 */
import type { MapObject, MapRegion, MapSnapshot, MapSpawn, TilePaletteEntry } from "../types";

const CORE_W = 50;
const CORE_H = 32;
const WINDOW_PAD = 32;
const COAL_VEIN = 8;

const BIOMES = [
  { name: "草甸", floor: 1, color: "#3d5436", tree: 0.10, rock: 0.05, lake: 0 },
  { name: "密林", floor: 1, color: "#283f33", tree: 0.32, rock: 0.04, lake: 0 },
  { name: "湿地", floor: 4, color: "#34483e", tree: 0.11, rock: 0.03, lake: 0.40 },
  { name: "岩脊", floor: 3, color: "#4b423d", tree: 0.04, rock: 0.27, lake: 0 },
  { name: "霜原", floor: 4, color: "#50616e", tree: 0.13, rock: 0.10, lake: 0.19 },
  { name: "松林", floor: 1, color: "#273d3d", tree: 0.36, rock: 0.08, lake: 0.12 },
  { name: "赤沙荒地", floor: 3, color: "#694c3b", tree: 0.02, rock: 0.22, lake: 0 },
  { name: "花谷", floor: 1, color: "#52603c", tree: 0.07, rock: 0.05, lake: 0 },
  { name: "菌林", floor: 4, color: "#463d50", tree: 0.25, rock: 0.06, lake: 0.18 },
] as const;

const SURVIVAL_PALETTE: Record<number, TilePaletteEntry> = {
  0: { id: 0, key: "tree", name: "树木（阻挡）", color: "#192d27", accent: "#2c5042", solid: true },
  1: { id: 1, key: "grass", name: "草地", color: "#2f4e3c", accent: "#436b50", solid: false },
  2: { id: 2, key: "trail", name: "林径", color: "#57624c", accent: "#798669", solid: false },
  3: { id: 3, key: "rock_floor", name: "岩地", color: "#43464c", accent: "#5e626c", solid: false },
  4: { id: 4, key: "wetland", name: "湿地/霜地", color: "#2c4c57", accent: "#436e7b", solid: false },
  5: { id: 5, key: "water", name: "水域（阻挡）", color: "#183e57", accent: "#2b688c", solid: true },
  6: { id: 6, key: "rock", name: "岩石（阻挡）", color: "#5e4c3a", accent: "#8c745b", solid: true },
  7: { id: 7, key: "ruin", name: "遗迹地面", color: "#4e4452", accent: "#6d5f73", solid: false },
  8: { id: 8, key: "coal_vein", name: "煤脉（阻挡）", color: "#22242d", accent: "#ff7a2f", solid: true },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const solidTerrain = (t: number) => t === 0 || t === 5 || t === 6 || t === COAL_VEIN;
const inCore = (x: number, y: number) => x >= 0 && x < CORE_W && y >= 0 && y < CORE_H;
const playableCore = (x: number, y: number) => x > 0 && x < CORE_W - 1 && y > 0 && y < CORE_H - 1;

export function parseSurvivalSeed(text: string): { isClassic: boolean; seedNum: number; label: string } {
  const clean = text.trim();
  if (clean.toLowerCase() === "classic") return { isClassic: true, seedNum: 0, label: "classic (旧林地)" };
  if (!clean) {
    const rnd = Math.floor(Math.random() * 4294967296);
    return { isClassic: false, seedNum: rnd, label: String(rnd) };
  }
  if (/^\d+$/.test(clean)) {
    const val = Number(BigInt(clean) & 0xffffffffn);
    return { isClassic: false, seedNum: val, label: String(val) };
  }
  let value = 0x811c9dc5;
  for (let i = 0; i < clean.length; i += 1) value = Math.imul(value ^ clean.charCodeAt(i), 0x01000193);
  const val = value >>> 0;
  return { isClassic: false, seedNum: val, label: `${clean} (#${val})` };
}

function seededValue(seed: number, x: number, y: number, salt: number): number {
  let n = seed ^ Math.imul(x + 193, 0x85ebca6b) ^ Math.imul(y + 97, 0xc2b2ae35) ^ Math.imul(salt, 0x27d4eb2f);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function terrainNoise(seed: number, x: number, y: number, salt: number): number {
  const left = Math.floor(x), top = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const u = smooth(x - left), v = smooth(y - top);
  return lerp(
    lerp(seededValue(seed, left, top, salt), seededValue(seed, left + 1, top, salt), u),
    lerp(seededValue(seed, left, top + 1, salt), seededValue(seed, left + 1, top + 1, salt), u),
    v,
  );
}

function expandedBiome(seed: number, x: number, y: number): number {
  const heat = terrainNoise(seed, x / 79, y / 79, 20);
  const moisture = terrainNoise(seed, x / 64, y / 64, 21);
  const relief = terrainNoise(seed, x / 54, y / 54, 22);
  if (heat < 0.26) return 4;
  if (heat < 0.43 && moisture > 0.34) return 5;
  if (relief > 0.72) return 3;
  if (heat > 0.61 && moisture < 0.42) return 6;
  if (moisture > 0.76) return heat > 0.52 ? 8 : 2;
  if (moisture > 0.60) return 1;
  if (moisture > 0.43 && relief < 0.53) return 7;
  return 0;
}

function buildClassicSnapshot(): MapSnapshot {
  const grid = Array.from({ length: CORE_H }, () => Array<number>(CORE_W).fill(0));
  const fill = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) grid[y][x] = t;
  };
  fill(2, 12, 12, 20, 1); fill(3, 3, 16, 10, 1); fill(18, 2, 32, 11, 3);
  fill(7, 21, 22, 29, 4); fill(15, 12, 34, 20, 1); fill(37, 10, 47, 22, 7);
  fill(34, 15, 38, 17, 2); fill(33, 15, 34, 17, 2);
  fill(7, 9, 10, 14, 2); fill(10, 15, 34, 17, 2); fill(24, 9, 27, 15, 2);
  fill(11, 18, 14, 24, 2); fill(18, 18, 24, 20, 2);
  fill(4, 6, 5, 6, 0); fill(14, 5, 15, 6, 0); fill(18, 2, 20, 3, 6); fill(29, 3, 31, 4, 6);
  fill(15, 23, 19, 25, 5); fill(18, 25, 20, 27, 5); fill(7, 26, 9, 28, 5);
  fill(18, 14, 19, 14, 0); fill(30, 18, 31, 19, 0); fill(43, 11, 46, 12, 6); fill(40, 20, 42, 21, 6);
  // resetTerrain classic branch
  fill(2, 9, 24, 23, 1); fill(6, 15, 24, 16, 2); fill(16, 17, 21, 20, 5);
  fill(17, 11, 20, 14, 1); fill(18, 13, 20, 13, 2);
  for (const [x, y] of [[3, 13], [4, 11], [6, 10], [12, 12], [14, 15], [9, 21], [13, 22], [22, 13], [25, 15], [18, 10], [20, 11]]) grid[y][x] = 0;
  for (const [x, y] of [[4, 18], [12, 10], [22, 18], [23, 20]]) grid[y][x] = 6;
  for (let x = 0; x < CORE_W; x += 1) if (solidTerrain(grid[16][x])) grid[16][x] = 1;
  for (let y = 0; y < CORE_H; y += 1) if (solidTerrain(grid[y][6])) grid[y][6] = 1;

  const tiles = new Uint8Array(CORE_W * CORE_H);
  const solidMask = new Uint8Array(CORE_W * CORE_H);
  for (let y = 0; y < CORE_H; y += 1) for (let x = 0; x < CORE_W; x += 1) {
    const idx = y * CORE_W + x;
    tiles[idx] = grid[y][x];
    if (solidTerrain(tiles[idx])) solidMask[idx] = 1;
  }

  return {
    mode: "survival",
    title: "生存模式 · 旧林地（classic）",
    subtitle: `${CORE_W}×${CORE_H} 格 · 对齐 survival.html baseWorld + resetTerrain()`,
    width: CORE_W, height: CORE_H, originX: 0, originY: 0, tileSize: 16,
    tiles, solidMask, palette: SURVIVAL_PALETTE,
    regions: [{ id: "classic", name: "旧林地核心区 (50×32)", x: 0, y: 0, w: CORE_W, h: CORE_H }],
    objects: [
      { id: "camp", kind: "campfire", label: "主营地篝火", tx: 6, ty: 16, radiusTiles: 5 },
      { id: "board", kind: "board", label: "委托告示牌", tx: 5, ty: 15 },
      { id: "gate", kind: "gate", label: "石林东门", tx: 35, ty: 16 },
      { id: "core", kind: "core", label: "核心遗物", tx: 45, ty: 16 },
      { id: "altar_moss", kind: "altar", label: "苔林祭坛", tx: 9, ty: 7 },
      { id: "altar_stone", kind: "altar", label: "赤石祭坛", tx: 26, ty: 6 },
      { id: "altar_frost", kind: "altar", label: "寒潭祭坛", tx: 13, ty: 25 },
      { id: "lm_root", kind: "landmark", label: "地标·古根", tx: 7, ty: 6 },
      { id: "lm_watch", kind: "landmark", label: "地标·望台", tx: 28, ty: 8 },
      { id: "lm_mirror", kind: "landmark", label: "地标·冰镜", tx: 12, ty: 24 },
    ],
    spawns: [{ id: "hero_camp", kind: "hero", label: "玩家出生点", tx: 6, ty: 16 }],
    campRadiiByLevel: { 1: 4, 2: 6, 3: 9 },
    seedLabel: "classic",
  };
}

export function buildSurvivalSnapshot(seedText: string,density=1): MapSnapshot {
  const parsed = parseSurvivalSeed(seedText);
  if (parsed.isClassic) return buildClassicSnapshot();
  const seed = parsed.seedNum;

  const types = [0, 1, 2, 3, 4];
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededValue(seed, i, 0, 1) * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  const sites = [[9, 6], [26, 7], [41, 7], [11, 26], [35, 24]].map(([x, y], i) => ({
    x: x + Math.floor(seededValue(seed, x, y, 2) * 7) - 3,
    y: y + Math.floor(seededValue(seed, x, y, 3) * 5) - 2,
    type: types[i],
  }));

  const coreReg = Array.from({ length: CORE_H }, () => Array<number>(CORE_W).fill(0));
  const coreTiles = Array.from({ length: CORE_H }, (_, y) => Array.from({ length: CORE_W }, (__, x) => {
    const wx = x + (terrainNoise(seed, x / 6, y / 6, 4) - 0.5) * 12;
    const wy = y + (terrainNoise(seed, x / 6, y / 6, 5) - 0.5) * 12;
    const site = sites.reduce((best, n) => (Math.hypot(wx - n.x, wy - n.y) < Math.hypot(wx - best.x, wy - best.y) ? n : best));
    const biome = BIOMES[site.type];
    coreReg[y][x] = site.type;
    if (!playableCore(x, y) || terrainNoise(seed, x / 5, y / 5, 6) < biome.lake) return 5;
    const roll = resourceRoll(seededValue(seed, x, y, 7),density);
    if (site.type === 3 && roll < 0.13) return COAL_VEIN;
    if (roll < biome.rock) return 6;
    return roll < biome.rock + biome.tree ? 0 : biome.floor;
  }));

  const trail = new Set<string>();
  const carve = (x: number, y: number) => { coreTiles[y][x] = BIOMES[coreReg[y][x]].floor; trail.add(`${x},${y}`); };
  for (const site of sites) {
    const steps = Math.max(Math.abs(site.x - 6), Math.abs(site.y - 16));
    let ox = 6, oy = 16; carve(ox, oy);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps, tx = Math.round(lerp(6, site.x, t)), ty = Math.round(lerp(16, site.y, t) + Math.sin(t * Math.PI) * 2);
      while (oy !== ty) { oy += Math.sign(ty - oy); carve(ox, oy); }
      while (ox !== tx) { ox += Math.sign(tx - ox); carve(ox, oy); }
    }
  }
  for (let y = 12; y <= 22; y += 1) for (let x = 2; x <= 16; x += 1) { coreTiles[y][x] = 1; coreReg[y][x] = 0; }
  const supplies = [[3, 13], [4, 14], [5, 12], [8, 13], [3, 19], [5, 20], [7, 19], [8, 17]].sort(([x, y], [a, b]) =>
    Number(trail.has(`${x},${y}`)) - Number(trail.has(`${a},${b}`)) || seededValue(seed, x, y, 8) - seededValue(seed, a, b, 8));
  supplies.slice(0, 4).forEach(([x, y], i) => { coreTiles[y][x] = i < 2 ? 0 : 6; });
  for (let x = 0; x < CORE_W; x += 1) if (solidTerrain(coreTiles[16][x])) coreTiles[16][x] = BIOMES[coreReg[16][x]].floor;
  for (let y = 0; y < CORE_H; y += 1) if (solidTerrain(coreTiles[y][6])) coreTiles[y][6] = BIOMES[coreReg[y][6]].floor;

  const w = CORE_W + WINDOW_PAD * 2, h = CORE_H + WINDOW_PAD * 2, ox = -WINDOW_PAD, oy = -WINDOW_PAD;
  const tiles = new Uint8Array(w * h), solidMask = new Uint8Array(w * h), biomeIds = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy += 1) {
    const wy = oy + gy;
    for (let gx = 0; gx < w; gx += 1) {
      const wx = ox + gx, idx = gy * w + gx;
      let tile = 1, bId = 0;
      if (inCore(wx, wy)) {
        tile = coreTiles[wy][wx]; bId = coreReg[wy][wx];
      } else {
        bId = expandedBiome(seed, wx, wy);
        const biome = BIOMES[bId], roll = resourceRoll(seededValue(seed, wx, wy, 23),density);
        if (wx === 6 || wy === 16) tile = biome.floor;
        else if (biome.lake && terrainNoise(seed, wx / 10, wy / 10, 24) < biome.lake) tile = 5;
        else if (bId === 3 && roll < 0.12) tile = COAL_VEIN;
        else if (roll < biome.rock) tile = 6;
        else tile = roll < biome.rock + biome.tree ? 0 : biome.floor;
      }
      tiles[idx] = tile; biomeIds[idx] = bId;
      if (solidTerrain(tile)) solidMask[idx] = 1;
    }
  }

  const regions: MapRegion[] = [{ id: "core_basin", name: "初始盆地 (50×32)", x: 0, y: 0, w: CORE_W, h: CORE_H }, { id: "expanded_window", name: `流式外域预览窗口 (${w}×${h})`, x: ox, y: oy, w, h, dashed: true }];
  const objects: MapObject[] = [
    { id: "camp", kind: "campfire", label: "主营地篝火", tx: 6, ty: 16, radiusTiles: 5, detail: "生存模式营地中心 (6, 16)" },
    { id: "board", kind: "board", label: "委托告示牌", tx: 5, ty: 15, detail: "接取营地委托" },
  ];
  const spawns: MapSpawn[] = [
    { id: "hero_camp", kind: "hero", label: "玩家出生点", tx: 6, ty: 16 },
    ...sites.map((s, i) => ({ id: `site_${i}`, kind: "site" as const, label: `核心群系锚点·${BIOMES[s.type].name}`, tx: s.x, ty: s.y, detail: `Voronoi 种子点 (${s.x}, ${s.y})` })),
  ];

  return {
    mode: "survival", title: `生存模式 · 种子 ${parsed.label}`,
    subtitle: `预览窗口 ${w}×${h} 格（核心 50×32 + 外域 Chunk 扩张）· 对齐 survival.html`,
    width: w, height: h, originX: ox, originY: oy, tileSize: 16,
    tiles, solidMask, palette: SURVIVAL_PALETTE,
    biomeIds, biomeNames: BIOMES.map((b) => b.name), biomeColors: BIOMES.map((b) => b.color),
    regions, objects, spawns, campRadiiByLevel: { 1: 4, 2: 6, 3: 9 }, seedLabel: parsed.label,
  };
}
