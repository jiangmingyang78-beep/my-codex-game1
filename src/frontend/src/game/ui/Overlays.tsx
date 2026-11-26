import { commands } from "./commands";
import { useUi } from "./store";

const TONE = {
  info: "border-border text-foreground",
  good: "border-success text-success",
  warn: "border-warning text-warning",
} as const;

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute bottom-28 left-1/2 flex w-[min(24rem,90vw)] -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-32"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <p
          key={t.id}
          className={`pixel-panel-flat w-full px-3 py-1.5 text-center text-sm ${TONE[t.tone]}`}
        >
          {t.text}
        </p>
      ))}
    </div>
  );
}

export function PromptBubble() {
  const prompt = useUi((s) => s.prompt);
  if (!prompt) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        commands.interact();
        e.currentTarget.blur();
      }}
      style={{ left: prompt.x, top: prompt.y }}
      className="pixel-panel-flat font-pixel pointer-events-auto absolute -translate-x-1/2 -translate-y-full whitespace-nowrap px-2.5 py-1 text-xs text-ember-glow"
    >
      {prompt.text}
    </button>
  );
}
