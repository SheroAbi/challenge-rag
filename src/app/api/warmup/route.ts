import { NextResponse } from "next/server";
import { isGeminiConfigured } from "@/server/ai/config/gemini-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/warmup
 * Stiller Best-Effort-Warmup: weckt Embedding-Service und prüft Gemini-Config.
 * Blockiert die UI nicht; Fehler werden geloggt, aber nie dem User gezeigt.
 */
export async function POST() {
  const results: Record<string, unknown> = {};

  // 1. Embedding-Service anpingen (Root Health)
  const embeddingUrl = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3001";
  try {
    const pingRes = await fetch(embeddingUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const pingData = await pingRes.json();
    results.embeddingPing = { ok: true, model: pingData.model };
  } catch (err) {
    results.embeddingPing = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 2. Mini-Embed-Call um Modell-Laden zu triggern
  try {
    const embedRes = await fetch(`${embeddingUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "warmup" }),
      signal: AbortSignal.timeout(15000),
    });
    const embedData = await embedRes.json();
    results.embeddingModel = { ok: true, latencyMs: embedData.latencyMs };
  } catch (err) {
    results.embeddingModel = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 3. Gemini konfigurativ prüfen (kein echter API-Call)
  results.gemini = { configured: isGeminiConfigured() };

  return NextResponse.json({
    ok: true,
    services: results,
    timestamp: new Date().toISOString(),
  });
}
