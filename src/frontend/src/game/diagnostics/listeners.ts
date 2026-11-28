import { type DiagnosticReport, breadcrumb, captureDiagnostic } from "./report";

export function installDiagnosticListeners(
  showError: (report: DiagnosticReport) => void,
): void {
  window.addEventListener("error", (event) => {
    const error =
      event.error ??
      `${event.message}\n${event.filename}:${event.lineno}:${event.colno}`;
    showError(
      captureDiagnostic("An uncaught error occurred in the game.", error),
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    showError(
      captureDiagnostic(
        "An unhandled asynchronous error occurred in the game.",
        event.reason,
      ),
    );
  });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest("button, a[data-ocid]");
      const id = control?.getAttribute("data-ocid") || control?.id;
      if (id) breadcrumb(`UI ${id}`);
    },
    true,
  );
}
