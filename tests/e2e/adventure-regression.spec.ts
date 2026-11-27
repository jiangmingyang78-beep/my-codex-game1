import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import type { Page } from "@playwright/test";
import { test } from "./browser-fixture";

test("冒险完整回归", async ({ page }) => {
  const filename = "src/frontend/tests/adventure-regression.js";
  // 旧脚本是 Playwright CLI 使用的异步函数表达式。
  const run: (page: Page) => Promise<string> = new Script(
    readFileSync(filename, "utf8"),
    { filename },
  ).runInThisContext();
  console.log(await run(page));
});
