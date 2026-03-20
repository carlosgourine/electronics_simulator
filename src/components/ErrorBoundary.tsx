import React from "react";

type ErrorBoundaryProps = React.PropsWithChildren;

type ErrorBoundaryState = {
  error: unknown;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Preview runtime error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: "ui-sans-serif, system-ui",
            color: "#fff",
            background: "#1f2937",
            height: "100%",
          }}
        >
          <div style={{ background: "#991b1b", padding: 8, borderRadius: 8, marginBottom: 12 }}>Runtime error</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String((this.state.error as { message?: string } | null)?.message || this.state.error)}
          </pre>
          <div style={{ opacity: 0.8, marginTop: 8 }}>Open the browser console for full stack trace.</div>
        </div>
      );
    }

    return this.props.children;
  }
}
