import type { Session } from "../state/selection";
import { button, choice, el, group, itemOptions, numeric } from "../ui/controls";
import { scenarioDefaults, survivalDefaults } from "../state/ruleConfig";
export function rulePanel(root: HTMLElement, s: Session) {
  const limits = group(root, "同屏上限");
  numeric(limits, s, "balance.json", ["limits", "activeEnemies"], "活跃敌人");
  numeric(limits, s, "balance.json", ["limits", "activeProjectiles"], "弹幕数量");
  const regions = s.store.draft["regions.json"];
  const renew = group(root, "黎明再生物资");
  regions.dawnRenewal.renewableItemIds.forEach((id, i) => {
    const selected = choice(renew, "再生物资 " + (i + 1), itemOptions, id, (v) =>
      s.store.field("regions.json", ["dawnRenewal", "renewableItemIds", i], v),
    );
    selected.parentElement?.append(
      button("−", () =>
        s.store.edit("regions.json", (doc) => {
          doc.dawnRenewal.renewableItemIds.splice(i, 1);
        }),
      ),
    );
  });
  renew.append(
    button("添加再生物资", () => {
      const next = itemOptions.find(([id]) => !regions.dawnRenewal.renewableItemIds.includes(id));
      if (next)
        s.store.edit("regions.json", (doc) => {
          doc.dawnRenewal.renewableItemIds.push(next[0]);
        });
    }),
  );
  const night = group(root, "区域夜间刷怪", false);
  for (const [i, r] of regions.regions.entries()) {
    if (!r.nightSpawns.length) continue;
    const box = group(night, r.name, false);
    r.nightSpawns.forEach((p, j) =>
      choice(
        box,
        p.spawnId,
        s.store.draft["enemies.json"].enemies.map((e) => [e.id, e.name]),
        p.enemyId,
        (v) => s.store.field("regions.json", ["regions", i, "nightSpawns", j, "enemyId"], v),
      ),
    );
  }
  const scenario = group(root, "夜袭与再生");
  scenario.append(el("p", "默认黄昏一波，再生物资黎明刷新、次数不限。填写冷却后按游戏秒数刷新。"));
  const labels: Record<string, string> = {
    intervalSec: "夜袭间隔（秒）",
    count: "波次数量",
    renewalLimit: "每点再生次数上限",
    cooldownSec: "刷新冷却（秒）",
    aggroTiles: "索敌预览（格）",
    leashTiles: "脱战预览（格）",
  };
  for (const key of ["waves", "resources", "perception"] as const)
    for (const [k, v] of Object.entries(scenarioDefaults[key]))
      numeric(scenario, s, "encounters.json", [key, k], labels[k], v);
  const weights = group(scenario, "区域遭遇权重", false);
  for (const r of regions.regions) numeric(weights, s, "encounters.json", ["weights", r.id], r.name, 1);
  if (s.mode === "survival") {
    const survival = group(root, "生存模式 · 独立覆盖配置");
    survival.append(el("p", "落盘到 public/survival-balance.json，刷新生存页后生效，初始补给仅用于新世界。"));
    for (const [k, v] of Object.entries(survivalDefaults))
      numeric(
        survival,
        s,
        "survival-balance.json",
        [k],
        (
          {
            resourceDensity: "资源密度",
            spawnFrequency: "刷怪频率",
            startingSupplyMultiplier: "初始补给倍率",
          } as Record<string, string>
        )[k],
        v,
      );
  }
}
