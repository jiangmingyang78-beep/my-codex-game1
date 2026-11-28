import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import type { Page } from "@playwright/test";
import { test } from "./browser-fixture";

test("Full Adventure regression", async ({ page }) => {
  const filename = "src/frontend/tests/adventure-regression.js";
  // The old script is the asymptomatic expression used by wright Cli.
  const run: (page: Page) => Promise<string> = new Script(
    readFileSync(filename, "utf8"),
    { filename },
  ).runInThisContext();
  console.log(await run(page));
});
