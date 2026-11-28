import { useEffect, useState } from "react";
import { PixelButton } from "../ui/PixelButton";
import { type DevEnemyOption, commands } from "../ui/commands";
import { toast } from "../ui/toastBridge";
import { renderMetrics } from "./renderMetrics";
import { spawnDebug } from "./spawnDebug";

export function DevToolbar() {
  const [metrics, setMetrics] = useState({ ...renderMetrics });
  const [debug, setDebug] = useState(spawnDebug.enabled);
  const [open, setOpen] = useState(false);
  const [godMode, setGodMode] = useState(
    () => commands.dev?.isGodMode() ?? false,
  );
  const [enemies, setEnemies] = useState<DevEnemyOption[]>(
    () => commands.dev?.listEnemies() ?? [],
  );
  const [selectedEnemy, setSelectedEnemy] = useState<string>(
    () =>
      enemies.find((e) => e.id === "mill_overseer")?.id ?? enemies[0]?.id ?? "",
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setMetrics({ ...renderMetrics }), 500);
    return () => window.clearInterval(id);
  }, [open]);
  const syncDevList = () => {
    const list = commands.dev?.listEnemies() ?? [];
    if (list.length > 0) {
      setEnemies(list);
      setSelectedEnemy(
        (prev) =>
          prev ||
          (list.find((e) => e.id === "mill_overseer")?.id ?? list[0].id),
      );
    }
    setGodMode(commands.dev?.isGodMode() ?? false);
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const list = commands.dev?.listEnemies() ?? [];
    if (list.length > 0) {
      setEnemies(list);
      setSelectedEnemy(
        (prev) =>
          prev ||
          (list.find((e) => e.id === "mill_overseer")?.id ?? list[0].id),
      );
    }
    setGodMode(commands.dev?.isGodMode() ?? false);
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.code === "Backquote") {
        event.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            const refreshed = commands.dev?.listEnemies() ?? [];
            if (refreshed.length > 0) {
              setEnemies(refreshed);
              setSelectedEnemy(
                (sel) =>
                  sel ||
                  (refreshed.find((e) => e.id === "mill_overseer")?.id ??
                    refreshed[0].id),
              );
            }
            setGodMode(commands.dev?.isGodMode() ?? false);
          }
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!import.meta.env.DEV) return null;

  const act = (fn: (() => void) | undefined, message?: string) => {
    fn?.();
    if (message) toast.info(message, `dev:${message}`);
  };

  if (!open) {
    return (
      <div className="pointer-events-auto absolute bottom-2 right-2 z-30 sm:bottom-3 sm:right-3">
        <PixelButton
          variant="ghost"
          aria-label="Open the debug panel for DeV"
          onClick={() => {
            syncDevList();
            setOpen(true);
          }}
          className="font-pixel px-2 py-1 text-xs text-frost"
        >
          DEV
        </PixelButton>
      </div>
    );
  }

  return (
    <section
      aria-label="DeV debug tool"
      className="pixel-panel pointer-events-auto absolute bottom-2 right-2 z-30 flex w-[min(25rem,calc(100vw-1rem))] flex-col gap-2 p-2.5 text-xs sm:bottom-3 sm:right-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel font-bold text-ember">
          DeV Rendering CPU {metrics.cpuMs.toFixed(2)} - I'm sorry, I'm sorry{" "}
          {metrics.batches} · Night rewrite {metrics.frameMasks} · Photo-based
          upload {metrics.frameUploads}
        </span>
        <PixelButton
          variant="ghost"
          onClick={() => setOpen(false)}
          className="px-2 py-0.5 text-xs"
        >
          Close
        </PixelButton>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(
              commands.dev?.grantAllGear,
              "DeV: Full equipment and supplies have been issued",
            )
          }
          className="px-2 py-1 text-xs"
        >
          One key full
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(
              commands.dev?.restoreAndReset,
              "DeV: Full state and reset cooling",
            )
          }
          className="px-2 py-1 text-xs"
        >
          Full state / Clear cool
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => act(commands.dev?.simulateHit)}
          className="px-2 py-1 text-xs"
        >
          Simulate hit (CEA)
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(commands.dev?.togglePhase, "DeV: Switched to day and night")
          }
          className="px-2 py-1 text-xs"
        >
          Cut the night and day
        </PixelButton>
        <PixelButton
          variant={godMode ? "ember" : "ghost"}
          onClick={() => {
            const next = commands.dev?.toggleGodMode() ?? false;
            setGodMode(next);
            toast.info(
              next ? "DeV: Invincible opened" : "DeV: Invincible closed. —",
              "dev:godmode",
            );
          }}
          className="px-2 py-1 text-xs"
        >
          {godMode ? "Invincible: open" : "Invincible: Close"}
        </PixelButton>
      </div>
      <label>
        <input
          type="checkbox"
          checked={debug}
          onChange={(e) => {
            spawnDebug.enabled = e.target.checked;
            setDebug(e.target.checked);
          }}
        />{" "}
        Show safe lighting and spawn rings
      </label>
      {debug && (
        <canvas
          id="spawn-debug-map"
          width={150}
          height={150}
          aria-label="Safe light, eyes and brush rings"
        />
      )}
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Choose a monster"
          value={selectedEnemy}
          onChange={(e) => {
            setSelectedEnemy(e.target.value);
            e.currentTarget.blur();
          }}
          className="min-w-0 flex-1 border-2 border-border bg-muted px-2 py-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-frost"
        >
          {enemies.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.id})
            </option>
          ))}
        </select>
        <PixelButton
          variant="ember"
          onClick={() => {
            if (!selectedEnemy) return;
            const ok = commands.dev?.spawnEnemy(selectedEnemy);
            if (ok) toast.gain(`DR: Called ${selectedEnemy}`, "dev:spawn");
            else toast.warn("DR: Call failed", "dev:spawn_fail");
          }}
          className="shrink-0 px-2.5 py-1 text-xs"
        >
          Call
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(
              commands.dev?.clearEnemies,
              "DeV: Cleared the battlefield monster",
            )
          }
          className="shrink-0 px-2.5 py-1 text-xs"
        >
          Clear
        </PixelButton>
      </div>
    </section>
  );
}
