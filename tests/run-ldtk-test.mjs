import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "src", "frontend");
const outDir = path.join(frontendDir, ".tmp_ldtk_test");
const viteBin = path.join(frontendDir, "node_modules", "vite", "bin", "vite.js");
const testEntry = "../../tests/ldtkAdapter.test.ts";

try {
  const build = spawnSync(
    process.execPath,
    [viteBin, "build", "--ssr", testEntry, "--outDir", ".tmp_ldtk_test"],
    { cwd: frontendDir, stdio: "inherit" },
  );
  if (build.status !== 0) {
    process.exitCode = build.status ?? 1;
  } else {
    const run = spawnSync(
      process.execPath,
      [path.join(outDir, "ldtkAdapter.test.js")],
      { cwd: frontendDir, stdio: "inherit" },
    );
    process.exitCode = run.status ?? 1;
  }
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
