import type { Page } from "@playwright/test";
import { expect, test } from "./browser-fixture";

const ocid = (id: string) => '[data-ocid="' + id + '"]';

async function startAdventure(page: Page) {
  await page.goto("/");
  await page.locator(ocid("title.adventure_button")).click();
  const start = page.locator(ocid("title.new_game_button"));
  await start.click();
  await expect(start).toBeHidden();
  await expect(page.getByText(/目标：/).first()).toBeVisible();
  await expect(page.locator("canvas[data-test-webgl=ready]")).toBeVisible();
}

test("开始冒险新游戏", async ({ page }) => {
  await startAdventure(page);
  await expect(page.locator(ocid("game.error_state"))).toBeHidden();
});

test("游玩后刷新并返回标题", async ({ page }) => {
  await startAdventure(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "余烬林：最后一炬" })).toBeVisible();
});

test("生存模式能打开和进入指定种子的世界", async ({ page }) => {
  await page.goto("/");
  await page.locator(ocid("title.survival_button")).click();
  await expect(page).toHaveURL(/\/survival\.html/);
  await expect(page.locator("#game")).toBeVisible();
  await page.locator("#openWorld").click();
  await page.locator("#seedInput").fill("42");
  await page.locator("#createWorld").click();
  await expect(page.locator("#worldSeed")).toContainText("42");
});

test("崩溃现场保留快照、最近 25 条记录和完整堆栈", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startAdventure(page);
  await page.evaluate(() => {
    const button = document.createElement("button");
    document.body.append(button);
    for (let i = 0; i < 30; i++) {
      button.id = "诊断记录-" + i;
      button.click();
    }
    button.remove();
    const error = new Error("诊断测试");
    error.stack += "\n    at " + "堆栈🧪".repeat(4000) + "\n堆栈末尾";
    // 派发事件验证报错 UI，与零报错夹具的失败路径分开。
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));
  });
  const link = page.getByRole("link", { name: "一键提交 GitHub Issue" });
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.href.length).toBeLessThanOrEqual(7500);
  expect(url.searchParams.get("labels")).toBe("bug");
  expect(url.searchParams.get("body")).toContain("已截断");

  await page.getByRole("button", { name: "复制 AI 诊断包" }).click();
  await expect(page.getByRole("status")).toHaveText("已复制完整诊断包。");
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain('"mode": "冒险"');
  expect(report).toContain("UA:");
  if (process.env.VITE_COMMIT_SHA)
    expect(report).toContain("commit: " + process.env.VITE_COMMIT_SHA);
  expect(report).toContain("堆栈末尾");
  expect(report.match(/UI 诊断记录-\d+/g)).toEqual(
    Array.from({ length: 25 }, (_, i) => "UI 诊断记录-" + (i + 5)),
  );
});

test("生存模式的异步异常含当前世界摘要", async ({ page }) => {
  await page.goto("/survival.html");
  await page.locator("#openWorld").click();
  await page.locator("#seedInput").fill("42");
  await page.locator("#createWorld").click();
  await expect(page.locator("#worldSeed")).toContainText("42");
  await page.evaluate(() => {
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("生存异步诊断测试"),
    }));
  });
  const link = page.getByRole("link", { name: "一键提交 GitHub Issue" });
  const body = new URL((await link.getAttribute("href"))!).searchParams.get("body");
  expect(body).toContain("生存异步诊断测试");
  expect(body).toContain('"seed": 42');
  expect(body).toContain('"mode": "生存"');
});
