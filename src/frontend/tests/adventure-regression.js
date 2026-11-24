// 在独立的 Playwright CLI 会话中用 run-code --filename 运行。
async (page) => {
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
  };
  const key = async (name) => {
    await page.keyboard.down(name);
    await page.waitForTimeout(90);
    await page.keyboard.up(name);
  };
  const start = () => page.locator('[data-ocid="title.new_game_button"]');
  const resume = () => page.locator('[data-ocid="title.continue_button"]');
  const button = (name) => page.getByRole("button", { name, exact: true });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Observe the Vite modules used by the scene, including hot-reload URLs.
  const installProbe = () =>
    page.evaluate(async () => {
      const live = (path) =>
        performance.getEntriesByType("resource").findLast((e) => new URL(e.name).pathname === path)?.name ?? path;
      const { RunSession } = await import(live("/src/game/session/RunSession.ts"));
      const { EntityViews } = await import(live("/src/game/world/EntityViews.ts"));
      const { toVfxEvent } = await import(live("/src/core/vfxBridge.ts"));
      const q = (window.adventureQA = { session: null, texture: "", events: [], effects: [] });
      const advance = RunSession.prototype.advance;
      const sync = EntityViews.prototype.sync;
      RunSession.prototype.advance = function (...args) {
        q.session = this;
        const out = advance.apply(this, args);
        q.events.push(...out.events);
        q.effects.push(...out.events.map(toVfxEvent).filter(Boolean));
        return out;
      };
      EntityViews.prototype.sync = function (...args) {
        sync.apply(this, args);
        q.texture = this.hero.texture.key;
      };
    });
  const resetProbe = () =>
    page.evaluate(() => {
      window.adventureQA.session = null;
      window.adventureQA.texture = "";
    });
  const waitRun = (id) =>
    page.waitForFunction(
      (id) => window.adventureQA.session?.state.heroId === id && window.adventureQA.texture === "hero:" + id,
      id,
    );
  const toTitle = async () => {
    await key("Escape");
    await button("返回标题").click();
    await start().waitFor();
    await resetProbe();
  };
  const teleport = (target) =>
    page.evaluate((target) => {
      const { state, sys } = window.adventureQA.session;
      const p = target.node
        ? sys.world.objectList.find(
            (o) =>
              o.regionId === target.region &&
              o.kind === "node" &&
              o.itemId === target.node &&
              !state.changesByObjectId[o.id]?.gathered,
          )
        : target.id
          ? sys.world.objects.get(target.id)
          : target;
      Object.assign(state.hero, {
        x: p.x + (target.dx ?? 0),
        y: p.y + (target.dy ?? 0),
        hp: 6,
        invulnerableSec: 4,
        attackCooldownSec: 0,
      });
    }, target);
  await page.goto("http://127.0.0.1:4179/");
  await page.setViewportSize({ width: 1280, height: 720 });
  await start().waitFor();
  check(await resume().isDisabled(), "请在新的 Playwright 浏览器会话运行");
  await installProbe();
  check((await page.getByRole("button", { name: /已解锁|未解锁/ }).count()) === 5, "five title cards");
  await page.getByRole("button", { name: /^格雷/ }).click();
  check(await start().isDisabled(), "locked new game");
  await page.getByText(/解锁条件.*旧磨坊督工/).waitFor();
  await page.getByRole("button", { name: /^凛/ }).click();
  await start().click();
  await start().waitFor({ state: "detached" });
  await waitRun("lin_tinder");
  check(
    await page.evaluate(() => {
      const i = window.adventureQA.session.state.inventory;
      return i.wood === 2 && i.stone === 1 && i.ration === 1;
    }),
    "Lin initial pack",
  );
  await page.evaluate(() => {
    const { state, sys } = window.adventureQA.session;
    const enemy = state.enemiesById.camp_frost_rat;
    const x = 34.5 * sys.data.tileSize;
    const y = 24.5 * sys.data.tileSize;
    sys.data.enemies.get(enemy.enemyId).specialKey = "front_shield";
    Object.assign(enemy, { x, y, dirX: -1, dirY: 0, phase: "chase" });
    Object.assign(state.hero, { x: x - 15, y, facingX: 1, facingY: 0, attackCooldownSec: 0 });
  });
  await key("Space");
  await page.getByText(/攻击被护盾挡住/).waitFor();
  check(
    await page.evaluate(() => {
      const q = window.adventureQA;
      return (
        q.session.state.enemiesById.camp_frost_rat.hp === 1 &&
        q.effects.some((e) => e.payload.kind === "guard" && e.payload.enemyId === "frost_rat")
      );
    }),
    "front shield HP and guard impact",
  );
  await page.evaluate(() => {
    const q = window.adventureQA;
    const { state, sys } = q.session;
    delete sys.data.enemies.get("frost_rat").specialKey;
    const boss = state.enemiesById.mill_overseer_spawn;
    Object.assign(boss, { phase: "recovery", phaseSec: 1, hp: 1 });
    Object.assign(state.hero, {
      x: boss.x - 15,
      y: boss.y,
      facingX: 1,
      facingY: 0,
      attackCooldownSec: 0,
      invulnerableSec: 4,
    });
  });
  await key("Space");
  await page.getByText(/英雄解锁：格雷/).waitFor();
  await page.waitForFunction(() => window.adventureQA.session.state.seals.includes("old_mill_ember_seal"));
  await toTitle();
  await page.getByRole("button", { name: /^格雷/ }).click();
  check(await start().isEnabled(), "Gale unlocked from normal boss hit");
  await start().click();
  await waitRun("gale_smith");
  check(
    await page.evaluate(() => {
      const { state } = window.adventureQA.session;
      return (
        state.inventory.wood === 1 &&
        state.inventory.iron_scrap === 2 &&
        state.inventory.charcoal === 1 &&
        state.hero.hp === 8
      );
    }),
    "Gale pack and HP",
  );
  await toTitle();
  await page.evaluate(async () => {
    const { createRun, getSystems } = await import("/src/core/index.ts");
    const sys = getSystems();
    const state = createRun({ seed: 42, runId: "browser-v2", systems: sys });
    state.schemaVersion = 2;
    delete state.heroId;
    state.inventory = { wood: 17, stone: 4, ember_seal: 2 };
    state.seals = ["old_mill_ember_seal", "ice_gorge_ember_seal"];
    state.collectedPickups = [...state.seals];
    state.campLevel = 2;
    state.changesByObjectId.old_mill_gate = { opened: true };
    state.changesByObjectId.mill_overseer_spawn = { defeated: true };
    delete state.enemiesById.mill_overseer_spawn;
    localStorage.setItem(sys.data.balance.storage.runKey, JSON.stringify({ schemaVersion: 2, savedAt: 1, state }));
  });
  await page.reload();
  await start().waitFor();
  await installProbe();
  await page.getByRole("button", { name: /^格雷/ }).click();
  await resume().click();
  await waitRun("lin_tinder");
  check(
    await page.evaluate(() => {
      const s = window.adventureQA.session.state;
      return (
        s.schemaVersion === 3 &&
        s.inventory.wood === 17 &&
        s.seals.length === 2 &&
        s.changesByObjectId.old_mill_gate.opened
      );
    }),
    "continues the v2 hero, pack, seal and gate",
  );
  await key("Escape");
  await button("保存进度").click();
  check(
    await page.evaluate(() => {
      const { runKey, runBackupKey } = window.adventureQA.session.sys.data.balance.storage;
      const run = JSON.parse(localStorage.getItem(runKey));
      return (
        run.schemaVersion === 3 &&
        run.state.heroId === "lin_tinder" &&
        JSON.parse(localStorage.getItem(runBackupKey)).schemaVersion === 2
      );
    }),
    "v3 save and v2 backup",
  );
  await page.reload();
  await start().waitFor();
  await installProbe();
  await resume().click();
  await waitRun("lin_tinder");
  await teleport({ x: 95.75 * 16, y: 24.5 * 16 });
  await key("d");
  await page.getByText(/进入：密林深处.*枝叶间有脚步声/).waitFor();
  await teleport({ node: "berry", region: "deep_woods" });
  await key("e");
  await page.getByText(/获得 红莓/).waitFor();
  await page.evaluate(() => {
    const { state, sys } = window.adventureQA.session;
    state.elapsedSec = sys.data.balance.clock.daySec - 0.01;
  });
  await page.waitForFunction(() => window.adventureQA.session.state.nightRaid?.spawnedIds.length === 2);
  await teleport({ id: "frost_ridge_gate", dx: -17 });
  await key("e");
  await page.waitForFunction(() => window.adventureQA.session.state.changesByObjectId.frost_ridge_gate?.opened);
  await page.keyboard.down("d");
  await page.waitForFunction(() => window.adventureQA.session.state.regionId === "frost_ridge");
  await page.keyboard.up("d");
  await page.getByText(/进入：霜渊山脊/).waitFor();
  await teleport({ node: "ore", region: "frost_ridge" });
  await key("e");
  await page.getByText(/获得 铁矿/).waitFor();
  await teleport({ id: "final_beacon", dx: -16 });
  await page.getByText("E 点燃山脊烽台（需 2 枚炉印）", { exact: true }).waitFor();
  await key("e");
  await page.getByText("需要先取得所需的炉印", { exact: true }).waitFor();
  await page.evaluate(() => {
    const { state } = window.adventureQA.session;
    const boss = state.enemiesById.ridge_warden;
    Object.assign(boss, { phase: "windup", phaseSec: 0.01, wardenPhase: 1, hp: 12, aimX: boss.x, aimY: boss.y });
    Object.assign(state.hero, { x: boss.x - 16, y: boss.y, facingX: 1, facingY: 0, invulnerableSec: 4 });
  });
  await page.waitForFunction(() => window.adventureQA.events.some((e) => e.type === "enemy.aoe_detonated"));
  check(
    await page.evaluate(() =>
      window.adventureQA.effects.some(
        (e) => e.payload.enemyId === "summit_pyre_warden" && e.payload.kind === "boss" && e.payload.radius > 0,
      ),
    ),
    "AoE detonation impact",
  );
  await page.evaluate(() => {
    const { state } = window.adventureQA.session;
    const boss = state.enemiesById.ridge_warden;
    Object.assign(boss, { phase: "recovery", phaseSec: 1, hp: 1 });
    Object.assign(state.hero, { x: boss.x - 16, y: boss.y, facingX: 1, facingY: 0, attackCooldownSec: 0 });
  });
  await key("Space");
  await page.getByText(/目标：前往山脊东端，点燃烽台/).waitFor();
  await page.getByText(/英雄解锁：艾尔文/).waitFor();
  check(
    await page.evaluate(() => window.adventureQA.session.state.inventory.ember_seal === 3),
    "legacy seal still present",
  );
  await teleport({ id: "final_beacon", dx: -16 });
  await key("e");
  const won = page.getByRole("heading", { name: "烽火重燃" });
  await won.waitFor();
  check(await won.evaluate((el) => el.classList.contains("text-ember")), "warm win heading");
  await page.getByText(/火光越过霜渊/).waitFor();
  check(
    await page.evaluate(() => {
      const { events, session } = window.adventureQA;
      return (
        session.state.changesByObjectId.final_beacon.lit &&
        events.filter((e) => e.type === "run.ended").length === 1 &&
        session.meta.notes.includes("beacon_restored")
      );
    }),
    "win settled once and unlocks camp note",
  );
  check(errors.length === 0, "page errors: " + errors.join(", "));
  return "通过：标题选人、贴图与初始背包、护盾格挡、v2/v3 存档、两区采集与夜袭、双炉印、爆炸特效和胜利页";
}
