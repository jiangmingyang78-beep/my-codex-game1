import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "../../src/frontend/node_modules/vite/dist/node/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const frontend = path.join(root, "src/frontend");
process.chdir(frontend);
const server = await createServer({
  configFile: path.join(frontend, "vite.config.js"),
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "observe-keyboard-regression",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/game/scenes/GameScene.ts")) return;
        return code.replace(
          "this.ready = true;",
          "this.ready = true; Object.assign(window, {regressionSession: this.session});",
        );
      },
    },
  ],
});
const tmp = path.resolve(tmpdir());
const profile = await mkdtemp(path.join(tmp, "ember-keyboard-"));
const edge = process.argv[2] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
let browser, ws;
async function until(read, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await delay(35);
  }
  throw Error("测试条件超时");
}
try {
  await server.listen();
  browser = spawn(
    edge,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--mute-audio",
      "--no-proxy-server",
      "--remote-debugging-port=0",
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  browser.on("error", () => {});
  const port = await until(async () => {
    try {
      return (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
    } catch {
      return null;
    }
  });
  const page = await (await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", { method: "PUT" })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map(),
    errors = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) cb.reject(Error(msg.error.message));
      else cb.resolve(msg.result);
    }
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const run = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const button = async (id) => {
    const selector = JSON.stringify('[data-ocid="' + id + '"]');
    await until(() => run("!!document.querySelector(" + selector + ")")).catch(async (e) => {
      console.log(id, await run("[location.href,document.documentElement.outerHTML.slice(0,1400)]"), errors);
      throw e;
    });
    const { x, y } = await run(
      "(()=>{const r=document.querySelector(" +
        selector +
        ").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",
    );
    for (const type of ["mousePressed", "mouseReleased"])
      await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  };
  const keyCode = { KeyA: ["a", 65], KeyD: ["d", 68], KeyS: ["s", 83], ShiftLeft: ["Shift", 16] };
  const key = (code, down) => {
    const [key, windowsVirtualKeyCode] = keyCode[code];
    return send("Input.dispatchKeyEvent", {
      type: down ? "keyDown" : "keyUp",
      code,
      key,
      windowsVirtualKeyCode,
      modifiers: code === "ShiftLeft" && down ? 8 : 0,
    });
  };
  await send("Runtime.enable");
  await send("Page.bringToFront");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable");

  const nav = await send("Page.navigate", { url: server.resolvedUrls.local[0] });
  if (nav.errorText) throw Error(server.resolvedUrls.local[0] + " " + nav.errorText);
  await button("title.adventure_button");
  await button("title.new_game_button");
  await until(() => run("!!window.regressionSession && !!document.querySelector('canvas')"));
  const browserCode = await readFile(path.join(root, "tools/map-viewer/verifyKeyboard.browser.js"), "utf8");
  await run(browserCode);
  await run("regression.stageRaid()");
  await until(() => run("regression.counts().raiders.length===5"));
  const near = await run("regression.stageCrossing()");
  const crossings = [];
  for (let leg = 0; leg < 8; leg++) {
    const code = leg % 2 ? "KeyA" : "KeyD",
      target = leg % 2 ? "camp_edge" : "old_mill";
    await key(code, true);
    try {
      await until(() => run("regression.beyond(" + JSON.stringify(target) + ")"), 3500);
    } finally {
      await key(code, false);
    }
    await delay(70);
    const counts = await run("regression.counts()");
    assert.equal(counts.region, target);
    assert(counts.active <= 8);
    assert(counts.raiders.includes(near), "近处追兵丢失");
    crossings.push(counts);
  }
  async function dash(fixture, long) {
    await run("regression.stageDash(" + JSON.stringify(fixture) + "," + long + ")");
    const keys = fixture === "ice" ? ["KeyD", "KeyS"] : ["KeyD"];
    for (const code of keys) await key(code, true);
    await key("ShiftLeft", true);
    try {
      await until(() => run("regression.dashActive()"), 2500);
    } finally {
      await key("ShiftLeft", false);
      for (const code of keys) await key(code, false);
    }
    return until(() => run("regression.dashResult()"), 3500);
  }
  const raidPeak = await run("regression.raidPeak()");
  assert(raidPeak <= 8, "往返过程中逐帧活跃数超过 8");
  const iceDefault = await dash("ice", false),
    iceLong = await dash("ice", true);
  const narrow = await dash("open", true),
    closed = await dash("closed", true);
  console.log(JSON.stringify({ near, crossings, raidPeak, iceDefault, iceLong, narrow, closed, errors }, null, 2));
  assert.equal(errors.length, 0);
  assert(iceLong.dash > iceDefault.dash * 3 && iceLong.iceFrames > 0);
  assert(iceLong.coast <= iceDefault.coast + 6, "松键后的惯性超过默认急步的滑行量");
  assert(narrow.x > 62 * 16 && narrow.blockedFrames === 0);
  assert(closed.x + 5 <= 60 * 16 && closed.blockedFrames === 0);
  await send("Browser.close").catch(() => {});
} finally {
  ws?.close();
  if (browser?.exitCode === null) {
    browser.kill();
    await Promise.race([new Promise((resolve) => browser.once("exit", resolve)), delay(1800)]);
  }
  await server.close();
  if (path.dirname(profile) === tmp && path.basename(profile).startsWith("ember-keyboard-"))
    await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
