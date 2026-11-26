import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src", "frontend", "src", "data");
const LAYOUT_PATH = path.join(ROOT, "src", "frontend", "src", "systems", "world", "worldLayout.ts");
const REPORT_PATH = path.join(ROOT, "docs", "BALANCE_REPORT.md");
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
  catch (err) { console.warn(c.yellow(`[warn] 无法解析 ${fileName}: ${err.message}`)); return null; }
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
    dmg = wD; spd = wS; cyc = `${wC.toFixed(2)} (加权)`;
  } else {
    const cSec = attackCycle(e.seedType || e.attack?.type, e.attack);
    aps = 1 / cSec; cyc = cSec.toFixed(2);
  }
  const score = e.maxHp * dmg * aps * (0.6 + 0.4 * (spd / heroSpeed));
  const credits = Math.max(10, Math.round((score * 10) / 5) * 5);
  const tier = score >= 20 ? "T4 首领" : score >= 6.5 ? "T3 精英" : score >= 2.5 ? "T2 中型" : "T1 轻型";
  return { dmg, spd, aps, cyc, score, credits, tier };
}

function main() {
  const balance = readJson("balance.json") || { hero: { attackDamage: 1, attackCooldownSec: 0.42, moveSpeedPxPerSec: 80, quickUseItemIds: [] }, stats: { hp: { max: 6 } } };
  const itemsData = readJson("items.json") || { items: [] };
  const recipesData = readJson("recipes.json") || { recipes: [] };
  const enemiesData = readJson("enemies.json") || { enemies: [] };
  const legacyData = readJson("legacyEnemies.json") || { enemies: [], encounterRewards: [] };
  const regionsData = readJson("regions.json") || { regions: [], dawnRenewal: { renewableItemIds: [] } };
  const heroesData = readJson("heroes.json"), plantsData = readJson("plants.json"), catalogData = readJson("catalogDefinitions.json");
  const layout = parseWorldLayout(LAYOUT_PATH);

  const itemsMap = new Map(itemsData.items.map((x) => [x.id, x]));
  const allEnemies = [...enemiesData.enemies.map((e) => ({ ...e, _src: "current" })), ...legacyData.enemies.map((e) => ({ ...e, _src: "legacy" }))];
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
  const profiles = [["徒手", baseDmg], ["铁矛", spearDmg], ["淬炭短刃", baseDmg + bladeBonus], ["格雷·徒手", baseDmg + galeDmg], ["格雷·铁矛", spearDmg + galeDmg], ["格雷·短刃", baseDmg + bladeBonus + galeDmg], ["格雷·双武", spearDmg + bladeBonus + galeDmg]];
  const combatHeaders = ["怪物", "来源/区域", "HP", "敌伤", ...profiles.map(([n, d]) => `${n}(${d})`), `${baseHp}血裸装`, `+胸甲(${baseHp + armorHp}血/减${armorDr})`, `+重盔(${baseHp + helmHp}血)`, `胸甲+重盔(${baseHp + armorHp + helmHp}血/减${armorDr})`];
  const combatRows = allEnemies.map((e) => {
    const peak = Math.max(e.attackDamage, ...(e.phases || []).map((p) => p.overrides?.attackDamage ?? 0));
    const dmgTxt = peak === e.attackDamage ? `${e.attackDamage}` : `${e.attackDamage} (P3:${peak})`;
    const tank = (hp, dr) => { const h1 = Math.ceil(hp / Math.max(1, e.attackDamage - dr)), h2 = Math.ceil(hp / Math.max(1, peak - dr)); return peak === e.attackDamage ? `${h1}下` : `${h1}下 (P3:${h2}下)`; };
    const ttk = (d) => { const k = Math.ceil(e.maxHp / d); return `${k}击 (${((k - 1) * cd).toFixed(2)}s)`; };
    return [e.name, `${e._src === "legacy" ? "旧版·" : ""}${e.regionIds.join("/")}`, e.maxHp, dmgTxt, ...profiles.map(([, d]) => ttk(d)), tank(baseHp, 0), tank(baseHp + armorHp, armorDr), tank(baseHp + helmHp, 0), tank(baseHp + armorHp + helmHp, armorDr)];
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
      return sp.res + sp.night > 0 ? `${e.name}[常${sp.res}/夜${sp.night}]均${((d.count ?? 1) * d.probability).toFixed(2)}` : null;
    })).filter(Boolean);
    const activeExp = allEnemies.reduce((sum, e) => { const sp = spawnCounts.get(e.id); return (!sp || !sp.res) ? sum : sum + (e.drops || []).filter((d) => d.itemId === id).reduce((a, d) => a + (d.count ?? 1) * d.probability * sp.res, 0); }, 0);
    const heroStarts = (heroesData?.heroes || []).filter((h) => h.startingInventory?.[id] > 0).map((h) => `${h.name}×${h.startingInventory[id]}`);
    const other = [dropNotes.length ? `活跃掉落: ${dropNotes.join("、")}` : "", heroStarts.length ? `初始: ${heroStarts.join("/")}` : ""].filter(Boolean).join("；") || "配方/生存";
    let diag = "✅ 健康";
    if (id === "ingot") diag = `⚠️ 紧平衡：固定矿最多熔 ${Math.floor((fixedMap.get("ore")?.total || 0) / 2)} 锭，唯一+进度需 ${uniq} 锭`;
    else if (id === "ore") diag = `固定矿点合计 ${fix.total} 矿，完整锭需求见上一行`;
    else if (id === "iron_scrap" || id === "charcoal") diag = `固定产出 ${fix.total}，唯一/进度需 ${uniq}，常驻敌人掉落期望 ${activeExp.toFixed(2)}`;
    else if (id === "fiber") diag = `✅ 充裕/微溢出：首区 ${fix.total} 且黎明再生，唯一需 ${uniq}`;
    return [`${itemsMap.get(id)?.name || id} (${id})`, uniq ? `${uniq} (${uParts.join("+")})` : "0", rep ? `${rep} (${rParts.join("+")})` : "0", uniq + rep, fixTxt, renewSet.has(id) ? "是" : "否", other, diag];
  });

  const heroSpeed = balance.hero.moveSpeedPxPerSec;
  const threatList = allEnemies.map((e) => ({ e, m: calcThreat(e, heroSpeed), sp: spawnCounts.get(e.id) || { res: 0, night: 0 } })).sort((a, b) => b.m.score - a.m.score);
  const threatRows = threatList.map(({ e, m, sp }) => [
    `${e.name} (${e.id})`, `${e._src === "legacy" ? "legacy" : e.scope} (${e.regionIds.join("/")})`, e.seedType || e.attack?.type || "-",
    e.maxHp, m.dmg.toFixed(2).replace(/\.00$/, ""), m.cyc, m.aps.toFixed(2), `${m.spd.toFixed(0)} (${((m.spd / heroSpeed) * 100).toFixed(0)}%)`,
    m.score.toFixed(2), m.tier, m.credits,
    [e.scope === "adventure_only" ? "冒险首领" : "", e._src === "legacy" && sp.res + sp.night === 0 ? "未入现行地图" : "", m.spd > heroSpeed ? "移速超英雄" : "", sp.res + sp.night > 0 ? `常驻${sp.res}/夜${sp.night}` : ""].filter(Boolean).join("；") || "-",
  ]);

  const alerts = [];
  const addAlert = (cat, sev, target, detail) => alerts.push({ cat, sev, target, detail });
  const nodeItems = new Set(layout.regions.flatMap((r) => r.nodes.map((n) => n.itemId)));
  if (layout.renewableWoodTiles.size) nodeItems.add("wood");
  const recipeOut = new Set(recipesData.recipes.filter((r) => r.output?.type === "item").map((r) => r.output.id));
  const activeDropItems = new Set(allEnemies.filter((e) => { const s = spawnCounts.get(e.id); return s && s.res + s.night > 0; }).flatMap((e) => (e.drops || []).map((d) => d.itemId)));
  const legacyDropItems = new Set([...allEnemies.flatMap((e) => e.drops || []), ...(legacyData.encounterRewards || []).flatMap((r) => r.drops || [])].map((d) => d.itemId));
  const heroItems = new Set((heroesData?.heroes || []).flatMap((h) => Object.keys(h.startingInventory || {})));
  const plantDropItems = new Set((plantsData?.plants || []).flatMap((p) => [...(p.drops || []), ...(p.stumpDrops || []), ...(p.digDrops || [])].map((d) => d.itemId)));
  for (const it of itemsData.items) {
    const advOk = nodeItems.has(it.id) || recipeOut.has(it.id) || activeDropItems.has(it.id) || heroItems.has(it.id);
    if (!advOk && !legacyDropItems.has(it.id) && !plantDropItems.has(it.id)) addAlert("物品无来源", "🚨 严重", `${it.name} (${it.id})`, "全量数据均无获取途径");
    else if (!advOk && legacyDropItems.has(it.id)) addAlert("物品无来源", "⚠️ 警告", `${it.name} (${it.id})`, "仅存在于未入现行地图的 legacyEnemies 掉落中");
    else if (!advOk && plantDropItems.has(it.id)) addAlert("物品无来源", "ℹ️ 提示", `${it.name} (${it.id})`, "仅生存模式植株掉落/挖掘获得");
  }
  const badRefs = [], dropErrs = []; let dropCount = 0;
  for (const r of recipesData.recipes) {
    for (const k of Object.keys(r.inputs || {})) if (!itemsMap.has(k)) badRefs.push(`${r.id}.in:${k}`);
    if (r.output?.type === "item" && !itemsMap.has(r.output.id)) badRefs.push(`${r.id}.out:${r.output.id}`);
  }
  for (const e of allEnemies) for (const d of e.drops || []) { dropCount += 1; if (!itemsMap.has(d.itemId) || d.probability < 0 || d.probability > 1 || (d.count != null && d.count <= 0)) dropErrs.push(`${e.id}:${d.itemId}(p=${d.probability})`); }
  for (const p of plantsData?.plants || []) for (const d of [...(p.drops || []), ...(p.stumpDrops || []), ...(p.digDrops || [])]) { dropCount += 1; if (!itemsMap.has(d.itemId) || d.probability <= 0 || d.probability > 1) dropErrs.push(`${p.id}:${d.itemId}(p=${d.probability})`); }
  addAlert(badRefs.length ? "配方引用异常" : "跨文件 ID 引用", badRefs.length ? "🚨 严重" : "✅ 通过", badRefs.length ? badRefs.join(", ") : `${recipesData.recipes.length} 条配方`, badRefs.length ? "引用了不存在的 itemId" : "所有输入/输出 itemId 均有效");
  addAlert(dropErrs.length ? "掉落越界" : "掉落概率检查", dropErrs.length ? "🚨 严重" : "✅ 通过", dropErrs.length ? dropErrs.join(", ") : `${dropCount} 条掉落项`, dropErrs.length ? "概率超出允许范围或引用非法" : "概率与数量均合法");
  const layoutIds = new Set(layout.regions.map((r) => r.id));
  const missingRegs = regionsData.regions.filter((r) => !layoutIds.has(r.id)).map((r) => `${r.name}(${r.id})`);
  if (missingRegs.length) addAlert("区域未实装", "⚠️ 警告", missingRegs.join("、"), "存在于 regions.json 但未在 worldLayout.ts 实装");
  if (catalogData) {
    const missCat = itemsData.items.filter((x) => !catalogData.itemIds.includes(x.id)).map((x) => x.id);
    if (missCat.length) addAlert("目录未同步", "⚠️ 警告", missCat.join(", "), "未登记在 catalogDefinitions.json");
  }

  const critN = alerts.filter((a) => a.sev.includes("严重")).length, warnN = alerts.filter((a) => a.sev.includes("警告")).length;
  console.log(c.b("\n=== 《余烬林：最后一炬》数值平衡与经济体检摘要 ==="));
  console.log(`统计范围：物品 ${c.cyan(itemsData.items.length)} | 配方 ${c.cyan(recipesData.recipes.length)} | 怪物 ${c.cyan(enemiesData.enemies.length)}+${c.dim(`${legacyData.enemies.length}旧版`)} | 实装区域 ${c.cyan(layout.regions.length)}/${regionsData.regions.length}`);
  console.log(`健康度告警：${critN ? c.red(`严重 ${critN}`) : c.green("严重 0")} | ${warnN ? c.yellow(`警告 ${warnN}`) : c.green("警告 0")} | 全部检查 ${alerts.length} 项`);
  for (const a of alerts.filter((x) => x.sev.includes("严重") || x.sev.includes("警告"))) {
    console.log(`  ${a.sev.includes("严重") ? c.red("•") : c.yellow("•")} [${a.cat}] ${a.target} — ${a.detail}`);
  }
  console.log(c.b("\n前 5 高威胁怪物（永恒模式信用点参考）："));
  threatList.slice(0, 5).forEach(({ e, m }, idx) => console.log(`  ${idx + 1}. ${c.cyan(e.name)} (${e.id}) | 威胁分 ${c.yellow(m.score.toFixed(2))} [${m.tier}] | 建议 ${c.green(`${m.credits} 点`)}`));
  console.log(c.b("\n核心经济摘要："));
  for (const row of econRows.slice(0, 4)) console.log(`  ${row[0]} · ${row[7]}`);

  const emit = () => {
    if (!resolved) return;
    const ttkRisks = allEnemies.map(e => ({ name: e.name, seconds: (Math.ceil(e.maxHp / baseDmg) - 1) * cd })).sort((a,b) => b.seconds - a.seconds).slice(0,5);
    console.log("\n@@CONSOLE@@" + JSON.stringify({ alerts, ttkRisks, materials: econRows.map(r => r[0] + " · " + r[7]) }));
  };
  if (SUMMARY_ONLY) { console.log(c.dim("\n[--summary] 仅终端打印，未改写 docs/BALANCE_REPORT.md。\n")); emit(); return; }
  const md = [
    "# 数值平衡与经济体检报告（BALANCE_REPORT）", "",
    "> 由 `pnpm bal` (`tools/balance-report.mjs`) 只读解析 `src/frontend/src/data/*.json` 与 `worldLayout.ts` 生成。",
    `> 统计：物品 \`${itemsData.items.length}\` 项 · 配方 \`${recipesData.recipes.length}\` 条 · 怪物 \`${enemiesData.enemies.length}\` 现行 + \`${legacyData.enemies.length}\` 遗留 · 实装区域 \`${layout.regions.length}\` 个。`, "",
    "## 1. 战斗 TTK 与容错表", "", mdTable(combatHeaders, combatRows), "",
    `- TTK 公式：\`(ceil(HP / 伤害) - 1) × ${cd}s\`；非格雷同时持有铁矛+淬炭短刃同为 4 伤，格雷可达 5 伤。`, "",
    "## 2. 铁矿与核心材料经济表", "",
    mdTable(["材料", "唯一/进度消耗", "可重复(单次)", "合计", "固定采集产出", "黎明再生", "其他来源", "经济诊断"], econRows), "",
    "## 3. 怪物威胁度与永恒模式参考表", "",
    mdTable(["怪物", "来源/区域", "行为", "HP", "有效伤害", "循环(s)", "攻速", "移速", "威胁分", "评级", "建议信用点", "备注"], threatRows), "",
    "## 4. 配置健康度告警", "",
    mdTable(["检查类别", "级别", "涉及对象", "详细说明"], alerts.map((a) => [a.cat, a.sev, a.target, a.detail])), "",
  ].join("\n");
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, "utf8");
  console.log(c.green(`\n✔ 已写入完整报告：${path.relative(ROOT, REPORT_PATH)}\n`)); emit();
}
main();
