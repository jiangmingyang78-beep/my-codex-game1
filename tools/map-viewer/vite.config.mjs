import path from "node:path";
import { fileURLToPath } from "node:url";
import { consoleApi } from "./serverApi.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../..");
export default {
  root: toolDir,
  publicDir: false,
  plugins: [
    {
      name: "local-balance-console",
      configureServer: consoleApi,
      // A save may touch multiple imported JSON modules. Keep the live draft
      // and undo history in this tab; fresh tabs still load the new modules.
      hotUpdate(context) {
        if (context.file.endsWith(".json") && this.environment.name === "client") return [];
      },
    },
  ],
  resolve: { alias: { "@": path.resolve(repoRoot, "src/frontend/src") } },
  server: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: false,
    open: !process.env.MAP_VIEWER_NO_OPEN,
    fs: {
      allow: [
        toolDir,
        ...["src/frontend/src", "src/frontend/node_modules", "node_modules"].map((p) => path.join(repoRoot, p)),
      ],
    },
  },
};
