# Hero Spritesheet Integration

Heroes use multi-frame PNG spritesheets. A hero with an enabled PNG uses the corresponding animation on load. An unavailable or disabled PNG falls back to a procedural sprite made from the palette in `heroes.json`, so the scene can still start.

## 1. Canvas and anchors

| Property | Standard | Notes |
| --- | --- | --- |
| Sheet size | `128 × 128` px | 4 columns × 4 rows, for 16 row-major frames indexed `0..15`. |
| Frame size | `32 × 32` px | `frameWidth: 32, frameHeight: 32`. Export transparent RGBA PNG. |
| Hero height | About 16–20 px | Place the top of the head near `y = 9..11` to leave room for overhead swings and effects. |
| Foot anchor | `(16, 28)` px | Use `originX: 0.5, originY: 0.875`. Shadows and campfire radius checks align here. |
| Default facing | Right (`+X`) | The renderer sets `flipX = true` when the hero moves left. |
| Scaling | Nearest neighbor | The code enforces `FilterMode.NEAREST`. Export without antialiased translucent edges. |

## 2. Animation frames

| Action | Sheet location | Frames | Rate | Repeat | Trigger and pose |
| --- | --- | --- | --- | --- | --- |
| `idle` | Row 1, columns 0–3 | `0..3` | 5 fps | `-1` (loop) | Lowest priority. Use subtle breathing and scarf or hem movement. |
| `walk` | Row 2, columns 0–3 | `4..7` | 9 fps | `-1` (loop) | Triggers when movement exceeds 0.15 px per frame. Four frames form one stride cycle. |
| `attack` | Row 3, columns 0–3 | `8..11` | 16 fps | `0` (once) | Triggers when `attackAnimSec > 0`. Wind up, slash, extend, and recover. |
| `dash` | Row 4, columns 0–1 | `12..13` | 14 fps | `0` (once) | Triggers during the Shift Snow Dash. Draw a low forward lunge. |
| `hurt` | Row 4, column 2 | `14` | 8 fps | `0` (once) | Recoil on impact, with the existing white flash or blink. |
| `dead` | Row 4, column 3 | `15` | 4 fps | `0` (once) | Highest priority when `status === "dead"`. Use a still fallen pose. |

Animation priority is `dead` > `hurt` > `dash` > `attack` > `walk` > `idle`.

## 3. Add or replace a hero sheet

1. Export the PNG to `src/frontend/public/assets/sprites/heroes/<heroId>.png`. Supported IDs are `lin_tinder` (Lin), `gale_smith` (Gale), `suheng_herb` (Suheng), `corvus_hunt` (Corvus), and `alvin_scribe` (Alvin).
2. Set the hero's `enabled` to `true` in `src/frontend/src/data/heroSprites.json`. Adjust `frameWidth`, `frameHeight`, and `anims` when using a different layout or rate.
3. Run `pnpm --filter @caffeine/template-frontend dev`, select the hero, and enter Adventure or Eternal. Verify idle, movement in all four directions, Space attack, Shift dash, and impact.
4. To regenerate Lin's sample sheet, run `node tools/generate-hero-sheet-sample.mjs` from the root.
