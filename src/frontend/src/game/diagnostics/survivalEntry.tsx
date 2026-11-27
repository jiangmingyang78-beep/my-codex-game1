import { createRoot } from "react-dom/client";
import { ErrorScreen } from "../ui/ErrorScreen";
import { installDiagnosticListeners } from "./listeners";
import { breadcrumb } from "./report";

let displayed = false;
installDiagnosticListeners((report) => {
  if (displayed) return;
  displayed = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = () => {
    root.render(
      <ErrorScreen report={report} onBack={() => location.assign("./")} />,
    );
  };
  void import("../../index.css").then(render, render);
});
breadcrumb("入口 生存");
