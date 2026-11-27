import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorScreen } from "../ui/ErrorScreen";
import { type DiagnosticReport, captureDiagnostic } from "./report";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { report: DiagnosticReport | null }
> {
  state: { report: DiagnosticReport | null } = { report: null };

  static getDerivedStateFromError(error: unknown) {
    return { report: captureDiagnostic("游戏界面渲染失败。", error) };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    const { componentStack } = info;
    if (componentStack)
      this.setState(({ report }) => ({
        report: report
          ? { ...report, stack: [report.stack, componentStack].join("\n") }
          : null,
      }));
  }

  render() {
    const { report } = this.state;
    return report ? (
      <ErrorScreen report={report} onBack={() => location.reload()} />
    ) : (
      this.props.children
    );
  }
}
