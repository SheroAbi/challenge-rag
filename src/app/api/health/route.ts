import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/types/api";
import type { HealthResponse } from "@/server/contracts/schemas";
import { isGeminiConfigured } from "@/server/ai/config/gemini-config";

/**
 * GET /api/health
 * Basis-Liveness-Check. Liefert immer 200.
 */
export async function GET() {
  const response: HealthResponse = {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    features: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      embedding: true, // Lokale Xenova-Embeddings immer verfügbar
      generation: isGeminiConfigured(),
    },
  };

  return NextResponse.json(apiSuccess(response), { status: 200 });
}
