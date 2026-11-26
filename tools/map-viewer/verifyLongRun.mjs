import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createServer } from "../../src/frontend/node_modules/vite/dist/node/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const frontend = path.join(root, "src/frontend");
process.chdir(frontend);
const server = await createServer({
  root: frontend,
  configFile: path.join(frontend, "vite.config.js"),
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
  plugins: [
    {
      name: "browser-regression",
      transformIndexHtml() {
        return [
          {
            tag: "script",
            attrs: {
              type: "module",
              src: "/@fs/" + path.join(root, "tools/map-viewer/verifyLongRun.browser.ts").replaceAll("\\", "/"),
            },
          },
        ];
      },
    },
  ],
});
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const profile = await mkdtemp(path.join(tmpdir(), "ember-long-run-"));
  const edge = process.argv[2] ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const { stdout } = await promisify(execFile)(
    edge,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--user-data-dir=" + profile,
      "--dump-dom",
      "--virtual-time-budget=15000",
      url,
    ],
    { windowsHide: true, timeout: 45000, maxBuffer: 5_000_000 },
  );
  const result = stdout.match(/data-ember-result="([^"]+)"/)?.[1];
  if (!result) throw Error("浏览器未返回验收结果");
  const decoded = JSON.parse(decodeURIComponent(result));
  console.log(JSON.stringify(decoded, null, 2));
  if (decoded.failures.length) process.exitCode = 1;
} finally {
  await server.close();
}
