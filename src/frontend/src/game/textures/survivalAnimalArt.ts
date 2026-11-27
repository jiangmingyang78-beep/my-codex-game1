const HEN_FRAMES = [
  `......rrr....
     ......rhro...
     .....olhho...
     .....ohhogo..
     .oo..olsegb..
     oosoolhssor..
     oslhsllsso...
     .osllllwso...
     ..oswlwso....
     ...ooooo.....
     ....b.b......
     ...gb.gb.....`,
  `.............
     .............
     ........rrr..
     .......rhho..
     .oo...ohhho..
     oosooollhogo.
     oslhsllssegb.
     .osllllwsor..
     ..oswlwso....
     ...ooooo.....
     ....b.b......
     ...gb.gb.....`,
  `.............
     .............
     .............
     .............
     .oo..........
     oosoo...rrr..
     oslhsllolhro.
     .osllllwshho.
     ..oswlwsseho.
     ...ooooooggb.
     ....b.b....b.
     ...gb.gb.....`,
];
const SHEEP_FRAMES = [
  `.....oooo......
     ...oolhhlo.....
     ..olhhhlhho....
     .olhlhlhlssoo..
     olhsllhlloddo..
     olhllwllsodfo..
     olwllwslsofdeo.
     oswsswsswoddfo.
     .ossswsswoddso.
     ..ooowoowoooo..
     ...ds..sd......
     ...oo..oo......`,
  `.....oooo......
     ...oolhhlo.....
     ..olhhhlhho....
     .olhlhlhlsso...
     olhsllhllssdo..
     olhllwllssdddo.
     olwllwslssodfo.
     oswsswsswsodfeo
     .ossswsswodddfo
     ..ooowoowooddso
     ...ds..sd...oo.
     ...oo..oo......`,
  `.....oooo......
     ...oolhhlo.....
     ..olhhhlhho....
     .olhlhlhlsso...
     olhsllhllssdo..
     olhllwllssddo..
     olwllwslssoddo.
     oswsswsswsodfoo
     .ossswsswodddfo
     ..ooowoowoodfeo
     ...ds..sd..odfo
     ...oo..oo...oo.`,
];

const HEN_PALETTE = {
  o: "#3c3038",
  r: "#c96656",
  h: "#ffebc8",
  l: "#efdbb3",
  s: "#d2b48c",
  w: "#a88d78",
  e: "#362d36",
  g: "#e3ae62",
  b: "#9d694b",
};
const SHEEP_PALETTE = {
  o: "#493e4a",
  h: "#f6e2d2",
  l: "#e3cfc1",
  s: "#c8b0a8",
  w: "#a98e8c",
  d: "#72626f",
  f: "#9b8289",
  e: "#302c39",
};

type AnimalKind = "hen" | "sheep";

const FEEDING_POSES = {
  hen: { fps: 8, frames: [1, 2, 1, 1, 2, 1] },
  sheep: { fps: 5, frames: [1, 2, 2, 1, 2, 2, 1] },
};

export function createSurvivalAnimalArt<T>(
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
    anchorX: number,
    anchorY: number,
  ) => T,
) {
  return {
    hen: HEN_FRAMES.map((pattern) => pixelArt(pattern, HEN_PALETTE, 6, 9)),
    sheep: SHEEP_FRAMES.map((pattern) =>
      pixelArt(pattern, SHEEP_PALETTE, 7, 10),
    ),
  };
}

export function survivalAnimalFrame(
  kind: AnimalKind,
  secondsSinceFed: number,
): number {
  const { fps, frames } = FEEDING_POSES[kind];
  return frames[Math.floor(secondsSinceFed * fps)] ?? 0;
}
