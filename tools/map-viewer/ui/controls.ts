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
  slider.ariaLabel = label + "滑块";
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
  reset.title = "恢复磁盘基准";
  reset.ariaLabel = "复原" + label;
  reset.disabled = base === value || (base === undefined && valueAt(s.store.draft[file], path) === undefined);
  r.dataset.field = JSON.stringify([file, ...path]);
  r.append(reset);
}
const labels: Record<string, string> = {
  maxHp: "生命上限",
  attackDamage: "攻击伤害",
  moveSpeedPxPerSec: "移速（像素/秒）",
  windupSec: "前摇（秒）",
  dashDurationSec: "突进时长（秒）",
  recoverSec: "后摇（秒）",
  recoverySec: "后摇（秒）",
  cooldownSec: "攻击间隔（秒）",
  intervalSec: "循环间隔（秒）",
  activeSec: "判定时长（秒）",
  travelSec: "冲锋时长（秒）",
  triggerTiles: "起攻距离（格）",
  triggerRangeTiles: "触发范围（格）",
  preferredTiles: "施法距离（格）",
  distanceTiles: "突进距离（格）",
  reachTiles: "近战范围（格）",
  rangeTiles: "横扫范围（格）",
  arcDegrees: "扇形角度（°）",
  radiusTiles: "爆发半径（格）",
  projectileSpeedPxPerSec: "弹速（像素/秒）",
  projectileLifetimeSec: "弹道寿命（秒）",
  hpThreshold: "阶段生命比例",
  maxHpDelta: "生命修正",
  attackDamageDelta: "伤害修正",
  moveSpeedMult: "移速倍率",
  lightDrainMult: "耗光倍率",
  lightRadiusMult: "光圈倍率",
  immunityBonusSec: "额外无敌（秒）",
  healBonus: "额外治疗",
  inFireRegenMult: "火圈恢复倍率",
  attackRangeTiles: "攻击半径（格）",
  attackArcDegrees: "攻击角度（°）",
  attackCooldownSec: "攻击间隔（秒）",
  damageImmunitySec: "受伤无敌（秒）",
  dayDrainPerMinute: "白天饱食消耗/分",
  nightDrainPerMinute: "夜间饱食消耗/分",
  nightDrainPerSec: "夜间耗光/秒",
  initial: "初始值",
  max: "上限",
  inFireRegenPerSec: "火圈恢复/秒",
  zeroDamage: "耗尽伤害",
  zeroDamageIntervalSec: "耗尽伤害间隔（秒）",
  count: "数量",
  probability: "掉率",
  lightDamage: "耗光伤害",
  hpRatioAtOrBelow: "狂暴生命比例",
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
          ({ moves: "招式", enrage: "狂暴", attack: "攻击", overrides: "阶段修正" } as Record<string, string>)[key] ??
            (Number.isInteger(Number(key)) ? "第 " + (Number(key) + 1) + " 项" : key),
        ),
        s,
        file,
        next,
      );
  }
}
