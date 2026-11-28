import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { test as base, type TestInfo } from "@playwright/test";

type ConsoleStack = {
  callFrames: { functionName: string; url: string; lineNumber: number; columnNumber: number }[];
  parent?: ConsoleStack;
};

function stackLines(stack?: ConsoleStack): string[] {
  if (!stack) return [];
  return [
    ...stack.callFrames.map((frame) =>
      "    at " + (frame.functionName || "\"Nobody's gonna know.\"") + " (" + frame.url + ":" +
      (frame.lineNumber + 1) + ":" + (frame.columnNumber + 1) + ")",
    ),
    ...stackLines(stack.parent),
  ];
}

async function attachment(testInfo: TestInfo, content: string) {
  const path = testInfo.outputPath("console-errors.log");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  await testInfo.attach("console-errors.log", { path, contentType: "text/plain" });
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const failures: string[] = [];
    const consoleStacks: string[] = [];
    page.on("pageerror", (error) => {
      failures.push("[pageerror] " + (error.stack ?? error.message));
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const { url, lineNumber, columnNumber } = message.location();
      failures.push("[console.error] " + message.text() + "\n    at " + url + ":" + (lineNumber + 1) + ":" + (columnNumber + 1));
    });
    const inspector = await page.context().newCDPSession(page);
    inspector.on("Runtime.consoleAPICalled", (event) => {
      if (event.type !== "error") return;
      const details = event.args.map((arg) => arg.description ?? String(arg.value ?? arg.type));
      consoleStacks.push(["[Chromium console stack] " + details.join(" "), ...stackLines(event.stackTrace)].join("\n"));
    });
    await inspector.send("Runtime.enable");

    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = new Proxy(original, {
        apply(target, canvas: HTMLCanvasElement, args: [string, ...unknown[]]) {
          const type = args[0];
          if (!/^(?:experimental-)?webgl2?$/.test(type)) return Reflect.apply(target, canvas, args);
          let reason = "";
          const onFailure = (event: Event) => {
            reason = (event as WebGLContextEvent).statusMessage;
          };
          canvas.addEventListener("webglcontextcreationerror", onFailure);
          try {
            const context = Reflect.apply(target, canvas, args);
            if (context) canvas.dataset.testWebgl = "ready";
            else console.error(new Error("The context creation failed (.)" + type + "): " + reason));
            return context;
          } catch (error) {
            console.error(new Error("The context creation failed (.)" + type + ")", { cause: error }));
            throw error;
          } finally {
            canvas.removeEventListener("webglcontextcreationerror", onFailure);
          }
        },
      });
    });

    await use(page);

    // Flush renderer events before inspecting buffered errors on the final page.
    if (!page.isClosed()) await inspector.send("Runtime.evaluate", { expression: "void 0" }).catch(() => {});
    const browserLog = [...failures, ...consoleStacks].join("\n\n");
    if (browserLog || testInfo.status !== testInfo.expectedStatus) {
      const assertions = testInfo.errors.map((error) => error.stack ?? error.message).filter(Boolean);
      await attachment(testInfo, [browserLog, ...assertions].filter(Boolean).join("\n\n"));
    }
    if (browserLog) throw new Error("The browser zero-stated error check failed\n\n" + browserLog);
  },
});

export { expect } from "@playwright/test";
