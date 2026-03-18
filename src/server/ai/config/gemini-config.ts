/**
 * Gemini API Konfiguration (Generation-only).
 * Embeddings laufen lokal über Xenova/Transformers.
 * Validiert Pflicht-Env-Variablen beim Boot und exportiert typisierte Config.
 * Fail-fast bei fehlenden Credentials.
 */

export interface GeminiConfig {
  apiKey: string;
  generationModel: string;
}

let _config: GeminiConfig | null = null;

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

/**
 * Gibt die validierte Gemini-Konfiguration zurück.
 * Wirft GeminiConfigError wenn Pflicht-Variablen fehlen.
 */
export function getGeminiConfig(): GeminiConfig {
  if (_config) return _config;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY ist nicht gesetzt. " +
      "Bitte setze die Variable in .env.local für die RAG-Generation-Pipeline."
    );
  }

  const generationModel = process.env.GEMINI_GENERATION_MODEL;
  if (!generationModel) {
    throw new GeminiConfigError(
      "GEMINI_GENERATION_MODEL ist nicht gesetzt. " +
      "Bitte setze z.B. 'gemini-2.0-flash' in .env.local."
    );
  }

  _config = {
    apiKey,
    generationModel,
  };

  return _config;
}

/**
 * Prüft ob Gemini konfiguriert ist, ohne einen Error zu werfen.
 */
export function isGeminiConfigured(): boolean {
  try {
    getGeminiConfig();
    return true;
  } catch {
    return false;
  }
}
