import { PixelButton } from "./PixelButton";
import { commands } from "./commands";
import { useUi } from "./store";

export function ResultScreen() {
  const result = useUi((s) => s.result);
  if (!result) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-night/75 p-3">
      <section
        aria-label="本局结算"
        className="pixel-panel flex w-full max-w-md flex-col gap-4 p-6"
      >
        <h2 className="font-pixel text-center text-3xl font-bold text-hp text-pixel-shadow">
          {result.title}
        </h2>
        <p className="text-center text-sm text-foreground">{result.cause}</p>
        <dl className="pixel-panel-flat grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm">
          {result.stats.map((s) => (
            <div key={s.label} className="contents">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="font-pixel tabular-nums text-foreground">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
        {result.notes.length > 0 && (
          <p className="text-center text-xs text-frost">
            已收集营地笔记：{result.notes.join("、")}
          </p>
        )}
        <div className="flex gap-3">
          <PixelButton
            onClick={() => commands.restart()}
            className="flex-1 py-3"
          >
            重新开始
          </PixelButton>
          <PixelButton
            variant="ghost"
            onClick={() => commands.toTitle()}
            className="flex-1 py-3"
          >
            返回标题
          </PixelButton>
        </div>
      </section>
    </div>
  );
}
