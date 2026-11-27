import levels from "@/data/encounterLevels.json";
import config from "@/data/encounters.json";
import { type LdtkProjectJson, setPieceFromLdtk } from "../world/ldtkAdapter";
import type { EncounterSetPieceSchema } from "../world/setPieceStamp";

export const encounterTemplates: readonly EncounterSetPieceSchema[] =
  config.setPieces;
export const encounterById = new Map(encounterTemplates.map((p) => [p.id, p]));
export function resolveEncounter(
  piece: EncounterSetPieceSchema,
): EncounterSetPieceSchema {
  if (!piece.ldtkLevelRef) return piece;
  const stamp = setPieceFromLdtk(
    levels as unknown as LdtkProjectJson,
    piece.ldtkLevelRef,
  );
  if (
    stamp.footprint.w !== piece.footprint.w ||
    stamp.footprint.h !== piece.footprint.h
  )
    throw new Error(`LDtk 布景尺寸与模板不符：${piece.id}`);
  return { ...piece, ...stamp };
}
