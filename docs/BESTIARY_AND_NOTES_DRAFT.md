# Emberwood: Last Torch Bestiary and Camp Note Draft

This design draft proposes text and data only. Its IDs align with `enemies.json`, `legacyEnemies.json`, `regions.json`, `heroes.json`, `lore.json`.

## 1. Bestiary entries

Each of the 16 entries includes a short field description, a tactical note, and a restrained comment from Alvin.

### A. Current enemies (`enemies.json` · 12)

#### 1. Snow Weasel (`snow_weasel`)
- **Habitat** · Fireside Woods (`camp_edge`) / Old Mill (`old_mill`)
- **Behavior** · A slender beast that slips over snow, its coat whitening as cold fronts pass. It circles the edge of campfire light and lowers its back to spring the moment a traveler turns away for wood.
- **Tactics** · Sidestep when it crouches for a straight lunge, then counter while it recovers.
- **Alvin’s note** · The first thing to take a lone traveler’s berries or fingers is often something this small.

#### 2. Frost Rat (`frost_rat`)
- **Habitat** · Fireside Woods (`camp_edge`)
- **Behavior** · Gray-white rats shelter under dead grass and between frozen roots. They endure bitter cold, gnaw fallen berries after dark, and dart a short distance to bite when startled.
- **Tactics** · It has 1 health and a short lunge. Strike before it lifts its paws to spring.
- **Alvin’s note** · They eat even frozen roots. The colder the woods, the deeper their burrows.

#### 3. Ash Wolf (`ash_wolf`)
- **Habitat** · Old Mill (`old_mill`) / Shadowed Frost Bog (`deep_woods`)
- **Behavior** · Hungry wolves with ash-stiffened backs hunt in pairs along the wind lanes. The scent of fresh meat or lingering campfire smoke brings them close enough for a powerful midrange pounce.
- **Tactics** · Its pounce reaches 3 tiles. Sidestep when it crouches, then close in during recovery.
- **Alvin’s note** · Once ash settled into their fur, they could smell only blood and coals that still burned.

#### 4. Shadow Lynx (`shadow_lynx`)
- **Habitat** · Shadowed Frost Bog (`deep_woods`) / Frost Ridge Trail (`frost_ridge`)
- **Behavior** · A swift predator that moves through black fog faster than a fire patrol can run. It avoids prolonged fights, sweeping low along the edge of sight before turning abruptly into a pounce.
- **Tactics** · Hold position near firelight or a tree, and counter after it lands to catch its breath.
- **Alvin’s note** · By the time the claws tear through the snow and those gray eyes appear, half the lamp oil has gone cold.

#### 5. Rotten Woodcutter (`rotted_woodcutter`)
- **Habitat** · Fireside Woods (`camp_edge`) / Old Mill (`old_mill`)
- **Behavior** · The remains of a lumber worker soaked in freezing fog. Rust, resin, and brittle branches cling to its shoulders. It follows tracks with slow, heavy steps and swings its arms hard when it closes.
- **Tactics** · Use your speed to circle and retreat. It pauses with its arm raised before each close swing.
- **Alvin’s note** · When the mill stopped, some workers never came down. A few still had their axes clenched in hand.

#### 6. Cinder Husk (`cinder_husk`)
- **Habitat** · Old Mill (`old_mill`) / Shadowed Frost Bog (`deep_woods`)
- **Behavior** · A charred corpse with dark red coals glowing in its chest. Ash falls beneath each step. It is tougher and more violent than a Rotten Woodcutter, and faint light does little to hold it back.
- **Tactics** · Use the Iron Spear’s 1.75-tile reach to strike and retreat without trading blows.
- **Alvin’s note** · Fire once saved them. Later it burned their bones to charcoal that would not go out.

#### 7. Frozen Guard (`frozen_guard`)
- **Habitat** · Frost Ridge Trail (`frost_ridge`)
- **Behavior** · An old pass guard in heavy frozen armor. Black ice and shards of iron fill the seams. It moves slowly, but a frontal attack barely dents it and its heavy slash can crush light armor.
- **Tactics** · Wear a Wrought-Iron Breastplate or use the Iron Spear’s 1.75-tile reach. Avoid being cornered on a narrow path.
- **Alvin’s note** · The pass has been snowbound for years. They still hold rusty blades across their chests and wait for a watchword that will never come.

#### 8. Frost Crow Thrower (`frost_crow`)
- **Habitat** · Old Mill (`old_mill`) / Shadowed Frost Bog (`deep_woods`)
- **Behavior** · A large warped crow that nests in broken beams and high branches. It keeps four or five tiles between itself and a traveler, then beats its wings to throw hardened, ice-tipped feathers.
- **Tactics** · Approach diagonally to avoid the projectile line. It has little defense at close range.
- **Alvin’s note** · Corvus says birds know the wind better than anyone. These birds dive only at those who still carry fire.

#### 9. Bog Spitter (`bog_spitter`)
- **Habitat** · Shadowed Frost Bog (`deep_woods`)
- **Behavior** · A rotting mass half sunk in frozen mud, coated in weeping herbs and fungus. It lobs corrosive spore sacs high toward a target’s feet. A broad cloud of poison blooms on impact.
- **Tactics** · Move at least 1.5 tiles clear of the warning circle and close in while it is on cooldown.
- **Alvin’s note** · Suheng tried to peel herbs from its surface. Her note said only, “Even the dirt has rotted through.”

#### 10. Stray Ember Wisp (`ember_wisp`)
- **Habitat** · Shadowed Frost Bog (`deep_woods`) / Frost Ridge Trail (`frost_ridge`)
- **Behavior** · A blue-orange flame made from scattered firekeepers’ embers. It drifts quickly outside reach, then launches a fast ember bolt after a short wind-up. Walking straight away rarely works.
- **Tactics** · Move sideways or Snow Dash past the first bolt, then close in during recovery.
- **Alvin’s note** · From far away it looks like a relay fire left by a patrol. Up close, it wants to swallow your fire too.

#### 11. Old Mill Overseer (Ember Seal Guardian) (`mill_overseer`)
- **Habitat** · Old Mill (`old_mill`) · Adventure boss (`adventure_only`)
- **Behavior** · The head blacksmith sealed inside the main hall, with half a hot Ember Seal embedded in his chest. He uses measured close-range hammer blows above half health and long charges below it.
- **Tactics** · Bring an Iron Spear and Baked Berry Cakes. In phase two, dodge sideways after the long wind-up and counter during recovery.
- **Alvin’s note** · Gale said, “Bring the Overseer out.” What remains in the mill understands only the sound of a hammer.

#### 12. Summit Pyre Warden (Final Guardian) (`summit_pyre_warden`)
- **Habitat** · Frost Ridge Trail (`frost_ridge`) · Adventure boss (`adventure_only`)
- **Behavior** · The last armored guardian of the eastern beacon holds the second Ember Seal. As health falls, it moves from heavy slashes to blasts of embers, then to a frenzied lunge that deals four damage.
- **Tactics** · Forge the breastplate and heavy helm. Save Snow Dash for the final-phase lunge before finishing the fight.
- **Alvin’s note** · When even the firekeeper doubts the flame will last until dawn, the Ember Gatherer must take the last step.

### B. Legacy fire patrol enemies (`legacyEnemies.json` · 4)

#### 13. Mill Spider (`mill_spider`)
- **Habitat** · Old Mill (`old_mill`)
- **Behavior** · A pale spider in the old mill’s eaves and wall shadows. It spins tough silk mixed with ice shards. It halts and spits when a traveler comes within six tiles, blocking the way.
- **Tactics** · Look for the pause before the slow silk shot. Sidestep, then close in.
- **Alvin’s note** · Lin recorded its timing in the first note. Its tough silk still works for wrapping a wound.

#### 14. Ice Ram (`ice_ram`)
- **Habitat** · Ice Gorge (`ice_gorge`)
- **Behavior** · A massive tundra beast with blunt, icy horns. It lowers its head into the gorge wind to break snowbanks. Once it sees a lone figure, it builds momentum and charges straight for four tiles.
- **Tactics** · Its wind-up is 0.75 seconds and it cannot turn mid-charge. Bait a miss to gain one full second to attack.
- **Alvin’s note** · The old patrol used Ice Rams to open blocked paths. Now they crash through the gorge with no one to guide them.

#### 15. Coal Shade (`coal_shade`)
- **Habitat** · Ice Gorge (`ice_gorge`)
- **Behavior** · A black outline that drifts through the shaded Ice Gorge like a firekeeper quenched by freezing rain. Its close sweep wounds its victim and puts out much of the torchlight at once.
- **Tactics** · Stay beyond two tiles, especially when the torch is low. Preserve light before closing in.
- **Alvin’s note** · The wound is less frightening than the snow going suddenly dark after the shade sweeps past.

#### 16. Beacon Keeper (`beacon_keeper`)
- **Habitat** · Ridge Beacon (`beacon`)
- **Behavior** · A broken soldier at the edge of the old stone platform. It still holds the last Beacon Core. It alternates long charges with wide sweeps and attacks much more quickly below half health.
- **Tactics** · Below half health, wait for the two-attack sequence to end. Land two hits and back away.
- **Alvin’s note** · Snow piled on the platform for more winters than anyone remembers, and still he kept hold of the ember.

## 2. Bestiary UI JSON draft (`bestiary.draft.json`)

The 16 entries are intended for `src/frontend/src/data/bestiary.json` when a bestiary UI is implemented.

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "enemyId": "snow_weasel",
      "source": "enemies.json",
      "name": "Snow Weasel",
      "regionIds": [
        "camp_edge",
        "old_mill"
      ],
      "scope": "shared",
      "lore": "A slender beast that slips over snow, its coat whitening as cold fronts pass. It circles the edge of campfire light and lowers its back to spring the moment a traveler turns away for wood.",
      "tactics": "Sidestep when it crouches for a straight lunge, then counter while it recovers.",
      "scribeNote": "The first thing to take a lone traveler’s berries or fingers is often something this small.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "frost_rat",
      "source": "enemies.json",
      "name": "Frost Rat",
      "regionIds": [
        "camp_edge"
      ],
      "scope": "shared",
      "lore": "Gray-white rats shelter under dead grass and between frozen roots. They endure bitter cold, gnaw fallen berries after dark, and dart a short distance to bite when startled.",
      "tactics": "It has 1 health and a short lunge. Strike before it lifts its paws to spring.",
      "scribeNote": "They eat even frozen roots. The colder the woods, the deeper their burrows.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "ash_wolf",
      "source": "enemies.json",
      "name": "Ash Wolf",
      "regionIds": [
        "old_mill",
        "deep_woods"
      ],
      "scope": "shared",
      "lore": "Hungry wolves with ash-stiffened backs hunt in pairs along the wind lanes. The scent of fresh meat or lingering campfire smoke brings them close enough for a powerful midrange pounce.",
      "tactics": "Its pounce reaches 3 tiles. Sidestep when it crouches, then close in during recovery.",
      "scribeNote": "Once ash settled into their fur, they could smell only blood and coals that still burned.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "shadow_lynx",
      "source": "enemies.json",
      "name": "Shadow Lynx",
      "regionIds": [
        "deep_woods",
        "frost_ridge"
      ],
      "scope": "shared",
      "lore": "A swift predator that moves through black fog faster than a fire patrol can run. It avoids prolonged fights, sweeping low along the edge of sight before turning abruptly into a pounce.",
      "tactics": "Hold position near firelight or a tree, and counter after it lands to catch its breath.",
      "scribeNote": "By the time the claws tear through the snow and those gray eyes appear, half the lamp oil has gone cold.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "rotted_woodcutter",
      "source": "enemies.json",
      "name": "Rotten Woodcutter",
      "regionIds": [
        "camp_edge",
        "old_mill"
      ],
      "scope": "shared",
      "lore": "The remains of a lumber worker soaked in freezing fog. Rust, resin, and brittle branches cling to its shoulders. It follows tracks with slow, heavy steps and swings its arms hard when it closes.",
      "tactics": "Use your speed to circle and retreat. It pauses with its arm raised before each close swing.",
      "scribeNote": "When the mill stopped, some workers never came down. A few still had their axes clenched in hand.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "cinder_husk",
      "source": "enemies.json",
      "name": "Cinder Husk",
      "regionIds": [
        "old_mill",
        "deep_woods"
      ],
      "scope": "shared",
      "lore": "A charred corpse with dark red coals glowing in its chest. Ash falls beneath each step. It is tougher and more violent than a Rotten Woodcutter, and faint light does little to hold it back.",
      "tactics": "Use the Iron Spear’s 1.75-tile reach to strike and retreat without trading blows.",
      "scribeNote": "Fire once saved them. Later it burned their bones to charcoal that would not go out.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "frozen_guard",
      "source": "enemies.json",
      "name": "Frozen Guard",
      "regionIds": [
        "frost_ridge"
      ],
      "scope": "shared",
      "lore": "An old pass guard in heavy frozen armor. Black ice and shards of iron fill the seams. It moves slowly, but a frontal attack barely dents it and its heavy slash can crush light armor.",
      "tactics": "Wear a Wrought-Iron Breastplate or use the Iron Spear’s 1.75-tile reach. Avoid being cornered on a narrow path.",
      "scribeNote": "The pass has been snowbound for years. They still hold rusty blades across their chests and wait for a watchword that will never come.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "frost_crow",
      "source": "enemies.json",
      "name": "Frost Crow Thrower",
      "regionIds": [
        "old_mill",
        "deep_woods"
      ],
      "scope": "shared",
      "lore": "A large warped crow that nests in broken beams and high branches. It keeps four or five tiles between itself and a traveler, then beats its wings to throw hardened, ice-tipped feathers.",
      "tactics": "Approach diagonally to avoid the projectile line. It has little defense at close range.",
      "scribeNote": "Corvus says birds know the wind better than anyone. These birds dive only at those who still carry fire.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "bog_spitter",
      "source": "enemies.json",
      "name": "Bog Spitter",
      "regionIds": [
        "deep_woods"
      ],
      "scope": "shared",
      "lore": "A rotting mass half sunk in frozen mud, coated in weeping herbs and fungus. It lobs corrosive spore sacs high toward a target’s feet. A broad cloud of poison blooms on impact.",
      "tactics": "Move at least 1.5 tiles clear of the warning circle and close in while it is on cooldown.",
      "scribeNote": "Suheng tried to peel herbs from its surface. Her note said only, “Even the dirt has rotted through.”",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "ember_wisp",
      "source": "enemies.json",
      "name": "Stray Ember Wisp",
      "regionIds": [
        "deep_woods",
        "frost_ridge"
      ],
      "scope": "shared",
      "lore": "A blue-orange flame made from scattered firekeepers’ embers. It drifts quickly outside reach, then launches a fast ember bolt after a short wind-up. Walking straight away rarely works.",
      "tactics": "Move sideways or Snow Dash past the first bolt, then close in during recovery.",
      "scribeNote": "From far away it looks like a relay fire left by a patrol. Up close, it wants to swallow your fire too.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "mill_overseer",
      "source": "enemies.json",
      "name": "Old Mill Overseer (Ember Seal Guardian)",
      "regionIds": [
        "old_mill"
      ],
      "scope": "adventure_only",
      "lore": "The head blacksmith sealed inside the main hall, with half a hot Ember Seal embedded in his chest. He uses measured close-range hammer blows above half health and long charges below it.",
      "tactics": "Bring an Iron Spear and Baked Berry Cakes. In phase two, dodge sideways after the long wind-up and counter during recovery.",
      "scribeNote": "Gale said, “Bring the Overseer out.” What remains in the mill understands only the sound of a hammer.",
      "unlockTrigger": "enemy_defeated"
    },
    {
      "enemyId": "summit_pyre_warden",
      "source": "enemies.json",
      "name": "Summit Pyre Warden (Final Guardian)",
      "regionIds": [
        "frost_ridge"
      ],
      "scope": "adventure_only",
      "lore": "The last armored guardian of the eastern beacon holds the second Ember Seal. As health falls, it moves from heavy slashes to blasts of embers, then to a frenzied lunge that deals four damage.",
      "tactics": "Forge the breastplate and heavy helm. Save Snow Dash for the final-phase lunge before finishing the fight.",
      "scribeNote": "When even the firekeeper doubts the flame will last until dawn, the Ember Gatherer must take the last step.",
      "unlockTrigger": "enemy_defeated"
    },
    {
      "enemyId": "mill_spider",
      "source": "legacyEnemies.json",
      "name": "Mill Spider",
      "regionIds": [
        "old_mill"
      ],
      "scope": "legacy",
      "lore": "A pale spider in the old mill’s eaves and wall shadows. It spins tough silk mixed with ice shards. It halts and spits when a traveler comes within six tiles, blocking the way.",
      "tactics": "Look for the pause before the slow silk shot. Sidestep, then close in.",
      "scribeNote": "Lin recorded its timing in the first note. Its tough silk still works for wrapping a wound.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "ice_ram",
      "source": "legacyEnemies.json",
      "name": "Ice Ram",
      "regionIds": [
        "ice_gorge"
      ],
      "scope": "legacy",
      "lore": "A massive tundra beast with blunt, icy horns. It lowers its head into the gorge wind to break snowbanks. Once it sees a lone figure, it builds momentum and charges straight for four tiles.",
      "tactics": "Its wind-up is 0.75 seconds and it cannot turn mid-charge. Bait a miss to gain one full second to attack.",
      "scribeNote": "The old patrol used Ice Rams to open blocked paths. Now they crash through the gorge with no one to guide them.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "coal_shade",
      "source": "legacyEnemies.json",
      "name": "Coal Shade",
      "regionIds": [
        "ice_gorge"
      ],
      "scope": "legacy",
      "lore": "A black outline that drifts through the shaded Ice Gorge like a firekeeper quenched by freezing rain. Its close sweep wounds its victim and puts out much of the torchlight at once.",
      "tactics": "Stay beyond two tiles, especially when the torch is low. Preserve light before closing in.",
      "scribeNote": "The wound is less frightening than the snow going suddenly dark after the shade sweeps past.",
      "unlockTrigger": "enemy_encountered"
    },
    {
      "enemyId": "beacon_keeper",
      "source": "legacyEnemies.json",
      "name": "Beacon Keeper",
      "regionIds": [
        "beacon"
      ],
      "scope": "legacy",
      "lore": "A broken soldier at the edge of the old stone platform. It still holds the last Beacon Core. It alternates long charges with wide sweeps and attacks much more quickly below half health.",
      "tactics": "Below half health, wait for the two-attack sequence to end. Land two hits and back away.",
      "scribeNote": "Snow piled on the platform for more winters than anyone remembers, and still he kept hold of the ember.",
      "unlockTrigger": "enemy_defeated"
    }
  ]
}
```

## 3. The Five Eras and six proposed camp notes

### A. Timeline for notes, achievements, and story pop-ups

| Era | Name | Events and evidence | Characters and regions |
| --- | --- | --- | --- |
| First | Founding of the Hearth | The settlements raised the eastern stone beacon, forged the two Ember Seals and the Beacon Core, and established the firekeepers’ watch oath. | Unnamed Forerunners, `beacon` and `frost_ridge` |
| Second | Mill and Fire Patrol Roads | Roads and relay braziers crossed the snowline. The Old Mill opened its forge and supplied the patrol with Iron Spears and Iron Lanterns. | Gale (`gale_smith`), `old_mill` |
| Third | Descent of the Black Fog | The White Abyss Blizzard lasted months. `freezing_fog` spread through the woods and twisted workers, beasts, and guardians. The Overseer sealed the mill and vanished. | Suheng (`suheng_herb`), `deep_woods` |
| Fourth | Broken Roads and Sealed Gates | The Ice Gorge collapsed, gates locked, and the relays went dark. The hunter found tracks, and the scribe recovered loose pages. | Corvus and Alvin |
| Fifth | Last Ember Gatherer | Lamps still glowed below. Lin set out from `camp_edge` in the orange scarf to reunite the seals and relight the eastern beacon. | Lin and the reunited group of five |

### B. Six proposed camp notes

1. **Lin (`lin_tinder`) · Ash on the Old Orange Scarf** (`note_orange_scarf`)
   > I washed this orange scarf in melted snow three times. Pine soot from the last firekeeper still clings in the seams. He never said when dawn would come. He slipped a flint into my sleeve. As long as the main fire burns, the people below will keep their curtains open and wait in the wind.

2. **Gale (`gale_smith`) · The Stilled Millwheel** (`note_stopped_millwheel`)
   > The night the wheel froze, the forge still had half a night of heat. The Overseer locked two iron billets in the back room and refused to open the door. The hammer struck on through the stone. I carried half a sack of scrap back to the woods, thinking someone would have to push that door open when the wind died.

3. **Suheng (`suheng_herb`) · Roots Beneath the Frozen Leaves** (`note_mire_veins`)
   > When the black fog settled, frostcaps in the shaded woods grew faster than before, but bitter snow herbs grew scarce. I buried spare medicine under stumps by the bog. If spores graze your arm, scrape off the black mud and apply pine resin crushed with bitter herbs while it is warm.

4. **Corvus (`corvus_hunt`) · Tracks East of the Snowline** (`note_lynx_tracks`)
   > Lynx tracks avoid the roads. They turn at dead roots and sheltered slopes. Follow the shallow prints east across two gullies to pass the wolves unseen. Beyond the Frost Abyss tree line, every track turns back at the stone stairs. Even the animals know who stands ahead.

5. **Alvin (`alvin_scribe`) · The Five Eras in Fragments** (`note_five_eras_ledger`)
   > Hearth, road, fog, closed gates, and embers. The first four eras fill the front of the parchment book, each in a less steady hand. On the fifth page I left a date blank. When the eastern beacon burns through the clouds again, I will write the names of those who make it back to the hearth.

6. **Unnamed Forerunner (`unnamed_forerunner`) · The Oath of the First Beacon Core** (`note_first_beacon_oath`)
   > We forged two Ember Seals and gave one to the outpost and one to the pass guard. We hid the Beacon Core in a sheltered slot in the stone, so the flame could be made whole even if half of us fell on the road. If you find the gates rusted shut and the stations dark, spare the names your grief. Light the fire again.

### C. Optional snippets for `lore.json` and `balance.json`

```json
{
  "campNotesExtension": {
    "note_orange_scarf": {
      "title": "Ash on the Old Orange Scarf",
      "body": "I washed this orange scarf in melted snow three times. Pine soot from the last firekeeper still clings in the seams. He never said when dawn would come. He slipped a flint into my sleeve. As long as the main fire burns, the people below will keep their curtains open and wait in the wind."
    },
    "note_stopped_millwheel": {
      "title": "The Stilled Millwheel",
      "body": "The night the wheel froze, the forge still had half a night of heat. The Overseer locked two iron billets in the back room and refused to open the door. The hammer struck on through the stone. I carried half a sack of scrap back to the woods, thinking someone would have to push that door open when the wind died."
    },
    "note_mire_veins": {
      "title": "Roots Beneath the Frozen Leaves",
      "body": "When the black fog settled, frostcaps in the shaded woods grew faster than before, but bitter snow herbs grew scarce. I buried spare medicine under stumps by the bog. If spores graze your arm, scrape off the black mud and apply pine resin crushed with bitter herbs while it is warm."
    },
    "note_lynx_tracks": {
      "title": "Tracks East of the Snowline",
      "body": "Lynx tracks avoid the roads. They turn at dead roots and sheltered slopes. Follow the shallow prints east across two gullies to pass the wolves unseen. Beyond the Frost Abyss tree line, every track turns back at the stone stairs. Even the animals know who stands ahead."
    },
    "note_five_eras_ledger": {
      "title": "The Five Eras in Fragments",
      "body": "Hearth, road, fog, closed gates, and embers. The first four eras fill the front of the parchment book, each in a less steady hand. On the fifth page I left a date blank. When the eastern beacon burns through the clouds again, I will write the names of those who make it back to the hearth."
    },
    "note_first_beacon_oath": {
      "title": "The Oath of the First Beacon Core",
      "body": "We forged two Ember Seals and gave one to the outpost and one to the pass guard. We hid the Beacon Core in a sheltered slot in the stone, so the flame could be made whole even if half of us fell on the road. If you find the gates rusted shut and the stations dark, spare the names your grief. Light the fire again."
    }
  },
  "suggestedBalanceMetaTriggers": [
    {
      "id": "note_orange_scarf",
      "trigger": "camp_level_2_reached"
    },
    {
      "id": "note_stopped_millwheel",
      "trigger": "mill_overseer_defeated"
    },
    {
      "id": "note_mire_veins",
      "trigger": "deep_woods_entered"
    },
    {
      "id": "note_lynx_tracks",
      "trigger": "frost_ridge_entered"
    },
    {
      "id": "note_five_eras_ledger",
      "trigger": "alvin_unlocked"
    },
    {
      "id": "note_first_beacon_oath",
      "trigger": "both_seals_collected"
    }
  ]
}
```
