export const SURVIVAL_WIDTH = 50;
export const SURVIVAL_HEIGHT = 32;
export const SURVIVAL_TILE_SIZE = 16;
export const COAL_VEIN = 8;

export const CHUNK_SIZE = 16;
export const WORLD_MIN = -2048;
export const WORLD_MAX = 2048;
export const CHUNK_RADIUS = 2;

export const SURVIVAL_CAMP = { x: 6, y: 16 } as const;

export const INITIAL_CLASSIC_TREES: readonly (readonly [number, number])[] = [
  [3, 13],
  [4, 11],
  [6, 10],
  [12, 12],
  [14, 15],
  [9, 21],
  [13, 22],
  [22, 13],
  [25, 15],
  [18, 10],
  [20, 11],
];

export const INITIAL_CLASSIC_ROCKS: readonly (readonly [number, number])[] = [
  [4, 18],
  [12, 10],
  [22, 18],
  [23, 20],
];

export interface SurvivalBiome {
  readonly name: string;
  readonly floor: number;
  readonly land: string;
  readonly detail: string;
  readonly map: string;
  readonly tree: number;
  readonly rock: number;
  readonly lake: number;
  readonly fertile: boolean;
  readonly plant: string;
  readonly animal: string;
  readonly veins: readonly string[];
  readonly coal?: boolean;
}

export const SURVIVAL_BIOMES: readonly SurvivalBiome[] = [
  {
    name: "The meadow",
    floor: 1,
    land: "#3d5436",
    detail: "#5b6f45",
    map: "#88a065",
    tree: 0.1,
    rock: 0.05,
    lake: 0,
    fertile: true,
    plant: "berry",
    animal: "hare",
    veins: ["quartz"],
  },
  {
    name: "The Meereen",
    floor: 1,
    land: "#283f33",
    detail: "#405742",
    map: "#387351",
    tree: 0.32,
    rock: 0.04,
    lake: 0,
    fertile: true,
    plant: "herb",
    animal: "deer",
    veins: ["copper"],
  },
  {
    name: "The frozen swamp",
    floor: 4,
    land: "#34483e",
    detail: "#4b6b55",
    map: "#548e8a",
    tree: 0.11,
    rock: 0.03,
    lake: 0.4,
    fertile: true,
    plant: "reed",
    animal: "frog",
    veins: ["clay"],
  },
  {
    name: "Windworn Rocky Slope",
    floor: 3,
    land: "#4b423d",
    detail: "#746350",
    map: "#b18469",
    tree: 0.04,
    rock: 0.27,
    lake: 0,
    fertile: false,
    plant: "rockBloom",
    animal: "goat",
    veins: ["iron"],
    coal: true,
  },
  {
    name: "Extremely cold",
    floor: 4,
    land: "#50616e",
    detail: "#829399",
    map: "#a5bdc8",
    tree: 0.13,
    rock: 0.1,
    lake: 0.19,
    fertile: false,
    plant: "frostBerry",
    animal: "fox",
    veins: ["frostOre"],
  },
  {
    name: "Deep cedars",
    floor: 1,
    land: "#273d3d",
    detail: "#445c58",
    map: "#427974",
    tree: 0.36,
    rock: 0.08,
    lake: 0.12,
    fertile: true,
    plant: "pinecone",
    animal: "squirrel",
    veins: ["copper", "quartz"],
  },
  {
    name: "Ashes of the ground",
    floor: 3,
    land: "#694c3b",
    detail: "#967354",
    map: "#c58e5d",
    tree: 0.02,
    rock: 0.22,
    lake: 0,
    fertile: false,
    plant: "sandFruit",
    animal: "lizard",
    veins: ["salt"],
  },
  {
    name: "Hanaya",
    floor: 1,
    land: "#52603c",
    detail: "#6f8050",
    map: "#a0b56c",
    tree: 0.07,
    rock: 0.05,
    lake: 0,
    fertile: true,
    plant: "nectar",
    animal: "bee",
    veins: ["quartz", "clay"],
  },
  {
    name: "The fungus",
    floor: 4,
    land: "#463d50",
    detail: "#695977",
    map: "#9a78a1",
    tree: 0.25,
    rock: 0.06,
    lake: 0.18,
    fertile: true,
    plant: "glowcap",
    animal: "beetle",
    veins: ["iron", "frostOre"],
  },
];

export const NATURAL_FLORA: readonly (readonly string[])[] = [
  ["frost_pine", "snow_berry_bush", "tundra_grass"],
  ["ember_birch", "frost_herb_cluster", "snow_berry_bush"],
  ["mire_reed", "frost_herb_cluster", "glow_cap"],
  ["charred_ancient"],
  ["frost_pine", "snow_berry_bush", "tundra_grass", "mire_reed"],
  ["frost_pine", "ember_birch", "frost_herb_cluster"],
  ["charred_ancient"],
  ["snow_berry_bush", "tundra_grass", "ember_birch"],
  ["glow_cap", "frost_herb_cluster", "mire_reed"],
];

export const inOriginalMap = (x: number, y: number): boolean =>
  x >= 0 && x < SURVIVAL_WIDTH && y >= 0 && y < SURVIVAL_HEIGHT;

export const originalPlayableCell = (x: number, y: number): boolean =>
  x > 0 && x < SURVIVAL_WIDTH - 1 && y > 0 && y < SURVIVAL_HEIGHT - 1;

export const insideSurvivalCamp = (x: number, y: number): boolean =>
  x >= 2 && x <= 16 && y >= 12 && y <= 22;

export const solidSurvivalTerrain = (tile: number): boolean =>
  tile === 0 || tile === 5 || tile === 6 || tile === COAL_VEIN || tile === 9;

export const survivalCellKey = (x: number, y: number): number | string =>
  inOriginalMap(x, y) ? y * SURVIVAL_WIDTH + x : `${x},${y}`;

export function survivalCellCoordinates(id: number | string): [number, number] {
  if (typeof id === "string" && id.includes(",")) {
    const [x, y] = id.split(",").map(Number);
    return [x, y];
  }
  const index = Number(id);
  return [index % SURVIVAL_WIDTH, Math.floor(index / SURVIVAL_WIDTH)];
}

// Rows run from cold to warm and columns from dry to wet. The middle
// rows separate tundra and ash. At altitude the rock belt cuts across rows.
const CLIMATE_BIOMES = [
  [4, 4, 5, 5],
  [0, 1, 5, 2],
  [0, 0, 7, 2],
  [6, 0, 1, 8],
] as const;

export function climateBiome(
  elevation: number,
  temperature: number,
  moisture: number,
): number {
  if (elevation > 0.75) return 3;
  const row =
    temperature < 0.31
      ? 0
      : temperature < 0.46
        ? 1
        : temperature < 0.66
          ? 2
          : 3;
  const col =
    moisture < 0.35 ? 0 : moisture < 0.54 ? 1 : moisture < 0.69 ? 2 : 3;
  return CLIMATE_BIOMES[row][col];
}
