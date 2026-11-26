import { type Draft, files, isRecord } from "../state/documents";
import { bindHistory } from "../state/commandStack";
import { validateDraft } from "../state/validation";
import type { Session } from "../state/selection";
import { button, el } from "./controls";
export async function api(route: string, payload?: unknown) {
  const r = await fetch(
    "/api/console/" + route,
    payload === undefined
      ? {}
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "服务请求失败");
  return data;
}
export function actions(s: Session) {
  const id = (k: string) => document.getElementById(k)!;
  const dialog = document.querySelector<HTMLDialogElement>("#review")!,
    content = id("reviewBody"),
    foot = id("reviewFoot");
  const close = button("关闭", () => dialog.close());
  let busy = false;
  dialog.oncancel = (e) => {
    if (busy) e.preventDefault();
  };
  function modal(title: string) {
    id("reviewTitle").textContent = title;
    content.replaceChildren();
    foot.replaceChildren(close);
    close.disabled = busy;
    if (!dialog.open) dialog.showModal();
  }
  function issueList(errors: ReturnType<typeof validateDraft>) {
    for (const i of errors) content.append(el("p", [i.file, ...i.path].join(".") + " · " + i.message, "danger"));
  }
  function validate() {
    return validateDraft(s.store.draft, s.store.baseline, s.base);
  }
  function showReport(result: {
    alerts: { cat: string; sev: string; target: string; detail: string }[];
    ttkRisks: { name: string; seconds: number }[];
    materials: string[];
    summary: string;
  }) {
    modal("数值体检结果");
    const warn = result.alerts.filter((a) => /严重|警告/.test(a.sev));
    content.append(el("h3", "异常告警 · " + warn.length));
    warn.forEach((a) => content.append(el("p", a.target + " · " + a.detail, "warning")));
    content.append(el("h3", "徒手 TTK 最长的 5 只怪物"));
    result.ttkRisks.forEach((e) => content.append(el("p", e.name + " · " + e.seconds.toFixed(2) + " 秒")));
    content.append(el("h3", "材料供需"));
    result.materials.forEach((m) => content.append(el("p", m, m.includes("⚠") ? "warning" : "")));
    const d = el("details");
    d.append(el("summary", "完整摘要"), el("pre", result.summary));
    content.append(d);
  }
  function review(check: boolean) {
    modal(check ? "保存并运行数值体检" : "查看 Diff 并保存");
    const changes = s.store.changes(),
      errors = validate();
    content.append(
      el(
        "p",
        errors.length ? "发现 " + errors.length + " 项校验错误" : "校验通过 · " + changes.length + " 处改动",
        errors.length ? "danger" : "pass",
      ),
    );
    issueList(errors);
    for (const file of files) {
      const list = changes.filter((d) => d.file === file);
      if (!list.length) continue;
      content.append(el("h3", file));
      for (const d of list) {
        const r = el("div", "", "diff");
        r.append(
          el("code", d.path.join(".")),
          el("span", (JSON.stringify(d.before) ?? "∅") + " → " + (JSON.stringify(d.after) ?? "∅")),
        );
        r.append(
          button("↺", () => {
            s.store.reset(file, d.path);
            review(check);
          }),
        );
        content.append(r);
      }
    }
    const save = button(check ? "确认保存并体检" : "确认保存", async () => {
      busy = true;
      modal("正在写入");
      content.textContent = "正在核对磁盘基准…";
      try {
        const pending = new Set(changes.map((d) => d.file));
        while (pending.size) {
          const file = [...pending].find(
            (k) => !validateDraft({ ...s.store.baseline, [k]: s.store.draft[k] }, s.store.baseline, s.base).length,
          );
          if (!file) throw Error("跨文件引用无法分步写入，请拆分本次修改。");
          pending.delete(file);
          const data = s.store.draft[file];
          await api("save", { file, data, baseline: s.store.baseline[file] });
          s.store.accept(file, data);
        }
        if (check) {
          content.textContent = "正在运行数值体检…";
          showReport(await api("balance-check", {}));
        } else {
          modal("保存完成");
          content.textContent = "所有改动已写入磁盘。";
        }
      } catch (e) {
        modal("操作中断");
        content.append(el("p", String(e), "danger"), el("p", "已写入的文件已更新基准，其余改动仍保留在草稿中。"));
      } finally {
        busy = false;
        close.disabled = false;
      }
    });
    save.disabled = !!errors.length || (!changes.length && !check);
    foot.prepend(save);
  }
  id("btnReview").onclick = () => review(false);
  id("btnCheck").onclick = () => review(true);
  bindHistory(
    () => s.store.undo(),
    () => s.store.redo(),
  );
  id("btnUndo").onclick = () => s.store.undo();
  id("btnRedo").onclick = () => s.store.redo();
  id("btnPresetOut").onclick = () => {
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([s.store.preset()], { type: "application/json" }));
    a.download = "余烬林-调参预设.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const picker = id("presetFile") as HTMLInputElement;
  id("btnPresetIn").onclick = () => picker.click();
  picker.onchange = async () => {
    try {
      const file = picker.files?.[0];
      if (!file) return;
      if (file.size > 2e6) throw Error("预设过大");
      const raw = JSON.parse(await file.text());
      if (
        raw?.version !== 1 ||
        !isRecord(raw.files) ||
        Object.keys(raw.files).length !== files.length ||
        !files.every((f) => Object.hasOwn(raw.files, f))
      )
        throw Error("预设文件表或版本无效");
      const draft = raw.files as Draft,
        errors = validateDraft(draft, s.store.baseline, s.base);
      if (errors.length) {
        modal("预设校验失败");
        issueList(errors);
      } else s.store.replace(draft);
    } catch (e) {
      modal("无法导入预设");
      content.append(el("p", String(e), "danger"));
    } finally {
      picker.value = "";
    }
  };
  const update = () => {
    const errors = validate(),
      n = s.store.changes().length;
    id("changeCount").textContent = String(n);
    id("changeCount").hidden = !n;
    for (const [key, count] of [
      ["Undo", s.store.history.undoCount],
      ["Redo", s.store.history.redoCount],
    ] as const) {
      const b = id("btn" + key) as HTMLButtonElement;
      b.textContent = (key === "Undo" ? "撤销" : "重做") + " " + count;
      b.disabled = count === 0;
    }
    const area = id("validation");
    area.hidden = !errors.length;
    area.textContent = errors.map((i) => [i.file, ...i.path].join(".") + " · " + i.message).join("\n");
    document.querySelectorAll<HTMLElement>("[data-field]").forEach((r) => {
      r.classList.toggle(
        "invalid",
        errors.some((i) => JSON.stringify([i.file, ...i.path]) === r.dataset.field),
      );
    });
    id("diskState").textContent = n ? "草稿 · " + n + " 处改动" : "已与磁盘同步";
  };
  window.addEventListener("beforeunload", (e) => {
    if (s.store.changes().length) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  return update;
}
