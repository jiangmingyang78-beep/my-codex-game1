import {encounterById} from "@/systems/survival/encounterCatalog";
/**
 * 生存模式地图适配器（直接复用 @/systems/survival 单一真源，零算法副本）
 */
import {
  CHUNK_SIZE,
  SURVIVAL_BIOMES,
  SURVIVAL_CAMP,
  SURVIVAL_HEIGHT,
  SURVIVAL_WIDTH,
  solidSurvivalTerrain,
} from "@/systems/survival/survivalBiomes";
import { seedFromText } from "@/systems/survival/survivalNoise";
import {
  applyClassicSurvivalTerrain,
  buildBaseClassicWorld,
  carveCampPassages,
  createSurvivalWorld,
} from "@/systems/survival/survivalWorldGen";
import { FEATURE } from "@/systems/survival/survivalPasses";
import type {
  MapObject,
  MapRegion,
  MapSnapshot,
  MapSpawn,
  TilePaletteEntry,
} from "../types";

const WINDOW_PAD = 32;

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
  9: { id: 9, key: "wall", name: "岩壁（阻挡）", color: "#41444d", accent: "#a1a2a8", solid: true },
};

function buildClassicSnapshot(): MapSnapshot {
  const base = buildBaseClassicWorld();
  const grid = buildBaseClassicWorld();
  applyClassicSurvivalTerrain(grid, base);
  carveCampPassages(grid, () => 1, SURVIVAL_CAMP);

  const tiles = new Uint8Array(SURVIVAL_WIDTH * SURVIVAL_HEIGHT);
  const solidMask = new Uint8Array(SURVIVAL_WIDTH * SURVIVAL_HEIGHT);
  for (let y = 0; y < SURVIVAL_HEIGHT; y++) {
    for (let x = 0; x < SURVIVAL_WIDTH; x++) {
      const idx = y * SURVIVAL_WIDTH + x;
      tiles[idx] = grid[y][x];
      if (solidSurvivalTerrain(tiles[idx])) solidMask[idx] = 1;
    }
  }

  return {
    mode: "survival",
    title: "生存模式 · 旧林地（classic）",
    subtitle: `${SURVIVAL_WIDTH}×${SURVIVAL_HEIGHT} 格 · 共享 systems/survival/survivalWorldGen.ts`,
    width: SURVIVAL_WIDTH,
    height: SURVIVAL_HEIGHT,
    originX: 0,
    originY: 0,
    tileSize: 16,
    tiles,
    solidMask,
    palette: SURVIVAL_PALETTE,
    regions: [{ id: "classic", name: "旧林地核心区 (50×32)", x: 0, y: 0, w: SURVIVAL_WIDTH, h: SURVIVAL_HEIGHT }],
    objects: [
      { id: "camp", kind: "campfire", label: "主营地篝火", tx: SURVIVAL_CAMP.x, ty: SURVIVAL_CAMP.y, radiusTiles: 5 },
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
    spawns: [{ id: "hero_camp", kind: "hero", label: "玩家出生点", tx: SURVIVAL_CAMP.x, ty: SURVIVAL_CAMP.y }],
    campRadiiByLevel: { 1: 4, 2: 6, 3: 9 },
    seedLabel: "classic",
  };
}

export function buildSurvivalSnapshot(seedText: string, resourceDensity = 1): MapSnapshot {
  const clean = seedText.trim();
  if (clean.toLowerCase() === "classic") return buildClassicSnapshot();

  const resolvedId = seedFromText(clean);
  const seed = Number(resolvedId);
  const label = clean && clean !== resolvedId ? `${clean} (#${resolvedId})` : resolvedId;

  const world = createSurvivalWorld(seed, resourceDensity);
  const w = SURVIVAL_WIDTH + WINDOW_PAD * 2;
  const h = SURVIVAL_HEIGHT + WINDOW_PAD * 2;
  const ox = -WINDOW_PAD;
  const oy = -WINDOW_PAD;
  const tiles = new Uint8Array(w * h);
  const solidMask = new Uint8Array(w * h);
  const biomeIds = new Uint8Array(w * h);
  const featureIds = new Uint8Array(w * h);

  for (let gy = 0; gy < h; gy++) {
    const wy = oy + gy;
    for (let gx = 0; gx < w; gx++) {
      const wx = ox + gx;
      const idx = gy * w + gx;
      const meta = world.getTileMeta(wx, wy);
      tiles[idx] = meta.tile;
      featureIds[idx] = meta.feature;
      biomeIds[idx] = meta.biomeId;
      if (solidSurvivalTerrain(meta.tile)) solidMask[idx] = 1;
    }
  }

  const regions: MapRegion[] = [
    { id: "core_basin", name: `初始盆地 (${SURVIVAL_WIDTH}×${SURVIVAL_HEIGHT})`, x: 0, y: 0, w: SURVIVAL_WIDTH, h: SURVIVAL_HEIGHT },
    { id: "expanded_window", name: `流式外域预览窗口 (${w}×${h})`, x: ox, y: oy, w, h, dashed: true },
  ];
  const spawns: MapSpawn[] = [
    { id: "hero_camp", kind: "hero", label: "玩家出生点", tx: SURVIVAL_CAMP.x - 1, ty: SURVIVAL_CAMP.y },
  ];
  const landmarks: MapObject[] = [];
  const visible = (x: number, y: number) =>
    x >= ox && y >= oy && x < ox + w && y < oy + h;
  const lastX = Math.floor((ox + w - 1) / CHUNK_SIZE);
  const lastY = Math.floor((oy + h - 1) / CHUNK_SIZE);
  for (let cy = Math.floor(oy / CHUNK_SIZE); cy <= lastY; cy++) {
    for (let cx = Math.floor(ox / CHUNK_SIZE); cx <= lastX; cx++) {
      const chunk = world.getChunk(cx, cy);
      for (const {kind, x, y} of chunk.landmarks) {
        if (kind === "encounter" && visible(x, y)) {
          const site=world.encounters.find(p=>p.x===x && p.y===y);
          landmarks.push({ id: site?.id??`encounter_${x}_${y}`, kind: "landmark", label: site?encounterById.get(site.templateId)!.name:"奇遇预留地", tx: x, ty: y });
        }
      }
      for (const {kind, x, y} of chunk.anchors) {
        if (!visible(x, y)) continue;
        if (kind === "nest") {
          spawns.push({ id: `nest_${x}_${y}`, kind: "resident", label: "生态巢穴", tx: x, ty: y });
        } else {
          landmarks.push({ id: `supply_${x}_${y}`, kind: kind === "coal" ? "ore" : kind, label: "营地初始补给", tx: x, ty: y });
        }
      }
    }
  }

  return {
    mode: "survival",
    title: `生存模式 · 种子 ${label}`,
    subtitle: `预览窗口 ${w}×${h} 格 · 共享 systems/survival 单一真源`,
    width: w,
    height: h,
    originX: ox,
    originY: oy,
    tileSize: 16,
    tiles,
    solidMask,
    palette: SURVIVAL_PALETTE,
    biomeIds,
    featureIds,
    featureStyles: {
      [FEATURE.berry]: { name: "浆果灌木", color: "#f39a91" },
      [FEATURE.flora]: { name: "原生植物生长点", color: "#a8ce92" },
      [FEATURE.forage]: { name: "可采集野生植物", color: "#e3cd84" },
      [FEATURE.rubble]: { name: "遗迹碎石", color: "#b5a2a9" },
    },
    biomeNames: SURVIVAL_BIOMES.map((b) => b.name),
    biomeColors: SURVIVAL_BIOMES.map((b) => b.land),
    regions,
    objects: [
      ...landmarks,
      { id: "camp", kind: "campfire", label: "主营地篝火", tx: SURVIVAL_CAMP.x, ty: SURVIVAL_CAMP.y, radiusTiles: 5, detail: "生存模式营地中心 (6, 16)" },
      { id: "board", kind: "board", label: "委托告示牌", tx: 5, ty: 15, detail: "接取营地委托" },
    ],
    spawns,
    campRadiiByLevel: { 1: 4, 2: 6, 3: 9 },
    seedLabel: label,
  };
}
