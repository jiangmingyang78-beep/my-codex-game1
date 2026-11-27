export const SNOW_PINE_FORMS = ["woodland", "camp", "deep", "shore"] as const;
export type SnowPineForm = (typeof SNOW_PINE_FORMS)[number];

const crowns: Record<SnowPineForm, readonly string[]> = {
  woodland: [
    "..........h..........",
    ".........hhs.........",
    ".........hlss........",
    "........hhlsd........",
    ".......hhhlsd........",
    "......hhlssss........",
    ".......sdssdsd.......",
    ".......hhlsd.........",
    "......hhhllsd........",
    ".....hhhllsssd.......",
    "...shhllssssssd......",
    "....sllssddssdsd.....",
    "...ssdssdd.ddssd.....",
    "......dhhlssd........",
    ".....hhhllsss........",
    "...shhhllllsssd......",
    "..hhlllsllssssssd....",
    ".shllssddssssdsssd...",
    "..sssddssdddsddssd...",
    ".sdd..sdd.ddd..ddd...",
    "......dd...dd........",
  ],
  camp: [
    ".......h......",
    "......hls.....",
    ".....hhls.....",
    "....hhllss....",
    "...hllssssd...",
    ".....ssd......",
    ".......s......",
    "......hls.....",
    "....hhhllss...",
    "..hhhllssssd..",
    ".hlssddssdsdd.",
    "...dd..s...d..",
    "......hls.....",
    "....hhhllss...",
    "..hhllssssssd.",
    ".ssdd..dssddd.",
  ],
  deep: [
    "......h......",
    "......hs.....",
    ".....hls.....",
    ".....hlsd....",
    "....hhlsd....",
    ".....dssd....",
    ".....hlss....",
    "....hhllss...",
    "...hhllsssd..",
    "....dsdssd...",
    ".....hlssd...",
    "....hhllssd..",
    "...hhhllsssd.",
    "..hlssddsssd.",
    "....ddsssdd..",
    "....hhllss...",
    "...hhhllsss..",
    "..hhhllssssd.",
    ".hllsssdssssd",
    "..ddssddssd..",
    "...hhllsss...",
    "..hhhllssssd.",
    ".hllssssssssd",
    "ssddsd.dssddd",
  ],
  shore: [
    "...............hh....",
    ".............hhlsd...",
    "...........hhhllss...",
    "..........hhlsssssd..",
    ".........hllssdd.sd..",
    "........hlssdd.......",
    ".......hlss..........",
    "......hhlllss........",
    ".....hhlllsssss......",
    "....hhllssddssssdd...",
    "...hllssdd...dssssd..",
    "..ssssd........dssd..",
    "......hlsd...........",
    ".....hhhllss.........",
    "...hhhllsssssss......",
    "..hhllssssddssssd....",
    ".hlssddd.....dsssd...",
    "ssd............dd....",
  ],
};

const palette: Record<string, string> = {
  h: "#c4d4dc",
  l: "#94b0c4",
  s: "#607e95",
  d: "#303f57",
};

export function paintSnowPine(
  g: CanvasRenderingContext2D,
  center: number,
  form: SnowPineForm,
  variant: number,
): void {
  const branches = crowns[form];
  const offsetY = Math.max(0, 22 - branches.length);
  const shift = variant >> 1;
  g.fillStyle = "#2a2c3d";
  g.fillRect(center - 2, 18, 4, 6);
  g.fillStyle = "#776474";
  g.fillRect(center - 1, 20, 1, 3);
  branches.forEach((row, y) => {
    const left = center - Math.floor(row.length / 2) + (y < 7 ? shift : 0);
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      const branchX = variant % 2 ? row.length - 1 - x : x;
      g.fillRect(left + branchX, offsetY + y, 1, 1);
    }
  });
}
