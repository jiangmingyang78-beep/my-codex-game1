import items from "@/data/items.json";
import type { Session } from "../state/selection";
import { type FileKey, type Path, put, valueAt } from "../state/documents";
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
export const itemOptions = items.items.map((i) => [i.id, i.name] as const);
export function button(label: string, action: () => void) {
  const b = el("button", label);
  b.type = "button";
  b.onclick = action;
  return b;
}
const opened = new Map<string, boolean>();
export function group(root: HTMLElement, title: string, open = true) {
  const d = el("details");
  d.open = opened.get(title) ?? open;
  d.ontoggle = () => {
    if (d.isConnected) opened.set(title, d.open);
  };
  d.append(el("summary", title));
  const box = el("div", "", "group-body");
  d.append(box);
  root.append(d);
  return box;
}
export function row(root: HTMLElement, label: string) {
  const r = el("div", "", "field");
  r.append(el("span", label));
  root.append(r);
  return r;
}
export function choice(
  root: HTMLElement,
  label: string,
  opts: readonly (readonly [string, string])[],
  value: string,
  change: (value: string) => void,
) {
  const r = row(root, label),
    select = el("select");
  select.ariaLabel = label;
  for (const [id, name] of opts) {
    const option = el("option", name);
    option.value = id;
    select.append(option);
  }
  select.value = value;
  select.onchange = () => change(select.value);
  r.append(select);
  return select;
}
export function numberBox(root: HTMLElement, label: string, value: number, change: (n: number) => void, step = "any") {
  const r = row(root, label),
    input = el("input");
  input.type = "number";
  input.step = step;
  input.value = String(value);
  input.ariaLabel = label;
  input.onchange = () => {
    if (Number.isFinite(input.valueAsNumber)) change(input.valueAsNumber);
    else input.value = String(value);
  };
  r.append(input);
  return r;
}
export function numeric(
  root: HTMLElement,
  s: Session,
  file: FileKey,
  path: Path,
  label: string,
  defaultValue?: number,
) {
  const value = Number(valueAt(s.store.draft[file], path) ?? defaultValue);
  const base = valueAt(s.store.baseline[file], path);
  const step =
    /count|yield|activeEnemies|activeProjectiles|maxHp|attackDamage|Degrees|radiiTilesByLevel|Inventory|^.*\.hp\.(max|initial)$/i.test(
      path.join("."),
    )
      ? "1"
      : "0.01";
  const commit = (n: number) => {
    if (defaultValue !== undefined && valueAt(s.store.draft[file], path.slice(0, -1)) === undefined)
      s.store.field(file, path.slice(0, -1), { [path.at(-1)!]: n });
    else s.store.field(file, path, n);
  };
  const r = numberBox(root, label, value, commit, step);
  const slider = el("input");
  slider.type = "range";
  slider.min = String(Math.min(0, value, path.at(-1) === "maxHpDelta" ? -6 : 0));
  slider.max = String(
    path.at(-1) === "probability" ? 1 : Math.max(step === "1" ? 10 : 2, value * 2, Number(base ?? 0) * 2),
  );
  slider.step = step;
  slider.value = String(value);
  slider.ariaLabel = label + "Slider";
  const number = r.querySelector("input")!;
  let original: typeof s.store.draft | undefined;
  slider.oninput = () => {
    original ??= s.store.draft;
    const doc = structuredClone(original[file]);
    if (defaultValue !== undefined && valueAt(doc, path.slice(0, -1)) === undefined)
      put(doc, path.slice(0, -1), { [path.at(-1)!]: slider.valueAsNumber });
    else put(doc, path, slider.valueAsNumber);
    s.store.draft = { ...original, [file]: doc };
    number.value = slider.value;
    s.store.dispatchEvent(new Event("preview"));
  };
  const finish = () => {
    if (original) {
      s.store.draft = original;
      original = undefined;
      commit(slider.valueAsNumber);
    }
  };
  slider.onchange = finish;
  slider.onblur = finish;
  r.insertBefore(slider, number);
  const reset = button("↺", () => s.store.reset(file, path));
  reset.title = "Restore disk base";
  reset.ariaLabel = "Recovery" + label;
  reset.disabled = base === value || (base === undefined && valueAt(s.store.draft[file], path) === undefined);
  r.dataset.field = JSON.stringify([file, ...path]);
  r.append(reset);
}
const labels: Record<string, string> = {
  maxHp: "Life cap",
  attackDamage: "Attack injury",
  moveSpeedPxPerSec: "Speeds of movement (pixels/sec))",
  windupSec: "Shake ahead (sec))",
  dashDurationSec: "Break-in time (seconds))",
  recoverSec: "Backslide (seconds))",
  recoverySec: "Backslide (seconds))",
  cooldownSec: "Attack interval (seconds))",
  intervalSec: "Cycle interval (seconds))",
  activeSec: "Determines the duration (sec))",
  travelSec: "Long-time assault (seconds))",
  triggerTiles: "- Get out of there)",
  triggerRangeTiles: "Trigger range (g))",
  preferredTiles: "- Pass the distance)",
  distanceTiles: "- A stump distance)",
  reachTiles: "Near-war range (g))",
  rangeTiles: "(e) Scattered range (g))",
  arcDegrees: "Sector angle (°))",
  radiusTiles: "Radius (g))",
  projectileSpeedPxPerSec: "Speed of bounce (pixels/sec))",
  projectileLifetimeSec: "Ballistic lifetime (sec))",
  hpThreshold: "Life-cycle ratio",
  maxHpDelta: "Life fixation",
  attackDamageDelta: "Harm correction",
  moveSpeedMult: "Move rate multiple",
  lightDrainMult: "Torch drain multiplier",
  lightRadiusMult: "Halo multiplier",
  immunityBonusSec: "Additional invincible (seconds))",
  healBonus: "Additional treatment",
  inFireRegenMult: "The ring is back to double",
  attackRangeTiles: "(g) A radius of attack)",
  attackArcDegrees: "Angle of attack (°))",
  attackCooldownSec: "Attack interval (seconds))",
  damageImmunitySec: "Invincible injury (seconds))",
  dayDrainPerMinute: "Full consumption/points during the day",
  nightDrainPerMinute: "(c) Saturation/scores at night",
  nightDrainPerSec: "The night is spent with light/seconds",
  initial: "Initial value",
  max: "Upper limit",
  inFireRegenPerSec: "Fire ring recovery/sec",
  zeroDamage: "Exhausted injury",
  zeroDamageIntervalSec: "Exhaustion of injury interval (sec))",
  count: "Quantity",
  probability: "The rate of loss",
  lightDamage: "The emptiness of the injury",
  hpRatioAtOrBelow: "The violent life ratio",
};
export function numbers(root: HTMLElement, s: Session, file: FileKey, path: Path) {
  const obj = valueAt(s.store.draft[file], path);
  if (!obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj)) {
    const next = [...path, key];
    if (typeof val === "number") numeric(root, s, file, next, labels[key] ?? key);
    else if (val && typeof val === "object" && !(Array.isArray(val) && val.every((v) => typeof v === "string")))
      numbers(
        group(
          root,
          ({ moves: "Motion", enrage: "- Violent", attack: "Attack", overrides: "Phase amendments" } as Record<string, string>)[key] ??
            (Number.isInteger(Number(key)) ? "No. No " + (Number(key) + 1) + " Item" : key),
        ),
        s,
        file,
        next,
      );
  }
}
