import { Flame, X } from "lucide-react";
import { useState } from "react";
import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { type RecipeCategory, type RecipeRow, useUi } from "./store";

type CraftFilter = "all" | RecipeCategory;

const FILTERS: readonly { id: CraftFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equipment", label: "Equipment" },
  { id: "supply", label: "Supplies" },
  { id: "camp", label: "Camp and materials" },
];

function RecipeCard({ row }: { row: RecipeRow }) {
  if (!row.unlocked)
    return (
      <li className="pixel-panel-flat border-dashed p-3 text-muted-foreground">
        <h3>Locked · {row.name}</h3>
        <p className="text-xs">
          {row.hint} · Requires a Level {row.minCampLevel} campfire
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
              aria-label={`View new recipe: ${row.name}`}
              className="border border-ember px-1 text-xs text-ember"
              onClick={() => commands.viewRecipe(row.id)}
            >
              New · View
            </button>
          )}
        </h3>
        <span className="font-pixel shrink-0 text-xs text-frost">
          Campfire Lv. {row.minCampLevel}
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
          {note ?? "All materials are available"}
        </p>
        <PixelButton
          disabled={disabled}
          onClick={() => {
            commands.viewRecipe(row.id);
            commands.craft(row.id);
          }}
          className="shrink-0 px-3 py-1.5"
        >
          Craft
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
        aria-label="Campfire crafting"
        className="pixel-panel flex max-h-full w-full max-w-4xl flex-col gap-3 p-4"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-pixel flex items-center gap-2 text-lg font-bold text-ember-glow">
              <Flame size={20} /> Campfire crafting
            </h2>
            <p className="text-xs text-frost">
              Campfire level {craft.campLevel} / {craft.maxCampLevel} · Relay
              Braziers {craft.relayKits} · Unlit fire stations{" "}
              {craft.unlitRelays}
            </p>
          </div>
          <PixelButton
            variant="ghost"
            aria-label="Close"
            onClick={() => commands.closeCraft()}
            className="p-2"
          >
            <X size={16} />
          </PixelButton>
        </header>
        <div
          role="tablist"
          aria-label="Formula classification"
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
          Displays unlocked clips
        </label>
        <ul className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
          {rows
            .filter((row) => row.unlocked || showLocked)
            .map((row) => (
              <RecipeCard key={row.id} row={row} />
            ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          The time is paused during the panel opening. The relay fire basins are
          set on E by the scrap mill fire.
        </p>
      </section>
    </div>
  );
}
