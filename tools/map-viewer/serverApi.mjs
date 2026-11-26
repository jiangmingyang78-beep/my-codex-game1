import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map(
  ["balance", "enemies", "legacyEnemies", "heroes", "regions", "encounters", "worldOverrides"].map((key) => [
    key + ".json",
    path.join(root, "src/frontend/src/data", key + ".json"),
  ]),
);
files.set("survival-balance.json", path.join(root, "src/frontend/public/survival-balance.json"));
const reject = (message, status = 400) => Object.assign(new Error(message), { status });
async function read(file) {
  const target = files.get(file);
  try {
    if ((await realpath(target)) !== path.resolve(target)) throw reject("拒绝符号链接", 403);
    return JSON.parse(await readFile(target, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}
async function readAll() {
  return Object.fromEntries(await Promise.all([...files.keys()].map(async (k) => [k, await read(k)])));
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] ?? "")) throw reject("需要 application/json", 415);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 2_000_000) throw reject("请求过大", 413);
    chunks.push(chunk);
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw reject("JSON 格式无效");
  }
  if (!data || Array.isArray(data) || typeof data !== "object") throw reject("需要 JSON 对象");
  return data;
}
function report(full, map) {
  return new Promise((resolve, rejectReport) => {
    const child = execFile(
      process.execPath,
      ["tools/balance-report.mjs", ...(full ? [] : ["--summary"])],
      {
        cwd: root,
        timeout: 30000,
        maxBuffer: 2_000_000,
        windowsHide: true,
        env: { ...process.env, CONSOLE_REPORT: "1" },
      },
      (error, stdout) => {
        try {
          if (error) throw error;
          const [summary, structured] = stdout.split("\n@@CONSOLE@@");
          resolve({ ...JSON.parse(structured.trim()), summary: summary.replace(/\x1b\[[0-9;]*m/g, "").trim() });
        } catch (e) {
          rejectReport(e);
        }
      },
    );
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ objects: map.objects, spawns: map.spawns }));
  });
}
export function consoleApi(server) {
  // Serialize read/compare/rename across browser tabs.
  let pending = Promise.resolve();
  const serialized = (task) => {
    const job = pending.then(task);
    pending = job.catch(() => {});
    return job;
  };
  async function worldSource() {
    const { adventureSource } = await server.ssrLoadModule("/adapters/adventureAdapter.ts");
    return adventureSource();
  }
  server.middlewares.use("/api/console", async (req, res) => {
    const respond = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    try {
      const host = new URL("http://" + req.headers.host);
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(host.hostname) ||
        (req.headers.origin && req.headers.origin !== host.origin)
      )
        throw reject("仅允许本机同源请求", 403);
      const route = req.url.split("?")[0];
      if (req.method === "GET" && route === "/health") return respond(200, { ready: true });
      if (req.method === "GET" && route === "/data") {
        const data = await readAll();
        return respond(200, { data, baseline: data });
      }
      if (req.method !== "POST" || !["/save", "/balance-check"].includes(route)) throw reject("未知接口", 404);
      const emptyReport =
        route === "/balance-check" &&
        !req.headers["content-type"] &&
        !req.headers["transfer-encoding"] &&
        !Number(req.headers["content-length"]);
      const payload = emptyReport ? {} : await body(req);
      const result = await serialized(async () => {
        const disk = await readAll();
        if (route === "/balance-check") {
          const make = await worldSource();
          return report(payload.full === true, make(disk["worldOverrides.json"], disk));
        }
        const { file, data, baseline } = payload;
        if (!files.has(file)) throw reject("文件不在白名单", 403);
        if (baseline !== undefined && JSON.stringify(disk[file]) !== JSON.stringify(baseline))
          throw reject(file + " 已在磁盘更改，请导出预设并重新加载", 409);
        const make = await worldSource();
        const { validateDraft } = await server.ssrLoadModule("/state/validation.ts");
        const issues = validateDraft({ ...disk, [file]: data }, disk, make());
        if (issues.length)
          throw reject(
            issues
              .slice(0, 8)
              .map((i) => [i.file, ...i.path, i.message].join(" · "))
              .join("\n"),
            422,
          );
        const target = files.get(file);
        if ((await realpath(path.dirname(target))) !== path.dirname(target)) throw reject("拒绝链接目录", 403);
        const tmp = target + "." + randomUUID() + ".tmp";
        try {
          await writeFile(tmp, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
          for(let attempt=0;;attempt++){
            if(JSON.stringify(await read(file))!==JSON.stringify(disk[file]))throw reject(file+" 在写入前已更改",409);
            try{await rename(tmp,target);break;}catch(e){
              if(attempt===4 || !["EPERM","EBUSY"].includes(e.code))throw e;
              await delay(30*(attempt+1));
            }
          }
        } finally {
          await unlink(tmp).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
        }
        return { saved: file };
      });
      respond(200, result);
    } catch (e) {
      respond(e.status ?? 500, { error: e.message });
    }
  });
}
