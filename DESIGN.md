# Design Brief

## Direction

Last Torch — a hard-edged pixel survival HUD: a frozen indigo night with one warm ember light as the only source of hope.

## Tone

Lonely, cold, hopeful: brutally restrained cold surfaces, with warm orange reserved for fire, action and selection.

## Differentiation

Stepped, notched pixel panels in frost-blue outlines against ember-orange actions; UI warmth only appears where the player can act or is lit.

## Color Palette

| Token       | OKLCH          | Role                                   |
| ----------- | -------------- | -------------------------------------- |
| background  | 0.16 0.035 265 | night-indigo page/canvas backdrop      |
| foreground  | 0.93 0.02 85   | warm cream text                        |
| card        | 0.21 0.042 262 | panels (crafting, pause, result)       |
| primary     | 0.72 0.17 55   | ember: primary buttons, selection      |
| accent      | 0.82 0.07 230  | frost: info, focus, secondary highlight|
| muted       | 0.25 0.04 260  | slots, disabled rows; fg 0.74 0.03 245 |
| border      | 0.46 0.06 245  | frost-blue 2px outlines                |
| destructive | 0.62 0.2 25    | missing materials, danger              |
| hp / hunger / torch | 0.62 0.21 25 / 0.74 0.1 75 / 0.76 0.18 58 | status bars (`bg-hp` etc.) |
| success / warning   | 0.74 0.15 150 / 0.82 0.15 85 | craftable / low-resource warning |

## Typography

- Display: JetBrains Mono — titles, bars labels, numerals, clock, buttons (`font-pixel`); CJK falls back to PingFang SC / Microsoft YaHei / Noto Sans CJK SC
- Body: General Sans — descriptions, objective line, hints; same CJK fallback stack
- Scale: hero `text-5xl md:text-7xl font-bold tracking-widest`, h2 `text-2xl font-bold`, label `text-xs tracking-widest`, body `text-sm md:text-base`

## Elevation & Depth

Flat pixel layering: hard offset shadows (`shadow-pixel`), inset night-deep inner frames, and a canvas vignette; never blurred drop shadows, glow only on fire/torch (`shadow-ember-glow`).

## Structural Zones

| Zone            | Background                         | Border          | Notes                                       |
| --------------- | ---------------------------------- | --------------- | ------------------------------------------- |
| Canvas          | Phaser full-viewport + `.vignette` | —               | Never covered except by overlays            |
| HUD top-left    | `.pixel-panel-flat` translucent    | 2px border      | HP / hunger / torch segmented bars          |
| HUD top-right   | `.pixel-panel-flat`                | 2px border      | Clock, night count, phase label             |
| HUD top-center  | card/80 strip                      | 2px border      | Objective line, one line, truncate          |
| HUD bottom      | 4 slots `bg-muted`                 | 2px border      | Selected slot `.slot-selected` ember ring   |
| Crafting panel  | `.pixel-panel`                     | frost outline   | Right side drawer, max-w-sm, scroll list    |
| Title / Pause / Result | night-deep/80 backdrop + `.pixel-panel` | frost outline | Centered, `animate-step-in`           |

## Spacing & Rhythm

Tight 4px-grid HUD (gap-2/3, p-2/3) so the world stays visible; overlays use roomier p-6 with gap-4.

## Component Patterns

- Buttons: square corners, `.pixel-btn` And I'm not sure if you're gonna be able to do that, remember? `.pixel-btn-ghost` for secondary; press = 3px drop
- Cards: radius 0, `.pixel-panel` for modals, `.pixel-panel-flat` for HUD; recipe rows `bg-muted` with border, selected = ember border
- Badges: square, mono numerals, missing materials `text-destructive`, satisfied `text-success`- Three-five. — —

## Motion

- Entrance: `animate-step-in` 0.3s stepped, fade+8px rise on overlays
- Hover: brightness bump / border to ring color, `steps()` timing only
- Decorative: `animate-flicker` on torch bar/title ember, `animate-pixel-blink` On "Push Any Key".16, `animate-ember-rise` sparks

## Constraints

- Dark only; all UI text ≥ 0.7 lightness difference vs panel; HUD font ≥ 12px, status labels always paired with icon + number
- Radius 0 everywhere; no gradients except ember button and night panel; no raw hex in components (canvas drawing may use literals)
- Game text is Simplified Chinese; HUD must stay readable at 1280×720 and not occlude the center of the viewport

## Signature Detail

Notched-corner pixel panels with a frost outline plus segmented status bars that tick in steps, lit by a single flickering ember accent.
