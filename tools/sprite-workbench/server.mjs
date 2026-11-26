import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../..");
const ASSETS_ROOT = path.join(ROOT, "src", "frontend", "public", "assets");
const NO_OPEN = process.argv.includes("--no-open");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function scanPngAssets(subDir, category) {
  const dir = path.join(ASSETS_ROOT, subDir);
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = (curr) => {
    for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
        const rel = path.relative(ASSETS_ROOT, full).replace(/\\/g, "/");
        results.push({ category, name: rel, url: `/assets/${rel}` });
      }
    }
  };
  walk(dir);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function openBrowser(url) {
  try {
    let child;
    if (process.platform === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    } else if (process.platform === "darwin") {
      child = spawn("open", [url], { detached: true, stdio: "ignore" });
    } else {
      child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    }
    child.unref();
  } catch (err) {
    console.warn(`[sprite-workbench] 自动打开浏览器失败，请手动访问 ${url}: ${err.message}`);
  }
}

function createWorkbenchServer() {
  return http.createServer((req, res) => {
    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(reqUrl.pathname);

    if (req.method === "GET" && pathname === "/api/assets") {
      const assets = [
        ...scanPngAssets("sprites", "sprite"),
        ...scanPngAssets("portraits", "portrait"),
      ];
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ assets }));
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/assets/")) {
      const rel = pathname.slice("/assets/".length);
      const target = path.resolve(ASSETS_ROOT, rel);
      const rootWithSep = ASSETS_ROOT.endsWith(path.sep) ? ASSETS_ROOT : `${ASSETS_ROOT}${path.sep}`;
      if (!target.startsWith(rootWithSep)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }
      sendFile(res, target);
      return;
    }

    const staticMap = {
      "/": "index.html",
      "/index.html": "index.html",
      "/workbench.css": "workbench.css",
      "/workbench.js": "workbench.js",
    };
    const mapped = staticMap[pathname];
    if (req.method === "GET" && mapped) {
      sendFile(res, path.join(TOOL_DIR, mapped));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });
}

function listenWithFallback(port, maxPort = 4199) {
  const server = createWorkbenchServer();
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && port < maxPort) {
      listenWithFallback(port + 1, maxPort);
      return;
    }
    console.error(`[sprite-workbench] 启动失败: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`[sprite-workbench] 工作台已启动：${url} (按 Ctrl+C 退出)`);
    if (!NO_OPEN) {
      openBrowser(url);
    }
    const shutdown = () => {
      console.log("\n[sprite-workbench] 正在退出...");
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 500).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

listenWithFallback(4179);
