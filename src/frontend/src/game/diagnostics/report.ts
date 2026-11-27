import { GITHUB_REPOSITORY } from "./config";

const MAX_BREADCRUMBS = 25;
const ISSUE_URL_LIMIT = 7500;
const breadcrumbs = new Array<string>(MAX_BREADCRUMBS);
let next = 0;
let count = 0;
let readSnapshot: (() => object) | undefined;

export interface DiagnosticReport {
  message: string;
  title: string;
  context: string;
  stack: string;
}

export function breadcrumb(label: string): void {
  breadcrumbs[next] = `${new Date().toISOString()} ${label}`;
  next = (next + 1) % MAX_BREADCRUMBS;
  count = Math.min(count + 1, MAX_BREADCRUMBS);
}

export function setSnapshotReader(reader: () => object): () => void {
  readSnapshot = reader;
  return () => {
    if (readSnapshot === reader) readSnapshot = undefined;
  };
}

function codeBlock(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

function errorDetails(error: unknown, message: string) {
  try {
    if (error instanceof Error)
      return { detail: error.message, stack: error.stack ?? error.message };
    const detail = error === undefined ? message : String(error);
    return { detail, stack: detail };
  } catch {
    return { detail: message, stack: "无法读取异常内容" };
  }
}

export function captureDiagnostic(
  message: string,
  error?: unknown,
  snapshot?: object,
): DiagnosticReport {
  let summary = "暂无活动存档";
  try {
    const current = snapshot ?? readSnapshot?.();
    if (current) summary = JSON.stringify(current, null, 2);
  } catch {
    summary = "无法读取当前快照";
  }
  const recent = Array.from(
    { length: count },
    (_, i) =>
      breadcrumbs[(next - count + i + MAX_BREADCRUMBS) % MAX_BREADCRUMBS],
  );
  const { detail, stack } = errorDetails(error, message);
  return {
    message,
    title: `[游戏报错] ${[...detail.replace(/\s+/g, " ")].slice(0, 80).join("")}`,
    context: [
      "## 报错",
      codeBlock(`${message}\n${detail}`),
      "## 构建与浏览器",
      codeBlock(
        `commit: ${import.meta.env.VITE_COMMIT_SHA || "本地构建"}\nUA: ${navigator.userAgent}\n页面: ${location.pathname}`,
      ),
      "## 当前快照摘要",
      codeBlock(summary),
      "## 最近面包屑",
      codeBlock(recent.join("\n") || "暂无记录"),
    ].join("\n\n"),
    stack,
  };
}

export function diagnosticMarkdown(report: DiagnosticReport): string {
  return `${report.context}\n\n## 堆栈\n\n${codeBlock(report.stack)}`;
}

export function issueUrl(report: DiagnosticReport): string {
  const url = new URL(`https://github.com/${GITHUB_REPOSITORY}/issues/new`);
  url.searchParams.set("title", report.title);
  url.searchParams.set("labels", "bug");
  const body = diagnosticMarkdown(report);
  url.searchParams.set("body", body);
  if (url.href.length <= ISSUE_URL_LIMIT) return url.href;

  const chars = [...body];
  let low = 0;
  let high = Math.min(chars.length, ISSUE_URL_LIMIT);
  const setExcerpt = (length: number) => {
    url.searchParams.set(
      "body",
      `${chars.slice(0, length).join("").trimEnd()}\n\n（已截断。完整现场可从游戏内复制。）`,
    );
  };
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    setExcerpt(middle);
    if (url.href.length <= ISSUE_URL_LIMIT) low = middle;
    else high = middle - 1;
  }
  setExcerpt(low);
  return url.href;
}
