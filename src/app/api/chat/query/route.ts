import { NextRequest, NextResponse } from "next/server";
import { chatQueryRequestSchema } from "@/server/contracts/schemas";
import { apiError } from "@/lib/types/api";
import { generateRequestId } from "@/lib/utils";
import { ragOrchestrator } from "@/server/services/rag-orchestrator";
import { classifyError } from "@/server/services/chat-error-classifier";

/**
 * POST /api/chat/query
 * Haupt-Startseite Chat-Endpunkt
 */
export async function POST(
  request: NextRequest
) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const parsed = chatQueryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        apiError(
          "VALIDATION_ERROR",
          "Ungültige Chat-Anfrage.",
          { issues: parsed.error.flatten().fieldErrors },
          undefined,
          requestId
        ),
        { status: 400 }
      );
    }

    const result = await ragOrchestrator.query({
      question: parsed.data.question,
      sessionId: parsed.data.sessionId,
      topK: parsed.data.topK,
      theme: parsed.data.theme,
    });

    return NextResponse.json({
      success: true,
      answer: result.answer,
      citations: result.citations,
      sessionId: result.sessionId,
      model: result.model,
      latencyMs: result.latencyMs,
      resultTable: result.resultTable,
      retrievalHits: result.retrievalHits,
      requestId,
    });
  } catch (err) {
    // Log full error server-side for debugging
    const rawMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[chat/query] requestId=${requestId}`, err);

    const { code, message, hint, status } = classifyError(err);

    return NextResponse.json(
      {
        ...apiError(code, message, undefined, hint, requestId),
        debugInfo: `${rawMessage}${stack ? '\n\n' + stack.split('\n').slice(0, 5).join('\n') : ''}`,
      },
      { status }
    );
  }
}
