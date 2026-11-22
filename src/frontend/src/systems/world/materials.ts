/** Particle material kind for the `resource.collected` event, independent of the item id. */
const MATERIAL_BY_ITEM: Record<
  string,
  "wood" | "stone" | "plant" | "water" | "dust"
> = {
  wood: "wood",
  stone: "stone",
  ore: "stone",
  fiber: "plant",
  berry: "plant",
  frostcap: "plant",
};

export function materialFor(
  itemId: string,
): "wood" | "stone" | "plant" | "water" | "dust" {
  return MATERIAL_BY_ITEM[itemId] ?? "dust";
}
