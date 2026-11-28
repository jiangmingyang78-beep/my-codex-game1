import { CloudRain, Flame, Leaf, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DIORAMA_H,
  DIORAMA_W,
  SEASONS,
  SEASON_DURATION_SEC,
  type SeasonId,
} from "./seasons/seasonsData";
import { sampleDioramaState } from "./seasons/seasonsSample";
import { drawSeasonalScene } from "./seasons/seasonsScene";
import { drawSeasonalAtmosphere } from "./seasons/seasonsWeather";

function SeasonIcon({ id }: { id: SeasonId }) {
  switch (id) {
    case "spring":
      return <CloudRain size={13} aria-hidden="true" className="text-frost" />;
    case "summer":
      return <Sparkles size={13} aria-hidden="true" className="text-warning" />;
    case "autumn":
      return <Leaf size={13} aria-hidden="true" className="text-ember" />;
    case "winter":
      return <Flame size={13} aria-hidden="true" className="text-ember-glow" />;
  }
}

/** Stardew-inspired 4-season pixel diorama cycling lighting and weather for the landing menu. */
export function SeasonsDiorama() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startMsRef = useRef(0);
  const offsetSecRef = useRef(0);
  const lastIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false;

    const reduced =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
    let rafId = 0;
    const startMs = performance.now();
    startMsRef.current = startMs;

    const renderFrame = (nowMs: number) => {
      const elapsedSec = (nowMs - startMs) / 1000;
      const cycleSec = offsetSecRef.current + (reduced ? 0 : elapsedSec);
      const st = sampleDioramaState(cycleSec);
      if (st.seasonIndex !== lastIndexRef.current) {
        lastIndexRef.current = st.seasonIndex;
        setActiveIndex(st.seasonIndex);
      }
      drawSeasonalScene(ctx, st, elapsedSec);
      drawSeasonalAtmosphere(ctx, st, elapsedSec);
      if (!reduced) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame(startMs);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const jumpToSeason = (index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const reduced =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
      false;
    const elapsedSec = (performance.now() - startMsRef.current) / 1000;
    const targetSec = index * SEASON_DURATION_SEC + 0.8;
    offsetSecRef.current = targetSec - (reduced ? 0 : elapsedSec);
    lastIndexRef.current = index;
    setActiveIndex(index);
    if (ctx) {
      const st = sampleDioramaState(targetSec);
      drawSeasonalScene(ctx, st, elapsedSec);
      drawSeasonalAtmosphere(ctx, st, elapsedSec);
    }
  };

  const season = SEASONS[activeIndex];
  return (
    <div
      aria-label="The four-season shades of survival pattern are changing from weather to weather"
      className="relative overflow-hidden border-2 border-border bg-night"
    >
      <canvas
        ref={canvasRef}
        width={DIORAMA_W}
        height={DIORAMA_H}
        className="block aspect-[320/124] w-full [image-rendering:pixelated]"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-night/80 via-night/40 to-transparent px-2.5 py-2">
        <div className="flex items-center gap-1.5 border border-border/80 bg-night/75 px-2 py-0.5 text-xs">
          <SeasonIcon id={season.id} />
          <span className="font-pixel font-bold text-foreground">
            {season.title}
          </span>
          <span className="hidden text-frost sm:inline">
            · {season.timeLabel} · {season.weatherLabel}
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Switches to the four-quarter preview"
          className="pointer-events-auto flex gap-1"
        >
          {SEASONS.map((item, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => jumpToSeason(idx)}
                className={`font-pixel border px-1.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-ember bg-ember/20 text-ember"
                    : "border-border/80 bg-night/70 text-muted-foreground hover:border-frost hover:text-foreground"
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-night/85 via-night/40 to-transparent px-2.5 py-1.5 text-xs text-frost">
        <span>• Four seasons of gyro-smoke weather cycle</span>
        <span className="hidden text-muted-foreground sm:inline">
          Click the upper right corner to switch the season preview
        </span>
      </div>
    </div>
  );
}
