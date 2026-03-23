import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/** 렌더링 중 uncaught error를 잡아 빈 화면 대신 에러 메시지 표시. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, color: "var(--text, #dbe7f3)" }}>
          <h2 style={{ color: "var(--warn, #f59e0b)", marginBottom: 8 }}>화면 렌더링 오류</h2>
          <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--muted, #888)", marginBottom: 12 }}>
            {this.state.error.message}
          </pre>
          <button
            className="btn btn--sm btn--accent"
            onClick={() => this.setState({ error: null })}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
