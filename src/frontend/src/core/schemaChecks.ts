export type Check = (value: unknown, path: string) => void;

export function invalid(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}
export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(path, "expected an object");
  return value as Record<string, unknown>;
}
export const string: Check = (v, p) => {
  if (typeof v !== "string" || !v.trim())
    invalid(p, "expected a nonempty string");
};
export const boolean: Check = (v, p) => {
  if (typeof v !== "boolean") invalid(p, "expected a boolean");
};
export function number(
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  integer = false,
): Check {
  return (v, p) => {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (integer && !Number.isSafeInteger(v))
    )
      invalid(
        p,
        `expected a finite ${integer ? "integer" : "number"} in [${min}, ${max}]`,
      );
  };
}
export const positive = number(Number.MIN_VALUE);
export const nonnegative = number(0);
export const count = number(1, Number.POSITIVE_INFINITY, true);
export const natural = number(0, Number.POSITIVE_INFINITY, true);
export const ratio = number(0, 1);
export const optional =
  (check: Check): Check =>
  (v, p) => {
    if (v !== undefined) check(v, p);
  };
export const nullable =
  (check: Check): Check =>
  (v, p) => {
    if (v !== null) check(v, p);
  };
export function list(
  check: Check,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): Check {
  return (v, p) => {
    if (!Array.isArray(v) || v.length < min || v.length > max)
      invalid(p, "invalid array or length");
    v.forEach((entry, i) => check(entry, `${p}[${i}]`));
  };
}
export function dict(check: Check): Check {
  return (v, p) => {
    for (const [k, entry] of Object.entries(record(v, p)))
      check(entry, `${p}.${k}`);
  };
}
export function oneOf(...choices: string[]): Check {
  return (v, p) => {
    if (typeof v !== "string" || !choices.includes(v))
      invalid(p, `expected one of ${choices.join(", ")}`);
  };
}
export function fields(names: string, check: Check): Record<string, Check> {
  return Object.fromEntries(names.split(" ").map((k) => [k, check]));
}
export function shape(fields: Record<string, Check>): Check {
  return (v, p) => {
    const obj = record(v, p);
    for (const [k, check] of Object.entries(fields)) check(obj[k], `${p}.${k}`);
    for (const k of Object.keys(obj))
      if (!Object.hasOwn(fields, k)) invalid(`${p}.${k}`, "unknown field");
  };
}
export function variant(
  key: string,
  branches: Record<string, Record<string, Check>>,
): Check {
  return (v, p) => {
    const kind = record(v, p)[key];
    if (typeof kind !== "string" || !Object.hasOwn(branches, kind))
      invalid(`${p}.${key}`, `unknown variant ${kind}`);
    shape({ [key]: string, ...branches[kind] })(v, p);
  };
}
