export interface Command {
  redo(): void;
  undo(): void;
}
export class CommandStack {
  private past: Command[] = [];
  private future: Command[] = [];
  get undoCount() {
    return this.past.length;
  }
  get redoCount() {
    return this.future.length;
  }
  run(command: Command) {
    command.redo();
    this.past.push(command);
    if (this.past.length > 50) this.past.shift();
    this.future = [];
  }
  undo() {
    const command = this.past.pop();
    if (command) {
      command.undo();
      this.future.push(command);
    }
  }
  redo() {
    const command = this.future.pop();
    if (command) {
      command.redo();
      this.past.push(command);
    }
  }
}
export function bindHistory(undo: () => void, redo: () => void) {
  window.addEventListener("keydown", (e) => {
    if ((!e.ctrlKey && !e.metaKey) || e.altKey || document.querySelector("dialog[open]")) return;
    const key = e.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    e.preventDefault();
    if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "range")
      document.activeElement.blur();
    if (key === "y" || e.shiftKey) redo();
    else undo();
  });
}
