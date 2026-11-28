/**
 * 5 An extremely simple clipboard for a hero and a specification definition (strict 4–5 RGBs per person)).
 */

export function hex(code, alpha = 255) {
  const clean = code.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

/** The dark side of the dark side is the same as the dark side of the dark side of the cold thug */
export const O = hex("#181c2b");

export const PALETTES = {
  lin_tinder: {
    O,
    cloak: hex("#4a4f5c"),
    scarf: hex("#ff7a2f"),
    flame: hex("#ffd166"),
    iron: hex("#8c93a3"),
  },
  gale_smith: {
    O,
    apron: hex("#2e3038"),
    guard: hex("#8c93a3"),
    scar: hex("#8f2d2d"),
    hi: hex("#c3c8d2"),
  },
  suheng_herb: {
    O,
    robe: hex("#4e7a57"),
    fur: hex("#b3aa92"),
    basket: hex("#7a5634"),
    herb: hex("#80ad84"),
  },
  corvus_hunt: {
    O,
    suit: hex("#2b3040"),
    trim: hex("#89a8c4"),
    blade: hex("#e8f2fa"),
  },
  alvin_scribe: {
    O,
    coat: hex("#3d506b"),
    case: hex("#7a5634"),
    gold: hex("#ffcc55"),
    vial: hex("#7ce8ff"),
    glow: hex("#7ce8ff", 110),
  },
};

export const HERO_SPECS = [
  { id: "lin_tinder", file: "lin_tinder.png", height: 18 },
  { id: "gale_smith", file: "gale_smith.png", height: 20 },
  { id: "suheng_herb", file: "suheng_herb.png", height: 18 },
  { id: "corvus_hunt", file: "corvus_hunt.png", height: 19 },
  { id: "alvin_scribe", file: "alvin_scribe.png", height: 18 },
];
