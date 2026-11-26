import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "../src/frontend/node_modules/vite/dist/node/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
export async function runUnitTests(requested = []) {
  const files = requested.length
    ? requested
    : (
        await readdir(resolve(root, "tests"), {
          recursive: true,
          withFileTypes: true,
        })
      )
        .filter((entry) => entry.isFile() && /\.test\.[jt]s$/.test(entry.name))
        .map((entry) => relative(root, resolve(entry.parentPath, entry.name)))
        .sort();
  if (!files.length) throw new Error("没有找到单元测试");

  const server = await createServer({
    configFile: false,
    root,
    appType: "custom",
    resolve: { alias: { "@": resolve(root, "src/frontend/src") } },
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    for (const file of files) {
      await server.ssrLoadModule(`/${file.replaceAll("\\", "/")}`);
    }
  } finally {
    await server.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runUnitTests(process.argv.slice(2));
}
