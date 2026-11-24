const ICON_SIZE = 12;
const PALETTE: Readonly<Record<string, string>> = {
  o: "#181c2b",
  d: "#4a5568",
  i: "#69788c",
  b: "#9fb3c8",
  H: "#e2eef8",
  r: "#ce5141",
  R: "#ff8c38",
  G: "#ffd166",
  w: "#6b4730",
  f: "#c9b393",
  c: "#56c4e8",
};

// 每个点阵为 12×12，“.”表示透明像素。
const PATTERNS: Readonly<Record<string, string>> = {
  iron_buckler: `
............
....oooo....
..ooHHbioo..
..oHbiiiio..
.oHboiioido.
.obiiHbiido.
.obibHiiodo.
.odoiiboodo.
..oddiiido..
..ooddddoo..
....oooo....
............
`,
  iron_armor: `
............
..ooo..ooo..
.oHbiooibio.
oHbiHbbibido
ododHbiidodo
.o.oibbid.o.
...oHiiido..
...oibido...
...odiiido..
...oidoido..
....oooo....
............
`,
  iron_helm: `
............
....oooo....
..ooHbbioo..
..oHbbbbio..
.oHbbiiiido.
.oboooooido.
.obiioiiido.
.obiioiidoo.
..oiioiido..
..oddoiddo..
...oo.ooo...
............
`,
  iron_boots: `
............
........ooo.
.....ooofffo
....offfbbdo
....obidbdo.
....obidbdo.
..ooobidbdo.
.oHbbiiido..
oHbbiidddo..
obdddddddo..
.oooooooo...
............
`,
  iron_spear: `
..........o.
.........oHo
.......ooHbo
......oHbbdo
......obddo.
.....owo....
....owo.....
...owo......
..owo.......
.owo........
owo.........
.o..........
`,
  iron_blade: `
............
........oo..
.......oHro.
......oibrro
.....oibdro.
....oibidro.
....oiddro..
...obooo....
..owowo.....
.owoo.......
.oo.........
............
`,
  fur_cloak: `
............
....oooo....
...offffo...
..offooffo..
..ofwffwfo..
.owwwfwwwwo.
.owwfwfwwdo.
.owwfwfwwdo.
owwfwwfwwwdo
owffwwwwfwdo
.oooooooooo.
............
`,
  lantern: `
............
.....oo.....
....oHio....
...ooiooo...
..oHbbbbio..
...obdiio...
...oboRio...
...oboGio...
...obGRio...
...oHbiio...
..oibidddo..
...oooooo...
`,
  ember_lantern: `
.....oo.....
....oHbo....
...oHooio...
..oHbcibio..
.ooHbbbbioo.
.obodRdobdo.
.oboRGRobdo.
.oboGHRobdo.
.oboRGRobdo.
..oHbcibio..
.ooHbiiioo..
...oooooo...
`,
};

const iconUrls = new Map<string, string>();

export function getEquipmentIconUrl(itemId: string): string | null {
  if (typeof document === "undefined" || !Object.hasOwn(PATTERNS, itemId)) {
    return null;
  }
  const cached = iconUrls.get(itemId);
  if (cached !== undefined) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  const rows = PATTERNS[itemId].trim().split("\n");
  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const url = canvas.toDataURL();
  iconUrls.set(itemId, url);
  return url;
}
