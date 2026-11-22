import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

const CONTROLS: [string, string][] = [
  ["WASD / 方向键", "移动"],
  ["E", "互动 / 采集"],
  ["空格", "攻击"],
  ["1–4", "快捷使用"],
  ["Esc", "暂停"],
];

export function TitleScreen() {
  const title = useUi((s) => s.title);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 bg-night/40 px-4">
      <div className="text-center">
        <p className="font-pixel text-xs tracking-[0.4em] text-frost text-pixel-shadow">
          雪夜生存 · 守住最后的火光
        </p>
        <h1 className="font-pixel mt-3 text-4xl font-bold text-ember-glow sm:text-5xl">
          余烬林：最后一炬
        </h1>
      </div>
      <div className="pixel-panel pointer-events-auto flex w-full max-w-sm flex-col gap-3 p-5">
        <PixelButton
          data-ocid="title.new_game_button"
          onClick={() => commands.newGame()}
          className="py-3 text-base"
        >
          新游戏
        </PixelButton>
        <PixelButton
          variant="ghost"
          data-ocid="title.continue_button"
          disabled={!title.hasSave}
          onClick={() => commands.continueGame()}
          className="py-3 text-base"
        >
          继续游戏
        </PixelButton>
        {title.notice && (
          <output className="block border-2 border-warning/60 bg-night/70 px-3 py-2 text-xs text-warning">
            {title.notice}
          </output>
        )}
        {!title.hasSave && !title.notice && (
          <p className="text-center text-xs text-muted-foreground">暂无存档</p>
        )}
      </div>
      <dl className="pixel-panel-flat pointer-events-none grid grid-cols-[auto_auto] gap-x-4 gap-y-1 px-4 py-3 text-xs">
        {CONTROLS.map(([key, action]) => (
          <div key={key} className="contents">
            <dt className="font-pixel text-ember">{key}</dt>
            <dd className="text-foreground">{action}</dd>
          </div>
        ))}
      </dl>
      {title.notes.length > 0 && (
        <ul className="pointer-events-none max-w-sm space-y-1 text-center text-xs text-muted-foreground">
          {title.notes.map((n) => (
            <li key={n.id}>
              <span className="font-pixel text-frost">{n.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
