import type { Session } from "../state/selection";
import { button, choice, el, group, itemOptions, numeric } from "../ui/controls";
import { scenarioDefaults, survivalDefaults } from "../state/ruleConfig";
export function rulePanel(root: HTMLElement, s: Session) {
  const limits = group(root, "Same screen ceiling");
  numeric(limits, s, "balance.json", ["limits", "activeEnemies"], "Active enemy");
  numeric(limits, s, "balance.json", ["limits", "activeProjectiles"], "Number of screens");
  const regions = s.store.draft["regions.json"];
  const renew = group(root, "Dawn regenerative");
  regions.dawnRenewal.renewableItemIds.forEach((id, i) => {
    const selected = choice(renew, "Regeneration " + (i + 1), itemOptions, id, (v) =>
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
    button("Adds regenerative materials", () => {
      const next = itemOptions.find(([id]) => !regions.dawnRenewal.renewableItemIds.includes(id));
      if (next)
        s.store.edit("regions.json", (doc) => {
          doc.dawnRenewal.renewableItemIds.push(next[0]);
        });
    }),
  );
  const night = group(root, "Area night brush", false);
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
  const scenario = group(root, "Night raids with regeneration");
  scenario.append(el("p", "Defaults to a wave of dusk, with regenerative materials refreshed at dawn and with unlimited frequency. refresh by the number of seconds of the game after filling in the cooling."));
  const labels: Record<string, string> = {
    intervalSec: "Night raids interval (seconds))",
    count: "Number of waves",
    renewalLimit: "Maximum number of rebirths per point",
    cooldownSec: "Refresh cooling (seconds))",
    aggroTiles: "Enemy preview (g))",
    leashTiles: "Ex-war preview (g))",
  };
  for (const key of ["waves", "resources", "perception"] as const)
    for (const [k, v] of Object.entries(scenarioDefaults[key]))
      numeric(scenario, s, "encounters.json", [key, k], labels[k], v);
  const weights = group(scenario, "The region is hit by weights", false);
  for (const r of regions.regions) numeric(weights, s, "encounters.json", ["weights", r.id], r.name, 1);
  if (s.mode === "survival") {
    const survival = group(root, "Survival mode. Independent coverage configuration");
    survival.append(el("p", "The drop is on `supplier'/survival-e.json, which is effective when the life page is updated and the initial supply is used only for the new world."));
    for (const [k, v] of Object.entries(survivalDefaults)) {
      if(typeof v==="object"){
        for(const [category,cap] of Object.entries(v)) numeric(survival,s,"survival-balance.json",[k,category],({hostile:"Regular hostiles",elite:"Elite",neutral:"Neutral wildlife"} as Record<string,string>)[category]+"Population cap",cap);
        continue;
      }
      numeric(
        survival,
        s,
        "survival-balance.json",
        [k],
        (
          {
            brightCost:"The cost of a strong light bypass",fireCost:"Fire-circumstance cost",hearingTiles:"Hearing distance (g))",
            dayDurationMultiplier: "The day is long and the day is long",
            nightDurationMultiplier: "The night is a long time",
            fuelConsumptionMultiplier: "The rate of coal combustion from the camp fires",
            coldHungerPerSecond: "Snowstorms are fed by cold (points/seconds))",
            hungerRateMultiplier: "Hunger rate multiple",
            spawnDensity: "The density of each wave of enemy",
            resourceRefreshMultiplier: "The rate of regeneration of wildlife resources",
            resourceDensity: "Resource density",
            minSpawnRadius:"Near ring (g))", maxSpawnRadius:"External rings (g))", despawnRadius:"Recovery distance (g))",
            spawnFrequency: "-Fresh the frequency",
            startingSupplyMultiplier: "Initial replenishment multiplier",
          } as Record<string, string>
        )[k],
        v,
      );
    }
  }
}
