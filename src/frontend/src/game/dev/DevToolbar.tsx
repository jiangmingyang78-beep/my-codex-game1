import { useEffect, useState } from "react";
import { PixelButton } from "../ui/PixelButton";
import { type DevEnemyOption, commands } from "../ui/commands";
import { toast } from "../ui/toastBridge";
import { renderMetrics } from "./renderMetrics";
import { spawnDebug } from "./spawnDebug";

export function DevToolbar() {
  const [renderMs, setRenderMs] = useState(0);
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
    const id = window.setInterval(() => setRenderMs(renderMetrics.cpuMs), 500);
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
          aria-label="打开 DEV 调试面板"
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
      aria-label="DEV 调试工具"
      className="pixel-panel pointer-events-auto absolute bottom-2 right-2 z-30 flex w-[min(25rem,calc(100vw-1rem))] flex-col gap-2 p-2.5 text-xs sm:bottom-3 sm:right-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel font-bold text-ember">
          DEV · 渲染 CPU {renderMs.toFixed(2)} ms
        </span>
        <PixelButton
          variant="ghost"
          onClick={() => setOpen(false)}
          className="px-2 py-0.5 text-xs"
        >
          收起
        </PixelButton>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(commands.dev?.grantAllGear, "DEV：已发放全套装备与补给")
          }
          className="px-2 py-1 text-xs"
        >
          一键全装
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() =>
            act(commands.dev?.restoreAndReset, "DEV：已满状态并重置冷却")
          }
          className="px-2 py-1 text-xs"
        >
          满状态 / 清冷却
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => act(commands.dev?.simulateHit)}
          className="px-2 py-1 text-xs"
        >
          模拟受击 (测圆盾)
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => act(commands.dev?.togglePhase, "DEV：已切换昼夜")}
          className="px-2 py-1 text-xs"
        >
          切昼夜
        </PixelButton>
        <PixelButton
          variant={godMode ? "ember" : "ghost"}
          onClick={() => {
            const next = commands.dev?.toggleGodMode() ?? false;
            setGodMode(next);
            toast.info(
              next ? "DEV：无敌已开启" : "DEV：无敌已关闭",
              "dev:godmode",
            );
          }}
          className="px-2 py-1 text-xs"
        >
          {godMode ? "无敌：开" : "无敌：关"}
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
        显示安全光区与刷怪环
      </label>
      {debug && (
        <canvas
          id="spawn-debug-map"
          width={150}
          height={150}
          aria-label="安全光区、视口与刷怪双环"
        />
      )}
      <div className="flex items-center gap-1.5">
        <select
          aria-label="选择怪物"
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
            if (ok) toast.gain(`DEV：已召唤 ${selectedEnemy}`, "dev:spawn");
            else toast.warn("DEV：召唤失败", "dev:spawn_fail");
          }}
          className="shrink-0 px-2.5 py-1 text-xs"
        >
          召唤
        </PixelButton>
        <PixelButton
          variant="ghost"
          onClick={() => act(commands.dev?.clearEnemies, "DEV：已清空战场怪物")}
          className="shrink-0 px-2.5 py-1 text-xs"
        >
          清怪
        </PixelButton>
      </div>
    </section>
  );
}
