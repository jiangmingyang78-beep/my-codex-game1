import { resolveEncounter } from "@/systems/survival/encounterCatalog";
import type {
  EncounterSetPieceSchema,
  StampableSetPiece,
} from "@/systems/world/setPieceStamp";
import {
  boolean,
  count,
  fields,
  invalid,
  list,
  natural,
  nonnegative,
  number,
  oneOf,
  optional,
  positive,
  ratio,
  shape,
  string,
} from "../schemaChecks";

const coordinate = fields("x y", natural);
const stampFields = {
  footprint: shape(fields("w h", number(1, 15, true))),
  tiles: list(string, 1, 15),
  props: list(
    shape({
      ...coordinate,
      kind: oneOf(
        "logs",
        "furnace",
        "snare",
        "kiln",
        "sled",
        "lantern",
        "monolith",
        "spring",
      ),
      interactive: boolean,
    }),
    1,
  ),
  entities: list(
    shape({ ...coordinate, kind: oneOf("plant", "enemy"), ref: string }),
  ),
};
export const encounterSchema = shape({
  ...stampFields,
  id: string,
  name: string,
  allowedBiomes: list(number(0, 8, true), 1, 9),
  minDistanceFromCamp: nonnegative,
  minSpacingSameId: nonnegative,
  maxCountPerWorld: number(1, 64, true),
  weight: positive,
  lootTable: list(shape({ itemId: string, count, probability: ratio })),
  triggerEvent: shape({
    kind: oneOf("cache", "trap", "ambush", "heal"),
    message: string,
  }),
  ldtkLevelRef: optional(string),
  rotate: optional(boolean),
  mirror: optional(boolean),
  color: string,
  icon: list(string, 5, 5),
});
export function validateEncounterReferences(
  pieces: readonly EncounterSetPieceSchema[],
  items: ReadonlyMap<string, unknown>,
  stock: ReadonlySet<string>,
  enemies: ReadonlyMap<string, { scope?: string; seedType?: string }>,
  plants: ReadonlyMap<string, { solid: boolean }>,
) {
  const ids = new Set<string>();
  pieces.forEach((p, i) => {
    const path = `encounters.json.setPieces[${i}]`;
    if (!/^[a-z][a-z0-9_]*$/.test(p.id) || ids.has(p.id))
      invalid(`${path}.id`, "invalid or duplicate identifier");
    ids.add(p.id);
    if (
      !/^#[a-f0-9]{6}$/i.test(p.color) ||
      p.icon.some((row) => !/^([.#]){5}$/.test(row))
    )
      invalid(`${path}.icon`, "invalid pixel art");
    function geometry(stamp: StampableSetPiece) {
      const { w, h } = stamp.footprint;
      if (
        stamp.tiles.length !== h ||
        stamp.tiles.some((row) => row.length !== w || !/^[0-9]+$/.test(row))
      )
        invalid(`${path}.tiles`, "invalid grid");
      if (stamp.props.filter((prop) => prop.interactive).length !== 1)
        invalid(`${path}.props`, "expected one interactive prop");
      const occupied = new Set<string>();
      for (const [group, entries] of [
        ["props", stamp.props],
        ["entities", stamp.entities],
      ] as const) {
        entries.forEach((a, j) => {
          const key = `${a.x},${a.y}`;
          const field = `${path}.${group}[${j}]`;
          if (
            !Number.isInteger(a.x) ||
            !Number.isInteger(a.y) ||
            a.x < 0 ||
            a.y < 0 ||
            a.x >= w ||
            a.y >= h ||
            occupied.has(key)
          )
            invalid(field, "invalid or occupied cell");
          occupied.add(key);
          if ("ref" in a) {
            if (a.kind === "plant" && !plants.has(a.ref))
              invalid(`${field}.ref`, "unknown plant");
            if (
              a.kind === "enemy" &&
              (enemies.get(a.ref)?.scope !== "shared" ||
                enemies.get(a.ref)?.seedType === "warden_phase")
            )
              invalid(`${field}.ref`, "expected survival enemy");
          }
        });
      }
    }
    geometry(p);
    if (p.ldtkLevelRef) {
      try {
        const resolved = resolveEncounter(p);
        encounterSchema(resolved, path);
        geometry(resolved);
      } catch (e) {
        invalid(`${path}.ldtkLevelRef`, String(e));
      }
    }
    p.lootTable.forEach((entry, j) => {
      if (!items.has(entry.itemId) || !stock.has(entry.itemId))
        invalid(`${path}.lootTable[${j}].itemId`, "unknown survival item");
    });
  });
}
