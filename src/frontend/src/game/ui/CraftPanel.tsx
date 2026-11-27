import { Flame, X } from "lucide-react";
import { useState } from "react";
import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { type RecipeCategory, type RecipeRow, useUi } from "./store";

type CraftFilter = "all" | RecipeCategory;

const FILTERS: readonly { id: CraftFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "equipment", label: "装备" },
  { id: "supply", label: "补给" },
  { id: "camp", label: "营火与材料" },
];

function RecipeCard({ row }: { row: RecipeRow }) {
  if (!row.unlocked)
    return (
      <li className="pixel-panel-flat border-dashed p-3 text-muted-foreground">
        <h3>未解锁 · {row.name}</h3>
        <p className="text-xs">
          {row.hint} · 需营火 Lv.{row.minCampLevel}
        </p>
      </li>
    );
  const disabled = row.blockedReason !== null || row.shortfallText !== null;
  const note = row.blockedReason ?? row.shortfallText;
  return (
    <li className="pixel-panel-flat flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-pixel text-sm font-bold text-ember-glow">
          {row.name}{" "}
          {row.unread && (
            <button
              type="button"
              aria-label={`查看新配方：${row.name}`}
              className="border border-ember px-1 text-xs text-ember"
              onClick={() => commands.viewRecipe(row.id)}
            >
              新 · 查看
            </button>
          )}
        </h3>
        <span className="font-pixel shrink-0 text-xs text-frost">
          需营火 Lv.{row.minCampLevel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{row.description}</p>
      {row.levelChange && (
        <p className="font-pixel text-xs text-accent">{row.levelChange}</p>
      )}
      <ul className="flex flex-wrap gap-1.5">
        {row.materials.map((m) => (
          <li
            key={m.itemId}
            className={`border-2 px-1.5 py-0.5 text-xs tabular-nums ${
              m.have >= m.need
                ? "border-success/60 text-success"
                : "border-hp/70 text-hp"
            }`}
          >
            {m.name} {m.have}/{m.need}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2">
        <p
          className={`text-xs ${row.blockedReason ? "text-warning" : "text-hp"}`}
        >
          {note ?? "材料齐全"}
        </p>
        <PixelButton
          disabled={disabled}
          onClick={() => {
            commands.viewRecipe(row.id);
            commands.craft(row.id);
          }}
          className="shrink-0 px-3 py-1.5"
        >
          制作
        </PixelButton>
      </div>
    </li>
  );
}

export function CraftPanel() {
  const craft = useUi((s) => s.craft);
  const [filter, setFilter] = useState<CraftFilter>("all");
  const [showLocked, setShowLocked] = useState(false);
  if (!craft) return null;
  const rows =
    filter === "all"
      ? craft.rows
      : craft.rows.filter((row) => row.category === filter);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/60 p-3">
      <section
        aria-label="营火制作"
        className="pixel-panel flex max-h-full w-full max-w-4xl flex-col gap-3 p-4"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-pixel flex items-center gap-2 text-lg font-bold text-ember-glow">
              <Flame size={20} /> 营火制作
            </h2>
            <p className="text-xs text-frost">
              营火等级 Lv.{craft.campLevel} / {craft.maxCampLevel} · 接力火盆
              持有 {craft.relayKits}，空闲火站 {craft.unlitRelays}
            </p>
          </div>
          <PixelButton
            variant="ghost"
            aria-label="关闭"
            onClick={() => commands.closeCraft()}
            className="p-2"
          >
            <X size={16} />
          </PixelButton>
        </header>
        <div
          role="tablist"
          aria-label="配方分类"
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`font-pixel border-2 px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-frost ${
                  active
                    ? "border-ember bg-ember/15 text-ember"
                    : "border-border bg-muted text-foreground hover:border-frost"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="text-xs text-frost">
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(e) => setShowLocked(e.target.checked)}
          />{" "}
          显示未解锁剪影
        </label>
        <ul className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
          {rows
            .filter((row) => row.unlocked || showLocked)
            .map((row) => (
              <RecipeCard key={row.id} row={row} />
            ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          面板打开期间时间暂停。接力火盆在废磨坊火盆旁按 E 点燃。
        </p>
      </section>
    </div>
  );
}
