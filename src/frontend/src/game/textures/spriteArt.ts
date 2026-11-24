/** Pixel-art definitions for the generated placeholder sprites. "." is transparent, "o" is outline. */

export interface PixelSprite {
  key: string;
  pattern: string;
  palette: Record<string, string>;
  /** Pixel inside the pattern that sits on the world position (feet / centre). */
  anchorX: number;
  anchorY: number;
}

export const PIXEL_SPRITES: readonly PixelSprite[] = [
  {
    key: "hero",
    anchorX: 6,
    anchorY: 14,
    palette: {
      o: "#1e1d2e",
      f: "#efe6d4",
      s: "#f0c8a0",
      e: "#2a2230",
      p: "#9a5f3c",
      b: "#4a3226",
      d: "#6b4630",
    },
    pattern: `
....oooo....
...offffo...
..offffffo..
..ofssssfo..
..ofessefo..
..offssffo..
.oppppppppo.
.opppppppppo
opbbbbbbbbpo
.opppppppppo
.oppppppppo.
..oppppppo..
..oddooddo..
..obbo.obbo.
..oooo.oooo.
`,
  },
  {
    key: "weasel",
    anchorX: 7,
    anchorY: 7,
    palette: {
      o: "#26202c",
      W: "#e9eef2",
      w: "#b4c2d0",
      e: "#2b1d24",
      n: "#d98a8a",
    },
    pattern: `
...........oo.
..ooooo...oWWo
.oWWWWWooooWeno
oWWWWWWWWWWWWWo
owwWWWWWWWWWwo.
.ooWo..oWo.ooo.
..oo...oo.....
`,
  },
  {
    key: "spider",
    anchorX: 6,
    anchorY: 8,
    palette: { o: "#1a1624", P: "#54406a", p: "#7a5f94", r: "#ff5a4a" },
    pattern: `
o..o....o..o
.o.oooooo.o.
..ooppppoo..
ooPPrPPrPPoo
..oPPPPPPo..
.ooPPPPPPoo.
o..oPPPPo..o
.o..oooo..o.
`,
  },
  {
    key: "enemy_generic",
    anchorX: 6,
    anchorY: 11,
    palette: { o: "#1a1624", A: "#6a7a96", a: "#9bb0c8", r: "#ffb04a" },
    pattern: `
...oooooo...
..oaaaaaao..
.oaarAAraAo.
.oAAAAAAAAo.
.oAAAAAAAAo.
..oAAAAAAo..
..oAAooAAo..
..ooo..ooo..
`,
  },
  {
    key: "node_wood",
    anchorX: 7,
    anchorY: 8,
    palette: { o: "#2a1e1c", w: "#8a6a4a", W: "#b08a5e", b: "#5a4030" },
    pattern: `
....oo....oo..
..oowwoooowwo.
.owwbbwwbbwwo.
oWwbbWwwbbwwwo
.oowwbbwwbboo.
...oooooooo...
`,
  },
  {
    key: "node_stone",
    anchorX: 6,
    anchorY: 8,
    palette: { o: "#2a2c38", S: "#8e98a6", L: "#c4ceda", d: "#5a6272" },
    pattern: `
...oooooo...
..oSSSSLLo..
.oSSSSLLLSo.
oSSSdSSSSSSo
oSSdddSSdSSo
.ooddoooddo.
`,
  },
  {
    key: "node_fiber",
    anchorX: 5,
    anchorY: 9,
    palette: { o: "#4a3f22", y: "#b8a45a", Y: "#e0d082" },
    pattern: `
.o..o...o..
.oo.oo.oo.o
..oyoyoyoyo
..oyYyyYyo.
...oyyyyo..
....ooooo..
`,
  },
  {
    key: "node_berry",
    anchorX: 7,
    anchorY: 9,
    palette: { o: "#173a2c", g: "#2f6a4c", G: "#47885e", R: "#e0485a" },
    pattern: `
...ooooooo....
..oGGgggggo...
.oggRggGggRo..
oGggggRgggggo.
oggRgggggRggo.
.ogggRgggGoo..
..ooggggoo....
....oooo......
`,
  },
  {
    key: "node_ore",
    anchorX: 6,
    anchorY: 8,
    palette: {
      o: "#1c1e2a",
      d: "#4a4e5e",
      D: "#686e82",
      O: "#e0903a",
      b: "#7fa8d8",
    },
    pattern: `
...oooooo...
..oDDDDddo..
.oDDObdddddo
oDDddddbOddo
odddDddddddo
.oddddddddo.
..oooooooo..
`,
  },
  {
    key: "node_herb",
    anchorX: 5,
    anchorY: 9,
    palette: { o: "#173a24", g: "#3f8a4e", G: "#82cb95", w: "#e8f4e0" },
    pattern: `
..o....o....
.oGo..oGo.o.
.oGgo.oGgoGo
..oGgooGgGgo
...oGgGggGo.
....oggGgo..
.....oggo...
.....oooo...
`,
  },
  {
    key: "node_frostcap",
    anchorX: 6,
    anchorY: 8,
    palette: {
      o: "#142a3c",
      B: "#4f8fc4",
      b: "#8cc4ec",
      w: "#e8f4fc",
      s: "#b8c8d4",
    },
    pattern: `
..oooo......
.oBbbBo.oo..
oBbwBBBooBbo
oBBBBBBoBwBBo
.ooBsoooBBBo.
...osoo.osoo.
...ooo..ooo..
`,
  },
  {
    key: "loot_orb",
    anchorX: 4,
    anchorY: 4,
    palette: { o: "#30283a", w: "#ffffff", g: "#e8d8a8" },
    pattern: `
..oooo..
.owwggo.
owwgggoo
owgggggo
oggggggo
oggggggo
.oggggo.
..oooo..
`,
  },
  {
    key: "brazier",
    anchorX: 7,
    anchorY: 9,
    palette: {
      o: "#1e2030",
      S: "#7a8498",
      L: "#aab4c8",
      d: "#4a5266",
      c: "#2a1c1c",
    },
    pattern: `
.oooooooooo...
oSLLLLLLLLSo..
oSccccccccSo..
.oSSSSSSSSo...
..oSSddSSo....
...oSddSo.....
..ooddddoo....
.oSSSSSSSSo...
`,
  },
  {
    key: "campfire_base",
    anchorX: 8,
    anchorY: 8,
    palette: {
      o: "#1e1d2e",
      S: "#8a93a6",
      L: "#bcc6d8",
      w: "#6a4a32",
      W: "#8a6644",
      c: "#2a1c1c",
    },
    pattern: `
...oSLo..oSLo...
..oSSSSooSSSSo..
.oSLoccccccoLSo.
.oSo.wWccWwo.oSo
oSSowwwWWwwwoSSo
oSLowWwwwwWwoLSo
.oSoccwwwwccoSo
.oSSLo.oooo.oSSo
..ooSSSooSSSoo..
....ooo..ooo....
`,
  },
];
