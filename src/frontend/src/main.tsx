import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./game/diagnostics/ErrorBoundary";
import { installDiagnosticListeners } from "./game/diagnostics/listeners";
import {
  type DiagnosticReport,
  breadcrumb,
  captureDiagnostic,
} from "./game/diagnostics/report";
import { ErrorScreen } from "./game/ui/ErrorScreen";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
let failed = false;
function showError(report: DiagnosticReport) {
  if (failed) return;
  failed = true;
  root.render(<ErrorScreen report={report} onBack={() => location.reload()} />);
}

installDiagnosticListeners(showError);
breadcrumb("入口 冒险与永夜");
try {
  const { default: App } = await import("./App");
  const { loadGameData } = await import("./core/gameData");
  const { loadSurvivalTuning } = await import("./systems/survivalTuning");
  loadGameData().balance.survival = await loadSurvivalTuning();
  if (!failed)
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
} catch (error) {
  console.error(error);
  showError(captureDiagnostic("游戏启动失败。", error));
}
