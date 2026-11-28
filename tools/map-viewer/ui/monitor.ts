import { enemyMetrics, heroMetrics } from "../state/derivedMetrics";
import type { Session } from "../state/selection";
import { el } from "./controls";
export function monitor(s: Session) {
  const root = document.getElementById("monitor");
  if (!root) return;
  const compute = (d: typeof s.store.draft) =>
    s.tab === "hero" ? heroMetrics(d, s.heroId) : enemyMetrics(d, s.enemyId, s.heroId);
  const before = compute(s.store.baseline) as Record<string, string>;
  root.replaceChildren(
    el("h3", "Real-time indicators"),
    ...Object.entries(compute(s.store.draft)).map(([label, value]) => {
      const r = el("div", "", "metric");
      r.append(
        el("span", label),
        el(
          "output",
          before[label] === value ? value : before[label] + " → " + value,
          before[label] === value ? "" : "changed",
        ),
      );
      return r;
    }),
  );
}
