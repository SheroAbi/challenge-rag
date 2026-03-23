"use client";

import React from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Wiederverwendbare React Error Boundary.
 * Fängt Render-/Lifecycle-Fehler ab und zeigt einen Fallback.
 * Unterstützt Boundary-Reset und vollständigen Seiten-Reload.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-3xl border border-border/60 bg-card p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/10">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">
              {this.props.fallbackTitle || "Etwas ist schiefgelaufen"}
            </h3>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut oder lade die Seite neu.
            </p>
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mx-auto max-w-lg overflow-auto rounded-xl border border-border/50 bg-muted/60 p-4 text-left text-xs text-muted-foreground font-mono max-h-40">
              {this.state.error.message}
              {this.state.error.stack && "\n\n" + this.state.error.stack.split("\n").slice(0, 4).join("\n")}
            </pre>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-5 py-2.5 text-sm transition-all duration-200 border border-primary/20"
            >
              <RotateCcw className="h-4 w-4" />
              Erneut versuchen
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium px-5 py-2.5 text-sm transition-all duration-200 border border-border/50"
            >
              <RefreshCw className="h-4 w-4" />
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
