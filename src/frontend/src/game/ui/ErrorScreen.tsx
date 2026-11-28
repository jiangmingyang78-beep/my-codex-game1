import { useState } from "react";
import {
  type DiagnosticReport,
  diagnosticMarkdown,
  issueUrl,
} from "../diagnostics/report";
import { PixelButton } from "./PixelButton";

/** Shown when a run or the game scene fails to start; always offers a way back. */
export function ErrorScreen({
  report,
  onBack,
}: {
  report: DiagnosticReport;
  onBack: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const markdown = diagnosticMarkdown(report);
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }
  return (
    <div
      data-ocid="game.error_state"
      className="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-night/85 p-3"
    >
      <section
        aria-label="Game error"
        className="pixel-panel flex max-h-full w-full max-w-md flex-col gap-4 overflow-auto p-6"
      >
        <h2 className="font-pixel text-center text-2xl font-bold text-hp text-pixel-shadow">
          The game cannot continue
        </h2>
        <p role="alert" className="text-center text-sm text-foreground">
          {report.message}
        </p>
        <a
          className="pixel-btn px-4 py-2 text-center text-sm"
          href={issueUrl(report)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open a GitHub issue
        </a>
        <PixelButton onClick={() => void copyReport()} variant="ghost">
          Copy AI diagnostics
        </PixelButton>
        {copyState === "copied" && <output>Full diagnostics copied.</output>}
        {copyState === "manual" && (
          <textarea
            aria-label="Full diagnostic report for manual copying"
            className="min-h-28 w-full bg-night p-2 text-sm text-foreground"
            value={markdown}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
        <PixelButton
          data-ocid="game.back_to_title_button"
          onClick={onBack}
          className="py-3"
        >
          Return to title
        </PixelButton>
      </section>
    </div>
  );
}
