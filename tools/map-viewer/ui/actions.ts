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
  if (!r.ok) throw Error(data.error ?? "Service request failed");
  return data;
}
export function actions(s: Session) {
  const id = (k: string) => document.getElementById(k)!;
  const dialog = document.querySelector<HTMLDialogElement>("#review")!,
    content = id("reviewBody"),
    foot = id("reviewFoot");
  const close = button("Close", () => dialog.close());
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
    modal("Balance check results");
    const warn = result.alerts.filter((a) => /Critical|Warning/.test(a.sev));
    content.append(el("h3", "Alerts  ·  " + warn.length));
    warn.forEach((a) => content.append(el("p", a.target + " · " + a.detail, "warning")));
    content.append(el("h3", "Five longest unarmed kill times"));
    result.ttkRisks.forEach((e) => content.append(el("p", e.name + " · " + e.seconds.toFixed(2) + " s")));
    content.append(el("h3", "Material supply and demand"));
    result.materials.forEach((m) => content.append(el("p", m, m.includes("⚠") ? "warning" : "")));
    const d = el("details");
    d.append(el("summary", "Full summary"), el("pre", result.summary));
    content.append(d);
  }
  function review(check: boolean) {
    modal(check ? "Save and check balance" : "Review diff and save");
    const changes = s.store.changes(),
      errors = validate();
    content.append(
      el(
        "p",
        errors.length ? "Found " + errors.length + " validation issues" : "Validation passed  ·  " + changes.length + " Changes",
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
    const save = button(check ? "Confirm save and check balance" : "Confirm save", async () => {
      busy = true;
      modal("Writing");
      content.textContent = "Checking the files on disk";
      try {
        const pending = new Set(changes.map((d) => d.file));
        while (pending.size) {
          const file = [...pending].find(
            (k) => !validateDraft({ ...s.store.baseline, [k]: s.store.draft[k] }, s.store.baseline, s.base).length,
          );
          if (!file) throw Error("These cross-file changes cannot be written in a valid order. Split the edit.");
          pending.delete(file);
          const data = s.store.draft[file];
          await api("save", { file, data, baseline: s.store.baseline[file] });
          s.store.accept(file, data);
        }
        if (check) {
          content.textContent = "Checking balance";
          showReport(await api("balance-check", {}));
        } else {
          modal("Save complete");
          content.textContent = "All changes are written to disk.";
        }
      } catch (e) {
        modal("Operation aborted");
        content.append(el("p", String(e), "danger"), el("p", "Saved files now form the baseline. Remaining changes are still in the draft."));
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
    a.download = "emberwood-map-preset.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const picker = id("presetFile") as HTMLInputElement;
  id("btnPresetIn").onclick = () => picker.click();
  picker.onchange = async () => {
    try {
      const file = picker.files?.[0];
      if (!file) return;
      if (file.size > 2e6) throw Error("The preset file exceeds 2 MB");
      const raw = JSON.parse(await file.text());
      if (
        raw?.version !== 1 ||
        !isRecord(raw.files) ||
        Object.keys(raw.files).length !== files.length ||
        !files.every((f) => Object.hasOwn(raw.files, f))
      )
        throw Error("Invalid preset file table or version");
      const draft = raw.files as Draft,
        errors = validateDraft(draft, s.store.baseline, s.base);
      if (errors.length) {
        modal("Could not import the preset");
        issueList(errors);
      } else s.store.replace(draft);
    } catch (e) {
      modal("Could not import the preset");
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
      b.textContent = (key === "Undo" ? "Undo" : "Redo") + " " + count;
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
    id("diskState").textContent = n ? "Draft  ·  " + n + " Changes" : "Synced with disk";
  };
  window.addEventListener("beforeunload", (e) => {
    if (s.store.changes().length) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  return update;
}
