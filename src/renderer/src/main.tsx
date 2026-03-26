import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

type RootErrorBoundaryProps = {
  children: React.ReactNode;
};

type RootErrorBoundaryState = {
  error: Error | null;
};

class RootErrorBoundary extends React.Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Root render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "32px",
            background: "#f5f1ea",
            color: "#111",
            fontFamily: "Segoe UI, sans-serif"
          }}
        >
          <h1 style={{ margin: "0 0 12px" }}>Renderer crashed</h1>
          <p style={{ margin: "0 0 8px" }}>
            {this.state.error.message || "Unknown renderer error"}
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              padding: "16px",
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: "12px"
            }}
          >
            {this.state.error.stack || "No stack available"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root") as HTMLElement;

function showFatal(message: string) {
  rootElement.innerHTML = `
    <div style="min-height:100vh;padding:32px;background:#f5f1ea;color:#111;font-family:Segoe UI,sans-serif;">
      <h1 style="margin:0 0 12px;">Startup failed</h1>
      <pre style="white-space:pre-wrap;word-break:break-word;padding:16px;background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:12px;">${message.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char))}</pre>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  console.error("Unhandled window error", event.error || event.message);
  showFatal(String(event.error?.stack || event.error?.message || event.message || "Unknown error"));
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection", event.reason);
  const reason =
    event.reason instanceof Error
      ? event.reason.stack || event.reason.message
      : typeof event.reason === "string"
        ? event.reason
        : JSON.stringify(event.reason, null, 2);
  showFatal(reason || "Unhandled promise rejection");
});

ReactDOM.createRoot(rootElement).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
