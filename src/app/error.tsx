"use client";

import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

/**
 * Next.js App Router Error Page.
 * Letzte Sicherheitsstufe für Root-Level-Fehler.
 */
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          Ein Fehler ist aufgetreten
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Etwas ist beim Laden dieser Seite schiefgelaufen. Versuche es erneut.
        </p>
      </div>

      {process.env.NODE_ENV === "development" && (
        <pre className="mx-auto max-w-lg overflow-auto rounded-xl border border-border/50 bg-muted/60 p-4 text-xs text-muted-foreground font-mono max-h-40">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
        </pre>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold px-5 py-2.5 text-sm transition-all duration-200 border border-primary/20"
        >
          <RotateCcw className="h-4 w-4" />
          Erneut versuchen
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium px-5 py-2.5 text-sm transition-all duration-200 border border-border/50"
        >
          <RefreshCw className="h-4 w-4" />
          Seite neu laden
        </button>
      </div>
    </div>
  );
}
