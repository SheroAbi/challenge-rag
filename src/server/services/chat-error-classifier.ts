import { GeminiConfigError } from "@/server/ai/config/gemini-config";

/**
 * Klassifiziert rohe Fehler → benutzerfreundliche Meldungen.
 * Shared zwischen JSON- und Stream-Route.
 */
export interface ClassifiedError {
  code: string;
  message: string;
  hint: string;
  status: number;
}

export function classifyError(err: unknown): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err);

  // 1) Rate-Limit / Quota exceeded (429)
  if (raw.includes("429") || /quota|rate.?limit|resource.?exhausted/i.test(raw)) {
    return {
      code: "RATE_LIMIT",
      message: "Die KI ist momentan überlastet – zu viele Anfragen.",
      hint: "Bitte warte ein paar Sekunden und versuche es dann erneut.",
      status: 429,
    };
  }

  // 2) Model not found / unavailable (404)
  if (err instanceof GeminiConfigError || raw.includes("404") || /model.*not.*found|nicht.*verfügbar/i.test(raw)) {
    return {
      code: "MODEL_UNAVAILABLE",
      message: "Das KI-Modell ist gerade nicht erreichbar.",
      hint: "Versuche es in einer Minute erneut oder kontaktiere den Administrator.",
      status: 503,
    };
  }

  // 3) Missing API Key / Config error
  if (/api.?key|GEMINI_API_KEY|konfiguration/i.test(raw)) {
    return {
      code: "CONFIG_ERROR",
      message: "Die KI-Verbindung ist nicht korrekt konfiguriert.",
      hint: "Bitte den Administrator kontaktieren – der API-Key fehlt oder ist ungültig.",
      status: 500,
    };
  }

  // 4) Network / fetch errors
  if (/fetch|ECONNREFUSED|ENOTFOUND|network|timeout/i.test(raw)) {
    return {
      code: "NETWORK_ERROR",
      message: "Verbindung zum KI-Dienst fehlgeschlagen.",
      hint: "Prüfe deine Internetverbindung und versuche es erneut.",
      status: 502,
    };
  }

  // 5) Database errors
  if (/supabase|database|postgres|rpc/i.test(raw)) {
    return {
      code: "DATABASE_ERROR",
      message: "Die Datenbank-Abfrage ist fehlgeschlagen.",
      hint: "Versuche es in wenigen Sekunden erneut. Falls das Problem bestehen bleibt, kontaktiere den Admin.",
      status: 500,
    };
  }

  // 6) Fallback
  return {
    code: "INTERNAL_ERROR",
    message: "Ein unerwarteter Fehler ist aufgetreten.",
    hint: "Bitte versuche es später erneut.",
    status: 500,
  };
}
