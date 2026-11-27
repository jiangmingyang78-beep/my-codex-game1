import { invalid } from "./schemaChecks";
export function index<T>(
  rows: readonly T[],
  key: (row: T) => string,
  path: string,
  field = "id",
) {
  const map = new Map<string, T>();
  rows.forEach((row, i) => {
    const id = key(row);
    if (map.has(id)) invalid(`${path}[${i}].${field}`, `duplicate id ${id}`);
    map.set(id, row);
  });
  return map;
}
export function reference(
  known: { has(id: string): boolean },
  id: string,
  path: string,
) {
  if (!known.has(id)) invalid(path, `unknown id ${id}`);
}
export function keys(
  known: { has(id: string): boolean },
  obj: object,
  path: string,
) {
  for (const k of Object.keys(obj)) reference(known, k, `${path}.${k}`);
}
export function refs(
  known: { has(id: string): boolean },
  values: readonly string[],
  path: string,
) {
  values.forEach((id, i) => reference(known, id, `${path}[${i}]`));
}
export function catalogIds(
  ids: string[],
  known: ReadonlyMap<string, unknown>,
  field: string,
) {
  const p = `catalogDefinitions.json.${field}`;
  refs(known, ids, p);
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (seen.has(id)) invalid(`${p}[${i}]`, `duplicate id ${id}`);
    seen.add(id);
  });
  for (const id of known.keys())
    if (!seen.has(id)) invalid(p, `missing id ${id}`);
}
