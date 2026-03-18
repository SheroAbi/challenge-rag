import { NextRequest, NextResponse } from "next/server";
import { retrievalRequestSchema } from "@/server/contracts/schemas";
import { apiError } from "@/lib/types/api";
import { generateRequestId } from "@/lib/utils";
import { UniversalRetriever } from "@/server/rag/retriever";

/**
 * POST /api/rag/retrieve
 * Vektor-Suche: Frage → Embedding → pgvector → Top-K Chunks.
 */
export async function POST(
  request: NextRequest
) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const parsed = retrievalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        apiError("VALIDATION_ERROR", "Ungültige Anfrage", { issues: parsed.error.issues }, undefined, requestId),
        { status: 400 }
      );
    }

    const { question, topK, theme } = parsed.data;

    const retriever = new UniversalRetriever(theme);
    const result = await retriever.search({
      query: question,
      topK: topK ?? 10,
      threshold: 0.1,
    });

    return NextResponse.json({
      success: true,
      data: {
        matches: result.matches,
        model: result.model,
        latencyMs: result.latencyMs,
      },
      requestId,
    });
  } catch (err) {
    console.error(`[${requestId}] Retrieval error:`, err);
    return NextResponse.json(
      apiError(
        "RETRIEVAL_ERROR",
        err instanceof Error ? err.message : "Retrieval fehlgeschlagen",
        undefined,
        undefined,
        requestId
      ),
      { status: 500 }
    );
  }
}
