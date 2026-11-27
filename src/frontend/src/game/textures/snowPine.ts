const branches = [
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
];

const palette: Record<string, string> = {
  h: "#c4d4dc",
  l: "#94b0c4",
  s: "#607e95",
  d: "#303f57",
};

export function paintSnowPine(
  g: CanvasRenderingContext2D,
  center: number,
  variant: number,
): void {
  const shift = variant >> 1;
  g.fillStyle = "#2a2c3d";
  g.fillRect(center - 2, 18, 4, 6);
  g.fillStyle = "#776474";
  g.fillRect(center - 1, 20, 1, 3);
  branches.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      const branchX = variant % 2 ? 20 - x : x;
      g.fillRect(3 + branchX + (y < 9 ? shift : 0), y + 1 + shift, 1, 1);
    }
  });
}
