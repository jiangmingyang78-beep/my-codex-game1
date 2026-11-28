import type { Page } from "@playwright/test";
import { expect, test } from "./browser-fixture";

const ocid = (id: string) => '[data-ocid="' + id + '"]';

async function startAdventure(page: Page) {
  await page.goto("/");
  await page.locator(ocid("title.adventure_button")).click();
  const start = page.locator(ocid("title.new_game_button"));
  await start.click();
  await expect(start).toBeHidden();
  await expect(page.getByText(/Objective: /).first()).toBeVisible();
  await expect(page.locator("canvas[data-test-webgl=ready]")).toBeVisible();
}

test("Starts a new Adventure game", async ({ page }) => {
  await startAdventure(page);
  await expect(page.locator(ocid("game.error_state"))).toBeHidden();
});

test("Returns to the title screen after reloading", async ({ page }) => {
  await startAdventure(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Emberwood: Last Torch" })).toBeVisible();
});

test("Opens Survival and creates a world from a seed", async ({ page }) => {
  await page.goto("/");
  await page.locator(ocid("title.survival_button")).click();
  await expect(page).toHaveURL(/\/survival\.html/);
  await expect(page.locator("#game")).toBeVisible();
  await page.locator("#openWorld").click();
  await page.locator("#seedInput").fill("42");
  await page.locator("#createWorld").click();
  await expect(page.locator("#worldSeed")).toContainText("42");
});

test("Crash diagnostics keep the snapshot, last 25 breadcrumbs, and full stack", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startAdventure(page);
  await page.evaluate(() => {
    const button = document.createElement("button");
    document.body.append(button);
    for (let i = 0; i < 30; i++) {
      button.id = "diagnostic-log-" + i;
      button.click();
    }
    button.remove();
    const error = new Error("Diagnostic test");
    error.stack += "\n    at " + "Stack🧪".repeat(4000) + "\nEnd of stack";
    // Dispatch an error event to exercise the report UI without failing the browser fixture.
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));
  });
  const link = page.getByRole("link", { name: "Open a GitHub issue" });
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.href.length).toBeLessThanOrEqual(7500);
  expect(url.searchParams.get("labels")).toBe("bug");
  expect(url.searchParams.get("body")).toContain("Truncated");

  await page.getByRole("button", { name: "Copy AI diagnostics" }).click();
  await expect(page.getByRole("status")).toHaveText("Full diagnostics copied.");
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain('"mode": "Adventure"');
  expect(report).toContain("UA:");
  if (process.env.VITE_COMMIT_SHA)
    expect(report).toContain("commit: " + process.env.VITE_COMMIT_SHA);
  expect(report).toContain("End of stack");
  expect(report.match(/UI diagnostic-log-\d+/g)).toEqual(
    Array.from({ length: 25 }, (_, i) => "UI diagnostic-log-" + (i + 5)),
  );
});

test("Survival async diagnostics include the current world", async ({ page }) => {
  await page.goto("/survival.html");
  await page.locator("#openWorld").click();
  await page.locator("#seedInput").fill("42");
  await page.locator("#createWorld").click();
  await expect(page.locator("#worldSeed")).toContainText("42");
  await page.evaluate(() => {
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("Survival async diagnostic test"),
    }));
  });
  const link = page.getByRole("link", { name: "Open a GitHub issue" });
  const body = new URL((await link.getAttribute("href"))!).searchParams.get("body");
  expect(body).toContain("Survival async diagnostic test");
  expect(body).toContain('"seed": 42');
  expect(body).toContain('"mode": "Survival"');
});
