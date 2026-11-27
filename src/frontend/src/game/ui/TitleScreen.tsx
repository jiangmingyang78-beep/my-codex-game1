import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { HeroPortrait } from "./HeroPortrait";
import { PixelButton } from "./PixelButton";
import { SeasonsDiorama } from "./SeasonsDiorama";
import { commands } from "./commands";
import { useUi } from "./store";

const CONTROLS: [string, string][] = [
  ["WASD / 方向键", "移动"],
  ["E", "互动 / 采集"],
  ["空格", "攻击"],
  ["Shift", "踏雪急步"],
  ["1–9", "快捷使用"],
  ["Esc", "暂停"],
];

function formatBest(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function TitleScreen() {
  const [adventureOpen, setAdventureOpen] = useState(false);
  const title = useUi((s) => s.title);
  const selected = title.heroes.find(
    ({ definition }) => definition.id === title.selectedHeroId,
  );
  const hero = selected?.definition;
  return (
    <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-night/40 px-3">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-4 py-4">
        <header className="text-center">
          <p className="font-pixel text-xs tracking-[4px] text-frost text-pixel-shadow">
            {title.worldTagline} · v3.1.0
          </p>
          <h1 className="font-pixel mt-2 text-2xl font-bold text-ember-glow sm:text-3xl">
            余烬林：最后一炬
          </h1>
        </header>
        <div className="pixel-panel pointer-events-auto flex flex-col gap-3 p-3 sm:p-5">
          {adventureOpen ? (
            <>
              <div
                aria-label="选择英雄"
                className="grid grid-cols-2 gap-1 min-[400px]:grid-cols-3 sm:grid-cols-5 sm:gap-2"
              >
                {title.heroes.map(({ definition, unlocked }) => {
                  const active = definition.id === title.selectedHeroId;
                  const color = active
                    ? "border-ember bg-ember/10 text-ember"
                    : "border-border bg-muted text-foreground";
                  return (
                    <button
                      key={definition.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => commands.selectHero(definition.id)}
                      className={`flex min-w-0 flex-col items-center gap-1.5 border-2 px-1 py-2 hover:border-frost focus-visible:outline-2 focus-visible:outline-frost ${color}`}
                    >
                      <HeroPortrait hero={definition} unlocked={unlocked} />
                      <span className="font-pixel text-xs font-bold sm:text-sm">
                        {definition.name}
                      </span>
                      <span className="hidden text-xs sm:inline">
                        {definition.roleTag}
                      </span>
                      <span
                        className={
                          unlocked
                            ? "text-xs text-frost"
                            : "flex items-center gap-0.5 text-xs text-muted-foreground"
                        }
                      >
                        {!unlocked && (
                          <LockKeyhole
                            size={12}
                            aria-hidden="true"
                            className="hidden sm:block"
                          />
                        )}
                        {unlocked ? "已解锁" : "未解锁"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {hero && (
                <div
                  className="pixel-panel-flat flex items-start gap-3 px-3 py-2.5 text-sm"
                  aria-live="polite"
                >
                  <HeroPortrait
                    hero={hero}
                    unlocked={selected?.unlocked ?? true}
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <h2 className="font-pixel font-bold text-frost">
                      {hero.name} · {hero.epithet}
                    </h2>
                    <p>{hero.bio}</p>
                    <p className="text-muted-foreground">「{hero.quote}」</p>
                    <p>
                      <span className="font-bold text-ember">
                        {hero.traitName}
                      </span>{" "}
                      · {hero.traitDesc}
                    </p>
                    {selected && !selected.unlocked && (
                      <p id="hero-unlock-condition" className="text-warning">
                        解锁条件 · {selected.unlockText}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-sm font-bold text-ember">
                    冒险模式
                  </span>
                  <PixelButton
                    variant="ghost"
                    onClick={() => setAdventureOpen(false)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs"
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                    返回
                  </PixelButton>
                </div>
                <PixelButton
                  data-ocid="title.new_game_button"
                  disabled={selected?.unlocked === false}
                  aria-describedby={
                    selected?.unlocked === false
                      ? "hero-unlock-condition"
                      : undefined
                  }
                  onClick={() => commands.newGame()}
                  className="w-full py-2.5 text-base disabled:opacity-50"
                >
                  新游戏
                </PixelButton>
                <PixelButton
                  variant="ghost"
                  data-ocid="title.continue_button"
                  disabled={!title.hasSave}
                  onClick={() => commands.continueGame()}
                  className="w-full py-2.5 text-base"
                >
                  继续游戏
                </PixelButton>
                <PixelButton
                  data-ocid="title.eternal_button"
                  disabled={selected?.unlocked === false}
                  onClick={() => commands.newEternal()}
                  className="flex flex-col items-center gap-0.5 py-2 text-base disabled:opacity-50"
                >
                  <span>永恒模式</span>
                  <span className="text-xs font-normal">
                    自选装备 · 坚守孤火 · 无尽浪潮
                  </span>
                  {title.eternalBestSec !== undefined && (
                    <span className="text-xs text-frost">
                      最佳存活 {formatBest(title.eternalBestSec)} · 最高击杀{" "}
                      {title.eternalBestKills ?? 0}
                    </span>
                  )}
                </PixelButton>
              </div>
            </>
          ) : (
            <>
              <SeasonsDiorama />
              <div className="grid grid-cols-2 gap-2">
                <PixelButton
                  data-ocid="title.adventure_button"
                  onClick={() => setAdventureOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 text-base"
                >
                  <span>冒险模式</span>
                  <span className="text-xs font-normal">
                    {title.hasSave
                      ? "可继续存档 · 探索雪林"
                      : "探索雪林 · 点燃烽台"}
                  </span>
                </PixelButton>
                <PixelButton
                  variant="ghost"
                  data-ocid="title.survival_button"
                  onClick={() => window.location.assign("./survival.html")}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 text-base"
                >
                  <span>生存模式</span>
                  <span className="text-xs font-normal text-frost">
                    沙盒营地 · 联动 {title.crossModeUnlockCount}/
                    {title.crossModeUnlockTotal}
                  </span>
                </PixelButton>
              </div>
            </>
          )}
          {title.notice && (
            <output className="block border-2 border-warning/60 bg-night/70 px-3 py-2 text-xs text-warning">
              {title.notice}
            </output>
          )}
          {!title.hasSave && !title.notice && (
            <p className="text-center text-xs text-muted-foreground">
              暂无存档
            </p>
          )}
        </div>
        <dl className="pixel-panel-flat flex flex-wrap justify-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
          {CONTROLS.map(([key, action]) => (
            <div key={key} className="flex gap-1">
              <dt className="font-pixel text-ember">{key}</dt>
              <dd className="text-foreground">{action}</dd>
            </div>
          ))}
        </dl>
        {title.notes.length > 0 && (
          <div className="pixel-panel-flat pointer-events-auto px-3 py-2 text-xs">
            {title.notes.map((n) => (
              <details key={n.id} className="py-1">
                <summary className="cursor-pointer font-pixel text-frost">
                  {n.title}
                </summary>
                <p className="mt-1 text-foreground">{n.body}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
