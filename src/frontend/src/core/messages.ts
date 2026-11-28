import loreJson from "@/data/lore.json";
import type { LoreData } from "./dataTypes";

/** Player-facing text for the stable reason codes returned by the rule systems. */
const REASONS: Record<string, string> = {
  unknown_item: "Unknown item",
  unknown_recipe: "Unknown recipe",
  recipe_locked: "Recipe locked",
  not_usable: "This item cannot be used directly",
  not_owned: "You do not have this item",
  stat_full: "Health is already full",
  inventory_full: "Inventory full",
  missing_material: "Missing required materials",
  camp_level_too_low: "Campfire level is too low",
  already_upgraded: "The campfire is already at this level",
  camp_level_max: "The campfire is at its maximum level",
  already_owned: "You already own this item",
  no_free_relay_slot: "No unused fire stations for a Relay Brazier",
  station_too_far: "Move closer to the campfire",
  already_gathered: "It's empty here",
  nothing_nearby: "Nothing to interact with nearby",
  no_relay_kit: "A Relay Brazier is required to light this station",
  already_lit: "The fire station is already lit",
  already_open: "The gate is already open",
  missing_seal: "Recover the required Ember Seals first",
};

export function reasonMessage(
  reason: string | undefined,
  detail?: Record<string, unknown>,
): string {
  if (!reason) return "";
  if (reason === "camp_level_too_low" && typeof detail?.need === "number") {
    return `Requires a Level ${detail.need} campfire`;
  }
  return REASONS[reason] ?? "Could not complete the action";
}

export const CAMP_NOTE_TEXT: LoreData["campNotes"] = loreJson.campNotes;
