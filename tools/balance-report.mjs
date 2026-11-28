import {resolveSurvivalTuning,survivalRates} from "../src/frontend/src/systems/survivalOverrides.js";
import { winterDay, raidBudget, raidRules, winter } from "../src/frontend/src/systems/survival/rhythm.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src", "frontend", "src", "data");
const LAYOUT_PATH = path.join(ROOT, "src", "frontend", "src", "systems", "world", "worldLayout.ts");
const REPORT_PATH = path.join(ROOT, "docs", "BALANCE_REPORT.md");
const PLAYTEST_PATH = path.join(ROOT, "docs", "BALANCE_PLAYTEST.md");
const SUMMARY_ONLY = process.argv.includes("--summary");
const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function readJson(fileName) {
  const full = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(full)) return null;
  try { return JSON.parse(fs.readFileSync(full, "utf8")); }
  catch (err) { console.warn(c.yellow(`[warn] Could not parse ${fileName}: ${err.message}`)); return null; }
}

function extractBalanced(src, startIdx, openCh, closeCh) {
  let depth = 0, str = null, begin = -1;
  for (let i = startIdx; i < src.length; i += 1) {
    const ch = src[i];
    if (str) { if (ch === "\\" && i + 1 < src.length) i += 1; else if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { str = ch; continue; }
    if (ch === openCh) { if (depth === 0) begin = i; depth += 1; }
    else if (ch === closeCh && --depth === 0 && begin !== -1) {
      return { body: src.slice(begin + 1, i), full: src.slice(begin, i + 1), end: i };
    }
  }
  return { body: "", full: "", end: src.length };
}

function splitTopObjects(body) {
  const out = [];
  for (let i = 0, str = null; i < body.length; i += 1) {
    const ch = body[i];
    if (str) { if (ch === "\\" && i + 1 < src.length) i += 1; else if (ch === str) str = null; }
    else if (ch === '"' || ch === "'" || ch === "`") str = ch;
    else if (ch === "{") { const obj = extractBalanced(body, i, "{", "}"); out.push(obj.full); i = obj.end; }
  }
  return out;
}

function parseWorldLayout(filePath) {
  if (!fs.existsSync(filePath)) return { renewableWoodTiles: new Set(), spawns: new Set(), regions: [] };
  const raw = fs.readFileSync(filePath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const anchor = (src, re, o, cl) => { const m = re.exec(src); return m ? extractBalanced(src, m.index + m[0].length - 1, o, cl) : { body: "", full: "" }; };
  const layout = anchor(raw, /export\s+const\s+WORLD_LAYOUT[\s\S]*?=\s*\{/, "{", "}").full;
  const woodBody = anchor(layout, /\brenewableWoodTiles\s*:\s*\{/, "{", "}").body;
  const spawnsBody = anchor(layout, /\bspawns\s*:\s*\{/, "{", "}").body;
  const regionsBody = anchor(layout, /\bregions\s*:\s*\[/, "[", "]").body;
  const pointIds = (body) => new Set(
    [...body.matchAll(/([A-Za-z0-9_]+)\s*:\s*(?:pt\s*\(|\{)/g)].map((match) => match[1]),
  );
  const renewableWoodTiles = pointIds(woodBody);
  const spawns = pointIds(spawnsBody);
  const regions = splitTopObjects(regionsBody).map((txt) => {
    const id = txt.match(/\bbounds\s*:\s*\{[^}]*\bid\s*:\s*["']([^"']+)["']/)?.[1] || "unknown";
    const nodesBody = /\bnodes\s*:\s*\[/.test(txt) ? anchor(txt, /\bnodes\s*:\s*\[/, "[", "]").body : "";
    const nodes = splitTopObjects(nodesBody).map((n) => ({
      idPrefix: n.match(/\bidPrefix\s*:\s*["']([^"']+)["']/)?.[1] || "",
      itemId: n.match(/\bitemId\s*:\s*["']([^"']+)["']/)?.[1] || "",
      count: Number(n.match(/\bcount\s*:\s*(\d+)/)?.[1] || 0),
      yield: Number(n.match(/\byield\s*:\s*(\d+)/)?.[1] || 0),
    }));
    for (const [, idPrefix, itemId, count, amount] of nodesBody.matchAll(
      /\bnode\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/g,
    )) {
      nodes.push({ idPrefix, itemId, count: Number(count), yield: Number(amount) });
    }
    return { id, nodes, hasRelay: /\brelay\s*:/.test(txt) };
  });
  return { renewableWoodTiles, spawns, regions };
}

const effVal = (item, type, stat) => Number(item?.effects?.find((e) => e.type === type && e.stat === stat)?.value || 0);
const mdTable = (headers, rows) => {
  const esc = (v) => String(v).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return [`| ${headers.map(esc).join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
};

function attackCycle(seedType, atk) {
  if (!atk) return 1.5;
  if (seedType === "lunge" || atk.type === "lunge") return atk.windupSec + atk.dashDurationSec + atk.recoverSec;
  if (seedType === "stalk_melee" || atk.type === "melee" || seedType === "ranged_telegraph") return atk.windupSec + atk.cooldownSec;
  if (atk.type === "projectile") return atk.windupSec + atk.recoverySec + atk.intervalSec;
  if (atk.type === "charge") return atk.windupSec + atk.travelSec + atk.recoverySec + atk.intervalSec;
  if (atk.type === "sweep") return atk.windupSec + atk.activeSec + atk.recoverySec + atk.intervalSec;
  if (atk.type === "alternating") {
    const avgMove = atk.moves.reduce((s, m) => s + m.windupSec + (m.travelSec ?? m.activeSec ?? 0) + m.recoverySec, 0) / atk.moves.length;
    return avgMove + (atk.enrage ? 0.5 * (atk.intervalSec + atk.enrage.intervalSec) : atk.intervalSec);
  }
  return 1.5;
}

function calcThreat(e, heroSpeed) {
  let dmg = e.attackDamage, spd = e.moveSpeedPxPerSec, aps = 0, cyc = "";
  if (Array.isArray(e.phases) && e.phases.length) {
    const ps = [...e.phases].sort((a, b) => b.hpThreshold - a.hpThreshold);
    let wD = 0, wS = 0, wC = 0;
    for (let i = 0; i < ps.length; i += 1) {
      const w = ps[i].hpThreshold - (ps[i + 1]?.hpThreshold ?? 0), ov = ps[i].overrides || {};
      const cSec = attackCycle(ps[i].seedType, ov.attack || e.attack);
      wD += (ov.attackDamage ?? e.attackDamage) * w; wS += (ov.moveSpeedPxPerSec ?? e.moveSpeedPxPerSec) * w;
      aps += (1 / cSec) * w; wC += cSec * w;
    }
    dmg = wD; spd = wS; cyc = `${wC.toFixed(2)} (weighted)`;
  } else {
    const cSec = attackCycle(e.seedType || e.attack?.type, e.attack);
    aps = 1 / cSec; cyc = cSec.toFixed(2);
  }
  const score = e.maxHp * dmg * aps * (0.6 + 0.4 * (spd / heroSpeed));
  const credits = Math.max(10, Math.round((score * 10) / 5) * 5);
  const tier = score >= 20 ? "T4 Boss" : score >= 6.5 ? "T3 Elite" : score >= 2.5 ? "T2 Medium" : "T1 Light";
  return { dmg, spd, aps, cyc, score, credits, tier };
}

function main() {
  const balance = readJson("balance.json") || { hero: { attackDamage: 1, attackCooldownSec: 0.42, moveSpeedPxPerSec: 80, quickUseItemIds: [] }, stats: { hp: { max: 6 } } };
  const itemsData = readJson("items.json") || { items: [] };
  const recipesData = readJson("recipes.json") || { recipes: [] };
  const enemiesData = readJson("enemies.json") || { enemies: [] };

  const regionsData = readJson("regions.json") || { regions: [], dawnRenewal: { renewableItemIds: [] } };
  const heroesData = readJson("heroes.json"), plantsData = readJson("plants.json"), catalogData = readJson("catalogDefinitions.json");
  const layout = parseWorldLayout(LAYOUT_PATH);

  const itemsMap = new Map(itemsData.items.map((x) => [x.id, x]));
  const allEnemies = enemiesData.enemies.map(e => ({...e, _src: e.seedType ? "current" : "legacy"}));
  const spawnCounts = new Map();
  for (const reg of regionsData.regions) {
    const activeReg = layout.regions.some((r) => r.id === reg.id);
    for (const key of ["residentSpawns", "nightSpawns"]) {
      for (const sp of reg[key] || []) {
        const cur = spawnCounts.get(sp.enemyId) || { res: 0, night: 0 };
        if (activeReg && layout.spawns.has(sp.spawnId)) cur[key === "residentSpawns" ? "res" : "night"] += 1;
        spawnCounts.set(sp.enemyId, cur);
      }
    }
  }

  const resolved = process.env.CONSOLE_REPORT === "1" ? JSON.parse(fs.readFileSync(0, "utf8")) : null;
  if (resolved) {
    spawnCounts.clear();
    for (const s of resolved.spawns.filter(s => s.enemyId)) {
      const count = spawnCounts.get(s.enemyId) || { res: 0, night: 0 };
      count[s.kind === "night" ? "night" : "res"]++;
      spawnCounts.set(s.enemyId, count);
    }
  }
  const baseDmg = balance.hero.attackDamage, cd = balance.hero.attackCooldownSec, baseHp = balance.stats.hp.max;
  const spearDmg = effVal(itemsMap.get("iron_spear"), "set_combat_stat", "attackDamage") || 2;
  const bladeBonus = effVal(itemsMap.get("iron_blade"), "add_owned_stat", "attackDamage") || 2;
  const galeDmg = heroesData?.heroes?.find((h) => h.id === "gale_smith")?.traits?.attackDamageDelta ?? 1;
  const armorHp = effVal(itemsMap.get("iron_armor"), "add_owned_stat", "maxHp") || 2;
  const armorDr = effVal(itemsMap.get("iron_armor"), "add_owned_stat", "damageReduction") || 1;
  const helmHp = effVal(itemsMap.get("iron_helm"), "add_owned_stat", "maxHp") || 2;
  const profiles = [["Unarmed", baseDmg], ["Iron Spear", spearDmg], ["Charcoal-Tempered Blade", baseDmg + bladeBonus], ["Gale unarmed", baseDmg + galeDmg], ["Gale with spear", spearDmg + galeDmg], ["Gale with blade", baseDmg + bladeBonus + galeDmg], ["Gale with both weapons", spearDmg + bladeBonus + galeDmg]];
  const combatHeaders = ["Enemy", "Source/region", "HP", "Enemy damage", ...profiles.map(([n, d]) => `${n} (${d})`), `${baseHp} HP, unarmored`, `Breastplate (${baseHp + armorHp} HP, ${armorDr} damage reduction)`, `Heavy helm (${baseHp + helmHp} HP)`, `Breastplate + helm (${baseHp + armorHp + helmHp} HP, ${armorDr} damage reduction)`];
  const combatRows = allEnemies.map((e) => {
    const peak = Math.max(e.attackDamage, ...(e.phases || []).map((p) => p.overrides?.attackDamage ?? 0));
    const dmgTxt = peak === e.attackDamage ? `${e.attackDamage}` : `${e.attackDamage} (P3:${peak})`;
    const tank = (hp, dr) => { const h1 = Math.ceil(hp / Math.max(1, e.attackDamage - dr)), h2 = Math.ceil(hp / Math.max(1, peak - dr)); return peak === e.attackDamage ? `${h1} hits` : `${h1} hits (P3: ${h2})`; };
    const ttk = (d) => { const k = Math.ceil(e.maxHp / d); return `${k} hits (${((k - 1) * cd).toFixed(2)}s)`; };
    return [e.name, `${e._src === "legacy" ? "Previous version · " : ""}${e.regionIds.join("/")}`, e.maxHp, dmgTxt, ...profiles.map(([, d]) => ttk(d)), tank(baseHp, 0), tank(baseHp + armorHp, armorDr), tank(baseHp + helmHp, 0), tank(baseHp + armorHp + helmHp, armorDr)];
  });

  const coreIds = ["ingot", "ore", "iron_scrap", "charcoal", "herb", "fiber"];
  const activeRelays = layout.regions.filter((r) => r.hasRelay).length || 1;
  const renewSet = new Set(regionsData.dawnRenewal?.renewableItemIds || []);
  const fixedMap = new Map();
  for (const r of layout.regions) for (const n of r.nodes) {
    const cur = fixedMap.get(n.itemId) || { total: 0, byReg: new Map() };
    cur.total += n.count * n.yield; cur.byReg.set(r.id, (cur.byReg.get(r.id) || 0) + n.count * n.yield); fixedMap.set(n.itemId, cur);
  }
  if (resolved) {
    fixedMap.clear();
    for (const n of resolved.objects.filter(n => n.itemId)) {
      const cur = fixedMap.get(n.itemId) || { total: 0, byReg: new Map() };
      cur.total += n.yield; cur.byReg.set(n.regionId, (cur.byReg.get(n.regionId) || 0) + n.yield);
      fixedMap.set(n.itemId, cur);
    }
  }
  const econRows = coreIds.map((id) => {
    let uniq = 0, rep = 0; const uParts = [], rParts = [];
    for (const r of recipesData.recipes) {
      const q = r.inputs?.[id] || 0; if (!q) continue;
      if (r.constraints?.uniqueOutput || r.constraints?.exactCampLevel != null || r.constraints?.inventoryCapSource) {
        const mult = r.constraints?.inventoryCapSource === "unlit_relay_socket_count" ? activeRelays : 1;
        uniq += q * mult; uParts.push(`${r.name}(${q}${mult > 1 ? `×${mult}` : ""})`);
      } else { rep += q; rParts.push(`${r.name}(${q})`); }
    }
    const fix = fixedMap.get(id) || { total: 0, byReg: new Map() };
    const fixTxt = fix.total > 0 ? `${fix.total} (${[...fix.byReg].map(([k, v]) => `${k}:${v}`).join(", ")})` : "0";
    const dropNotes = allEnemies.flatMap((e) => (e.drops || []).filter((d) => d.itemId === id).map((d) => {
      const sp = spawnCounts.get(e.id) || { res: 0, night: 0 };
      return sp.res + sp.night > 0 ? `${e.name} [${sp.res} resident / ${sp.night} night], mean ${((d.count ?? 1) * d.probability).toFixed(2)}` : null;
    })).filter(Boolean);
    const activeExp = allEnemies.reduce((sum, e) => { const sp = spawnCounts.get(e.id); return (!sp || !sp.res) ? sum : sum + (e.drops || []).filter((d) => d.itemId === id).reduce((a, d) => a + (d.count ?? 1) * d.probability * sp.res, 0); }, 0);
    const heroStarts = (heroesData?.heroes || []).filter((h) => h.startingInventory?.[id] > 0).map((h) => `${h.name}×${h.startingInventory[id]}`);
    const other = [dropNotes.length ? `Active drops: ${dropNotes.join(", ")}` : "", heroStarts.length ? `Starting inventory: ${heroStarts.join("/")}` : ""].filter(Boolean).join(" · ") || "Recipes / Survival";
    let diag = "Balanced";
    if (id === "ingot") diag = `Tight supply. Fixed ore yields at most ${Math.floor((fixedMap.get("ore")?.total || 0) / 2)} ingots, and unique and progression recipes need ${uniq}.`;
    else if (id === "ore") diag = `Fixed deposits yield ${fix.total} ore. See the ingot row for total demand.`;
    else if (id === "iron_scrap" || id === "charcoal") diag = `Fixed yield ${fix.total}, unique and progression demand ${uniq}, expected resident drops ${activeExp.toFixed(2)}.`;
    else if (id === "fiber") diag = `Ample supply. The starting region yields ${fix.total}, renewed at dawn. Unique demand is ${uniq}.`;
    return [`${itemsMap.get(id)?.name || id} (${id})`, uniq ? `${uniq} (${uParts.join("+")})` : "0", rep ? `${rep} (${rParts.join("+")})` : "0", uniq + rep, fixTxt, renewSet.has(id) ? "Yes" : "No", other, diag];
  });

  const heroSpeed = balance.hero.moveSpeedPxPerSec;
  const threatList = allEnemies.map((e) => ({ e, m: calcThreat(e, heroSpeed), sp: spawnCounts.get(e.id) || { res: 0, night: 0 } })).sort((a, b) => b.m.score - a.m.score);
  const threatRows = threatList.map(({ e, m, sp }) => [
    `${e.name} (${e.id})`, `${e._src === "legacy" ? "legacy" : e.scope} (${e.regionIds.join("/")})`, e.seedType || e.attack?.type || "-",
    e.maxHp, m.dmg.toFixed(2).replace(/\.00$/, ""), m.cyc, m.aps.toFixed(2), `${m.spd.toFixed(0)} (${((m.spd / heroSpeed) * 100).toFixed(0)}%)`,
    m.score.toFixed(2), m.tier, m.credits,
    [e.scope === "adventure_only" ? "Adventure boss" : "", e._src === "legacy" && sp.res + sp.night === 0 ? "Not placed on the current map" : "", m.spd > heroSpeed ? "Faster than the hero" : "", sp.res + sp.night > 0 ? `${sp.res} resident / ${sp.night} night` : ""].filter(Boolean).join(" · ") || "-",
  ]);

  const alerts = [];
  const addAlert = (cat, sev, target, detail) => alerts.push({ cat, sev, target, detail });
  const nodeItems = new Set(layout.regions.flatMap((r) => r.nodes.map((n) => n.itemId)));
  if (layout.renewableWoodTiles.size) nodeItems.add("wood");
  const recipeOut = new Set(recipesData.recipes.filter((r) => r.output?.type === "item").map((r) => r.output.id));
  const activeDropItems = new Set(allEnemies.filter((e) => { const s = spawnCounts.get(e.id); return s && s.res + s.night > 0; }).flatMap((e) => (e.drops || []).map((d) => d.itemId)));
  const legacyDropItems = new Set([...allEnemies.flatMap((e) => e.drops || []), ...(enemiesData.encounterRewards || []).flatMap((r) => r.drops || [])].map((d) => d.itemId));
  const heroItems = new Set((heroesData?.heroes || []).flatMap((h) => Object.keys(h.startingInventory || {})));
  const plantDropItems = new Set((plantsData?.plants || []).flatMap((p) => [...(p.drops || []), ...(p.stumpDrops || []), ...(p.digDrops || [])].map((d) => d.itemId)));
  for (const it of itemsData.items) {
    const advOk = nodeItems.has(it.id) || recipeOut.has(it.id) || activeDropItems.has(it.id) || heroItems.has(it.id);
    if (!advOk && !legacyDropItems.has(it.id) && !plantDropItems.has(it.id)) addAlert("Missing item source", "🚨 Critical", `${it.name} (${it.id})`, "No source in the game data");
    else if (!advOk && legacyDropItems.has(it.id)) addAlert("Missing item source", "⚠️ Warning", `${it.name} (${it.id})`, "Only available from inactive enemies or encounter rewards");
    else if (!advOk && plantDropItems.has(it.id)) addAlert("Missing item source", "ℹ️ Info", `${it.name} (${it.id})`, "Only available from Survival plants or digging");
  }
  const badRefs = [], dropErrs = []; let dropCount = 0;
  for (const r of recipesData.recipes) {
    for (const k of Object.keys(r.inputs || {})) if (!itemsMap.has(k)) badRefs.push(`${r.id}.in:${k}`);
    if (r.output?.type === "item" && !itemsMap.has(r.output.id)) badRefs.push(`${r.id}.out:${r.output.id}`);
  }
  for (const e of allEnemies) for (const d of e.drops || []) { dropCount += 1; if (!itemsMap.has(d.itemId) || d.probability < 0 || d.probability > 1 || (d.count != null && d.count <= 0)) dropErrs.push(`${e.id}:${d.itemId}(p=${d.probability})`); }
  for (const p of plantsData?.plants || []) for (const d of [...(p.drops || []), ...(p.stumpDrops || []), ...(p.digDrops || [])]) { dropCount += 1; if (!itemsMap.has(d.itemId) || d.probability <= 0 || d.probability > 1) dropErrs.push(`${p.id}:${d.itemId}(p=${d.probability})`); }
  addAlert(badRefs.length ? "Invalid recipe references" : "Cross-file IDs", badRefs.length ? "🚨 Critical" : "✅ Pass", badRefs.length ? badRefs.join(", ") : `${recipesData.recipes.length} recipes`, badRefs.length ? "References an unknown itemId" : "All input and output item IDs are valid");
  addAlert(dropErrs.length ? "Invalid drop values" : "Drop probabilities", dropErrs.length ? "🚨 Critical" : "✅ Pass", dropErrs.length ? dropErrs.join(", ") : `${dropCount} drops`, dropErrs.length ? "Probability is out of range or a reference is invalid" : "Probabilities and quantities are valid");
  const layoutIds = new Set(layout.regions.map((r) => r.id));
  const missingRegs = regionsData.regions.filter((r) => !layoutIds.has(r.id)).map((r) => `${r.name}(${r.id})`);
  if (missingRegs.length) addAlert("Unplaced regions", "⚠️ Warning", missingRegs.join(", "), "Present in regions.json but missing from worldLayout.ts");
  if (catalogData) {
    const missCat = itemsData.items.filter((x) => !catalogData.itemIds.includes(x.id)).map((x) => x.id);
    if (missCat.length) addAlert("Catalog out of sync", "⚠️ Warning", missCat.join(", "), "Missing from catalogDefinitions.json");
  }

  let tuning = balance.survival;
  try {
    const file = path.join(ROOT, "src/frontend/public/survival-balance.json");
    tuning = resolveSurvivalTuning(tuning, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
    addAlert("Survival overrides", "✅ Pass", "survival-balance.json", Object.entries(tuning).map(([k,v]) => k+"="+v).join(", "));
  } catch (error) {
    addAlert("Survival overrides", "🚨 Critical", "survival-balance.json", error.message);
  }
  const effective = survivalRates(tuning);
  const survivalSummary = `Base day / night weights ${effective.daySec} / ${effective.nightSec} (cycle ${effective.daySec+effective.nightSec}s). Idle / moving hunger ${effective.idleHungerPerSec} / ${effective.movingHungerPerSec} points/s. Extra blizzard hunger ${effective.coldHungerPerSec} points/s. Wild resource regrowth ${effective.wildRegrowthSec}s. Clear-night base wave size ${effective.clearNightWaveSize}, wave frequency multiplier ${tuning.spawnFrequency}. Campfire crafting coal multiplier ${tuning.fuelConsumptionMultiplier}.`;
  const blizzard=readJson("weather.json").weathers.find(w=>w.id==="blizzard");
  const pressureRows=[[1,0,0],[5,2,0],[12,4,blizzard.winterShift]].map(([day,tier,shift])=>{
    const clock=winterDay(day,effective.daySec,effective.nightSec,shift);
    return [day,shift?blizzard.name:"Cold, Clear Breeze","T"+tier,clock.duskStart.toFixed(1),
      (clock.nightStart-clock.duskStart).toFixed(1),(clock.cycle-clock.nightStart).toFixed(1),
      (clock.cold*(winter.exposedNightHunger+(shift?tuning.coldHungerPerSecond:0))).toFixed(3),
      raidBudget(day,tier,effective.clearNightWaveSize,shift?blizzard.spawnRateMult:1)];
  });
  const pressure=mdTable(["Survival day","Weather at dawn","Camp tier","Day (s)","Dusk (s)","Long night (s)","Extra exposure hunger/s","Raid budget (if triggered)"],pressureRows);
  const interval=tuning.spawnFrequency>0?[ -1,1 ].map(sign=>Math.max(1,Math.round((raidRules.intervalDays+sign*raidRules.jitterDays)/tuning.spawnFrequency))).join("–")+" days":"Disabled";
  const raidSummary=`Camp raids: ${interval} between raids, with ${raidRules.warningMinSec}–${raidRules.warningMaxSec}s of warning.`;
  console.log("Survival balance", survivalSummary,"\n"+raidSummary+"\n"+pressure);
  const critN = alerts.filter((a) => a.sev.includes("Critical")).length, warnN = alerts.filter((a) => a.sev.includes("Warning")).length;
  console.log(c.b("\n=== Emberwood: Last Torch — Balance and Economy Summary ==="));
  console.log(`Items ${c.cyan(itemsData.items.length)} | Recipes ${c.cyan(recipesData.recipes.length)} | Enemies ${c.cyan(allEnemies.length)} | Implemented regions ${c.cyan(layout.regions.length)}/${regionsData.regions.length}`);
  console.log(`Configuration checks: ${critN ? c.red(`Critical ${critN}`) : c.green("Critical 0")} | ${warnN ? c.yellow(`Warning ${warnN}`) : c.green("Warning 0")} | ${alerts.length} total`);
  for (const a of alerts.filter((x) => x.sev.includes("Critical") || x.sev.includes("Warning"))) {
    console.log(`  ${a.sev.includes("Critical") ? c.red("•") : c.yellow("•")} [${a.cat}] ${a.target} — ${a.detail}`);
  }
  console.log(c.b("\nTop five threats and suggested Eternal Mode credits"));
  threatList.slice(0, 5).forEach(({ e, m }, idx) => console.log(`  ${idx + 1}. ${c.cyan(e.name)} (${e.id}) | Threat ${c.yellow(m.score.toFixed(2))} [${m.tier}] | ${c.green(`${m.credits} credits`)}`));
  console.log(c.b("\nCore economic summary: "));
  for (const row of econRows.slice(0, 4)) console.log(`  ${row[0]} · ${row[7]}`);

  const emit = () => {
    if (!resolved) return;
    const ttkRisks = allEnemies.map(e => ({ name: e.name, seconds: (Math.ceil(e.maxHp / baseDmg) - 1) * cd })).sort((a,b) => b.seconds - a.seconds).slice(0,5);
    console.log("\n@@CONSOLE@@" + JSON.stringify({ alerts, ttkRisks, materials: econRows.map(r => r[0] + " · " + r[7]) }));
  };
  if (SUMMARY_ONLY) { console.log(c.dim("\n[--summary] Printed to the terminal only. docs/BALANCE_REPORT.md was left intact.\n")); emit(); return; }
  const playtest = fs.existsSync(PLAYTEST_PATH) ? fs.readFileSync(PLAYTEST_PATH, "utf8").trim() : "";
  const md = [
    "# Balance and Economy Report", "",
    "> Generated by `pnpm bal` (`tools/balance-report.mjs`). Configuration metrics come from game data, and playtest notes come from `docs/BALANCE_PLAYTEST.md`.",
    `> Items \`${itemsData.items.length}\` · Recipes \`${recipesData.recipes.length}\` · Enemies \`${allEnemies.length}\` · Implemented regions \`${layout.regions.length}\`.`, "",
    "## 1. Combat time to kill and hits to defeat", "", mdTable(combatHeaders, combatRows), "",
    `- TTK = \`(ceil(HP / damage) - 1) × ${cd}s\`. With both the Iron Spear and Charcoal-Tempered Blade, Gale deals 5 damage and other heroes deal 4.`, "",
    "## 2. Iron ore and core material economy", "",
    mdTable(["Material", "Unique and progression cost", "Repeatable cost per craft", "Total", "Fixed yield", "Renews at dawn", "Other sources", "Supply notes"], econRows), "",
    "## 3. Enemy threat and Eternal Mode reference", "",
    mdTable(["Enemy", "Source/region", "Behavior", "HP", "Effective damage", "Cycle (s)", "Attack rate", "Move speed", "Threat score", "Tier", "Suggested credits", "Notes"], threatRows), "",
    "## Effective Survival configuration", "", survivalSummary, "", raidSummary, "", pressure, "",
    ...(playtest ? [playtest, ""] : []),
    "## 4. Configuration checks", "",
    mdTable(["Check", "Severity", "Target", "Details"], alerts.map((a) => [a.cat, a.sev, a.target, a.detail])), "",
  ].join("\n");
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, "utf8");
  console.log(c.green(`\nReport written to ${path.relative(ROOT, REPORT_PATH)}\n`)); emit();
}
main();
