import { type ClassValue, clsx } from "clsx";

/**
 * Utility: Bedingte CSS-Klassen zusammenführen.
 * Nutzt clsx für flexible Komposition.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Generiert eine einfache Request-ID für Tracing.
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Verzögerung (für Demos/Stubs).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formatiert ein Datum für die deutsche Darstellung.
 */
export function formatDateDE(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
