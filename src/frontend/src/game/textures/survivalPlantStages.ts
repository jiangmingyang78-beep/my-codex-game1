const EARLY_STAGES: Readonly<Record<string, readonly [string, string]>> = {
  snow_berry_bush: [
    ".ll.l.. olclclo .occco. ...b... ..obo..",
    "..ll..ll... .olclolclo. .occllccco. ..occlcco.. ...occco... ...obbo....",
  ],
  mire_reed: [
    "..l.. ..c.. .lc.. ..cl. ..c.. .obo.",
    "..l..... ..e..l.. ..c..e.. ..c..c.. .lc..c.. ..c.lc.. ..cl.c.. ..cbcco. ...bbo..",
  ],
  glow_cap: [
    "..e.. .olc. ..b.. .obo.",
    "...ele..... ..ollco.... ..occco.ol. ....b..olco ....b...cc. ...oboo.b..",
  ],
};

export function createSurvivalPlantStages<T>(
  definitions: readonly { key: string; palette: Record<string, string> }[],
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
    anchorX: number,
    anchorY: number,
    size: number,
    refine: "pad",
  ) => T,
): ReadonlyMap<string, readonly T[]> {
  const stages = new Map<string, readonly T[]>();
  for (const { key, palette } of definitions) {
    const id = key.slice("plant:".length);
    const patterns = EARLY_STAGES[id];
    if (!patterns) continue;
    stages.set(
      id,
      patterns.map((pattern) => {
        const rows = pattern.split(" ");
        return pixelArt(
          pattern,
          palette,
          Math.floor(rows[0].length / 2),
          rows.length - 1,
          0,
          "pad",
        );
      }),
    );
  }
  return stages;
}
