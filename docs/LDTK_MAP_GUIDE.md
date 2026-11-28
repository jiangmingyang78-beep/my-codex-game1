# LDtk 240×96 Map Authoring and Integration

> Adapter: [ldtkAdapter.ts](../src/frontend/src/systems/world/ldtkAdapter.ts)
>
> Use `getWorld(data, ldtkMap)` to load an LDtk map. Omitting `ldtkMap` keeps the default procedural 240×96 map.

## 1. Canvas and grid

- Use a 16 px grid, matching the tile size in `balance.json`.
- Set the level to 240 × 96 tiles (3840 × 1536 px).
- `buildWorldFromLdtk(ldtk, data, levelIndex = 0)` reads `levels[0]` by default.

## 2. Required layers

| Name (`__identifier`) | Type (`__type`) | Required | Purpose |
| --- | --- | --- | --- |
| `Terrain` | `IntGrid` | Yes | Terrain, exported as 1-based `intGridCsv` values |
| `Entities` | `Entities` | Yes | Spawns, campfires, regions, gates, fire stations, resources, and story objects |

## 3. Terrain values

The adapter uses `raw > 0 ? raw - 1 : TILE.wall`. Unpainted cells use `TILE.wall`.

| IntGrid | Target | Internal value | Behavior |
| --- | --- | --- | --- |
| `0` (empty) | `TILE.wall` | `3` | Unpainted cells default to solid walls. |
| `1` | `TILE.snow` | `0` | Walkable snow. |
| `2` | `TILE.path` | `1` | Boardwalk or trail that can bypass the bog slowdown. |
| `3` | `TILE.tree` | `2` | Tree collision and canopy draw tile. |
| `4` | `TILE.wall` | `3` | Solid rock or boundary wall. |
| `5` | `TILE.floor` | `4` | Walkable camp or ruin floor. |
| `6` | `TILE.door` | `5` | Gate tile. A `Gate` entity normally paints it. |
| `7` | `TILE.ice` | `6` | Ice that causes sliding with `slippery_ice`. |
| `8` | `TILE.fireBase` | `7` | Fire base, painted by `Campfire` and `RelaySocket` entities. |
| `9` | `TILE.bog` | `8` | Frozen bog, with `0.65×` movement under `dense_fog_bog`. |

## 4. Entities and fields

| Identifier | Required fields | Optional fields | Mapping |
| --- | --- | --- | --- |
| `HeroStart` | None | None | Set the player's `heroStart`. |
| `Campfire` | None | `regionId` | Place the main campfire and paint `TILE.fireBase`. |
| `Region` | `regionId` | None | Define inclusive `RegionBounds` from the entity dimensions. |
| `Spawn` | `spawnId` | `regionId` | Add a spawn anchor to `spawns`. |
| `Gate` | `gateId` | `regionId` | Paint covered `TILE.door` cells and populate `gateTiles`. |
| `RelaySocket` | `relayId` | `regionId` | Place a relay socket and paint `TILE.fireBase`. |
| `ResourceNode` | None | `objectId`, `itemId`, `yield`, `regionId` | Place a gatherable node. The default is one `wood`. |
| `StoryProp` | None | `objectId`, `toast`, `unlockNoteId`, `regionId` | Place a story relic. |
| `ExplosiveBarrel` | None | `objectId`, `regionId` | Place a resin barrel that ignites on attack or E. |
| `MirrorLamp` | None | `objectId`, `regionId` | Place a brass mirror lamp. |

## 5. Adapter tests

This command checks the LDtk-to-`World` field mappings and the `getWorld` switch.

```bash
node tests/run-ldtk-test.mjs
```

## 6. Survival encounter microlevels

`encounters.json.setPieces` defines each set piece's name, map icon, allowed biome indices, minimum distance from camp and matching pieces, world quota, and selection weight. Biome indices start at zero in `survivalBiomes.ts` order. Every occupied tile must lie in an allowed biome. Each 32×32 road district can contain at most one encounter, and the starting camp district stays clear. Minimum separation between matching pieces is measured center to center.

| Field | Meaning |
| --- | --- |
| `footprint`, `tiles` | Width and height are each 1–15 tiles. Each string represents one row of Survival terrain IDs, top to bottom and left to right. Stamping levels the footprint and keeps main roads. |
| `props` | Local tile coordinates `x` and `y`, with `kind` selecting the pixel art. Each piece has one main investigation prop with `interactive: true`. |
| `entities` | `kind` is `plant` or `enemy`. `ref` selects a plant or a shared Survival enemy. Plants appear on discovery, and guards spawn on investigation. |
| `lootTable` | Entries have `itemId`, `count`, and `probability`. IDs must exist in both the item table and Survival inventory. The seed determines each roll independently. |
| `triggerEvent` | `cache` supplies items, `trap` deals 1 damage on entry or investigation, `heal` restores 2 health, and `ambush` spawns preset enemies. Each instance resolves once. |
| `rotate`, `mirror` | Permit 90° rotations or horizontal mirroring of terrain, props, entities, and trigger coordinates together. |
| `ldtkLevelRef` | Optionally load terrain, props, and entities from the matching identifier in `encounterLevels.json`. Dimensions must match `footprint`. |

The sled template uses the `IceSled` microlevel. Use 16 px tiles with a `SurvivalTerrain` IntGrid and an `Entities` layer. Paint every cell with Survival tile ID plus one. Supported entities are `Prop` with `kind` and `interactive`, `Plant` with `ref`, and `Enemy` with `ref`. Positions come from `__grid`. The encounter template still defines loot, triggers, and placement limits.

The seed orders candidate districts. The generator checks up to 440 around camp and tries up to four eligible templates per district. After stamping, four-direction BFS checks the route from the investigation prop to the main road and through the set piece. The generator logs one warning if candidates run out before the quota is filled. In new seeded worlds, coming within six tiles of the center reveals the icon and name. Press E to investigate. Earlier seeds and classic saves retain their layouts.
