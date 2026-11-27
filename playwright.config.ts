import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const development = process.env.E2E_TARGET === "development";
const port = development ? 4179 : 4180;
const baseURL = "http://127.0.0.1:" + port;
const vite = "node node_modules/vite/bin/vite.js";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: development ? "adventure-regression.spec.ts" : "*.smoke.spec.ts",
  outputDir: development ? ".cache/ci-playwright/development" : ".cache/ci-playwright/production",
  workers: 1,
  timeout: development ? 120_000 : 30_000,
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL,
    viewport: { width: 1024, height: 640 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--enable-webgl",
      ],
    },
  },
  webServer: {
    cwd: resolve("src/frontend"),
    command: vite + (development ? "" : " preview") + " --host 127.0.0.1 --port " + port + " --strictPort",
    url: baseURL,
    reuseExistingServer: false,
  },
});
