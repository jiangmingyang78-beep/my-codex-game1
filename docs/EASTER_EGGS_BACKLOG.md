# Emberwood: Last Torch Easter Egg Backlog

Design draft for optional presentation effects after the main storyline is complete.

## Architecture and save compatibility

1. Preserve the save schema. Add no Easter egg fields, flags, or counters to `emberwood-torch:run:v1`, its backup, or `emberwood-torch:meta:v1`. Leave `core/snapshot*.ts` and `core/saveMigration.ts` intact.
2. Keep one-shot events, cooldowns, combos, and idle time in a private `WeakMap<object, EggRuntimeState>` keyed by the active run or scene, or in a component's `useRef`. Reloading or starting a new run clears the transient state. Cross-mode effects may read `meta.unlockedHeroes`, `meta.notes`, or `meta.survivalUnlocks`.
3. Use brief toasts, existing VFX calls, sound cues, or UI decoration. Preserve public VFX signatures, respect reduced motion and Canvas fallback, and keep effects out of combat decision paths.

## Entry template

```markdown
### [EE-XX] Title
- Category: Hero lore, enemy ecology, items and campfire, cross-mode, or UI and browser
- Prerequisites: Read-only heroId, regionId, inventory, or meta state
- Trigger: Game event or UI hook, for example enemy.defeated, item.crafted, or scene.idle
- Data IDs: Exact JSON IDs. Preserve balance values.
- Presentation: Toast, particle color, sound, or CSS animation and its reduced-motion fallback
- Transient state: WeakMap key and fields, or component-local state
- Verification: One to three reproducible steps
- Status: [ ] Planned / [x] Implemented
```

## Backlog of 18 entries

### A. Hero lore

| ID | Title | Prerequisite and trigger | Presentation | State |
| --- | --- | --- | --- | --- |
| `EE-H01` | The Blacksmith's Old Debt | `gale_smith` defeats `mill_overseer`. Listen to `enemy.defeated`. | After 0.6 seconds, orange-gold embers and “The iron went cold. Your hammer is still warm.” | Mark the entry in `WeakMap<RunContext, Set<string>>`. |
| `EE-H02` | Warmth in the Orange Scarf | `lin_tinder` stands still in `main_campfire` light for more than eight seconds. Use `camp.idle_tick` with no movement or attack. | One warm pulse above Lin and “The storm stops at the firelight.” | `WeakMap<Scene, { idleSec: number; shown: boolean }>`. |
| `EE-H03` | The Herbalist's Warning | `suheng_herb` first enters `deep_woods` with `herb`. Listen to `region.entered`. | A soft green sparkle and “The roots still taste bitter. Stay away from the purple bog mist.” | One-shot entry per run. |
| `EE-H04` | The Scribe's Signature | `alvin_scribe` has at least two read-only `meta.notes`. Use `run.started` or `hud.notes_opened`. | At the bottom of the notes, “Copied from the Ash Scribe's fifth manuscript.” | Render from the read-only hero ID. |

### B. Enemy ecology

| ID | Title | Prerequisite and trigger | Presentation | State |
| --- | --- | --- | --- | --- |
| `EE-E01` | Fire-Shy Woodland Beasts | `snow_weasel` or `frost_rat` recoils within half a tile of the `main_campfire` light edge on `enemy.ai_tick`. | One frame of an exclamation pixel and a short scratching cue. | `WeakMap<EnemyEntity, { lastFlinchAt: number }>` with a 12-second cooldown. |
| `EE-E02` | Sparks in Ashen Sleet | Hit `rotted_woodcutter` or `cinder_husk` during `ember_rain`. Listen to `enemy.damaged`. | Three extra `#ffd166` sparks using the existing hit effect. | Stateless listener. |
| `EE-E03` | Echo of the Mill Spider Note | `meta.notes` contains `first_ember_seal` and `mill_spider` silk misses within one tile. Use `projectile.grazed` or a dodge during wind-up. | “One step sideways, just as the note said.” | Once per run. |
| `EE-E04` | Ember Resonance | Carry `ember_lantern` as `summit_pyre_warden` reaches 30% health. Use `boss.phase_changed` with `phaseIndex === 2`. | Blue-gold and orange ember rings light the surrounding black fog. | `WeakMap<EnemyEntity, boolean>`. |

### C. Items and campfire

| ID | Title | Prerequisite and trigger | Presentation | State |
| --- | --- | --- | --- | --- |
| `EE-I01` | A Warning About Frozen Meat | Eat `raw_meat` from the quick bar on `item.consumed`. | With the existing 1 health loss, “Ice in my throat. I should have cooked that.” | `WeakMap<RunContext, { rawMeatWarned: boolean }>`. |
| `EE-I02` | Spear and Blade in Harmony | Finish forging while carrying `iron_spear` and `iron_blade`. Listen to `item.crafted`. | Two bright forge notes and “The spear keeps distance. The blade breaks armor.” | One-shot entry per run. |
| `EE-I03` | The Fire Station Points East | Place `relay_kit` in `old_mill_relay`. Listen to `relay.ignited`. | Four slow golden sparks drift toward `final_beacon` for 1.5 seconds. | Stateless one-shot VFX. |
| `EE-I04` | A Warm Edge | `warm_stew` is active while carrying `lantern` or `ember_lantern` on `hud.stats_render`. | A brief pale gold torch-bar border via CSS. | Derived component state. |

### D. Adventure and Survival links

| ID | Title | Prerequisite and trigger | Presentation | State |
| --- | --- | --- | --- | --- |
| `EE-D01` | A Whisper from the Old Mill | Survival starts with `unlock_ember_brazier` unlocked. Use `survival.run_started`. | “The old mill's warmth seems to have followed you into these woods.” | Run-keyed WeakMap and read-only `meta.survivalUnlocks`. |
| `EE-D02` | Coldlight in the Fog | `glow_cap` or `charred_ancient` matures during `freezing_fog` in Survival. Use `plant.matured`. | Soft blue or ember glow and “The black fog seems to have woken it up.” | `WeakMap<PlantEntity, boolean>`. |
| `EE-D03` | Beacon on the Distant Ridge | `meta.notes` contains `beacon_restored`. Use `title.seasons_render` in the winter preview. | A faint flickering `#ff7a2f` pixel on the far ridge in `SeasonsDiorama`. | Canvas drawing based on read-only metadata. |

### E. UI and browser

| ID | Title | Prerequisite and trigger | Presentation | State |
| --- | --- | --- | --- | --- |
| `EE-U01` | Four Seasons at the Chimney | Manually select Spring, Summer, Autumn, and Winter in `SeasonsDiorama`. Use `ui.season_manual_click`. | A small burst of golden sparks from the chimney. | Component `useRef(new Set())` resets on close. |
| `EE-U02` | A Torch in the Console | Open DevTools on any game page. Log once on `app.mounted`. | An ASCII torch and “As long as the fire still burns, we can find our way home.” | One message on module load. |
| `EE-U03` | The Fire Waits | Switch away during Adventure or Survival. Use `document.visibilitychange`. | While hidden, set the title to `🔥 The fire still waits… · Emberwood`. Restore it on return. | Store `originalTitle` in a module variable. |

## Integration order and regression checks

1. Add `EE-U01`–`EE-U03` and `EE-D03` after the storyline stabilizes.
2. Add `EE-H01`–`EE-H04` and `EE-I01`–`EE-I04` through existing events or derived HUD state.
3. Add `EE-E01`–`EE-E04` and `EE-D01`–`EE-D02`. Use per-entity cooldowns and check for extra per-frame allocations.

- [ ] Compare the run and meta keys and serialized field structure before and after enabling the effects.
- [ ] Confirm exported VFX names and parameters are unchanged.
- [ ] Check reduced motion and Canvas fallback for clean degradation and no stalls.
- [ ] Run `pnpm typecheck`, `pnpm fix`, and `pnpm build`.
