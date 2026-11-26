import { CommandStack } from "./commandStack";
import { type Draft, type FileKey, type Path, diffFields, files, put, valueAt } from "./documents";
export { validateDraft } from "./validation";
export class ConsoleStore extends EventTarget {
  readonly history = new CommandStack();
  draft: Draft;
  baseline: Draft;
  constructor(data: Draft, baseline: Draft) {
    super();
    this.draft = structuredClone(data);
    this.baseline = structuredClone(baseline);
  }
  notify() {
    this.dispatchEvent(new Event("change"));
  }
  replace(next: Draft) {
    const prev = this.draft;
    if (!files.some((k) => prev[k] !== next[k])) return;
    this.history.run({
      redo: () => {
        this.draft = next;
      },
      undo: () => {
        this.draft = prev;
      },
    });
    this.notify();
  }
  edit<K extends FileKey>(file: K, edit: (doc: Draft[K]) => void) {
    const doc = structuredClone(this.draft[file]);
    edit(doc);
    if (diffFields(this.draft[file], doc).length) this.replace({ ...this.draft, [file]: doc });
  }
  field(file: FileKey, path: Path, value: unknown) {
    this.edit(file, (doc) => put(doc, path, value));
  }
  reset(file: FileKey, path: Path) {
    this.edit(file, (doc) => {
      const parentPath = path.slice(0, -1),
        parent = valueAt(doc, parentPath),
        baseParent = valueAt(this.baseline[file], parentPath);
      const index = Number(path.at(-1));
      if (Array.isArray(parent) && Array.isArray(baseParent) && index > parent.length)
        parent.push(...structuredClone(baseParent.slice(parent.length, index)));
      put(doc, path, valueAt(this.baseline[file], path));
      for (let depth = path.length - 1; depth > 0; depth--) {
        const ancestor = path.slice(0, depth),
          v = valueAt(doc, ancestor);
        if (
          valueAt(this.baseline[file], ancestor) !== undefined ||
          !v ||
          typeof v !== "object" ||
          Object.keys(v).length
        )
          break;
        put(doc, ancestor, undefined);
      }
    });
  }
  changes() {
    return files.flatMap((file) => diffFields(this.baseline[file], this.draft[file]).map((d) => ({ ...d, file })));
  }
  undo() {
    this.history.undo();
    this.notify();
  }
  redo() {
    this.history.redo();
    this.notify();
  }
  accept(file: FileKey, committed: Draft[FileKey]) {
    this.baseline = { ...this.baseline, [file]: structuredClone(committed) };
    this.notify();
  }
  preset() {
    return JSON.stringify({ version: 1, files: this.draft }, null, 2) + "\n";
  }
}
