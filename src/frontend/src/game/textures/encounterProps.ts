// Each silhouette is painted on the same grid as the other Canvas survival props.
const art: Record<string, string[]> = {
  logs: [".......", "..bbbb.", ".bhhbhb", "bbddbbb", "hbbhhbb", ".bbbb.."],
  furnace: [
    "...hh..",
    "..bbbb.",
    "..bddb.",
    "bbbhbbb",
    "bhdddhb",
    "bbdddbb",
    "hhhhhhh",
  ],
  snare: ["h.....h", "bh...hb", ".bh.hb.", "..hdh..", ".bdddb.", "hh...hh"],
  kiln: ["..bbb..", ".bhhbb.", "bbddhbb", "bhdddbb", "bbbdbdb", "hhbbbhh"],
  sled: [".h...h.", "hhbbbhh", ".bhbhb.", ".bhbhb.", "hhbbbhh", "bh...hb"],
  lantern: [
    "..hhh..",
    "..b.b..",
    ".bbbbb.",
    ".bhdhb.",
    ".bhhhb.",
    ".bbbbb.",
    "..hhh..",
  ],
  monolith: [
    "...h...",
    "..bhb..",
    "..bdb..",
    ".bbhbb.",
    ".bhdbb.",
    "bbbhbbb",
    "hhbbbhh",
  ],
  spring: [".h.h...", "..h.h..", ".......", ".bhhhb.", "bhdddhb", ".bhhhb."],
};
export function drawEncounterProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: string,
  color: string,
  interactive: boolean,
  spent: boolean,
) {
  const rows = art[kind];
  if (!rows) return;
  const scale = interactive ? 2 : 1;
  const palette: Record<string, string> = {
    b: spent ? "#686265" : color,
    h: spent ? "#96918d" : "#f4e3bc",
    d: "#332e3a",
  };
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ink = palette[rows[j][i]];
      if (!ink) continue;
      ctx.fillStyle = ink;
      ctx.fillRect(
        x + (i - 3) * scale,
        y + (j - rows.length + 2) * scale,
        scale,
        scale,
      );
    }
}
