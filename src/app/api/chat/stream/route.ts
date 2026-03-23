import { NextRequest } from "next/server";
import { chatQueryRequestSchema } from "@/server/contracts/schemas";
import { generateRequestId } from "@/lib/utils";
import { ragOrchestrator } from "@/server/services/rag-orchestrator";
import { classifyError } from "@/server/services/chat-error-classifier";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/stream
 * SSE-Streaming Chat-Endpunkt.
 * Gleicher Request-Body wie /api/chat/query, liefert aber text/event-stream.
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream already closed
        }
      };

      try {
        // 1. Validate request
        sendEvent("status", { phase: "validating" });

        const body = await request.json();
        const parsed = chatQueryRequestSchema.safeParse(body);

        if (!parsed.success) {
          sendEvent("error", {
            code: "VALIDATION_ERROR",
            message: "Ungültige Chat-Anfrage.",
            hint: "Bitte prüfe die Eingabe und versuche es erneut.",
            requestId,
          });
          controller.close();
          return;
        }

        // 2. Retrieve
        sendEvent("status", { phase: "retrieving" });

        const startTime = Date.now();
        const { meta, tokenStream } = await ragOrchestrator.queryStream({
          question: parsed.data.question,
          sessionId: parsed.data.sessionId,
          topK: parsed.data.topK,
          theme: parsed.data.theme,
        });

        // 3. Send meta (citations, model, sessionId available immediately)
        sendEvent("meta", {
          sessionId: meta.sessionId,
          model: meta.model,
          citations: meta.citations,
          resultTable: meta.resultTable,
          requestId,
        });

        // 4. Stream tokens
        sendEvent("status", { phase: "generating" });

        let fullAnswer = "";
        let tokenCount = 0;

        for await (const chunk of tokenStream) {
          if (chunk.type === "token") {
            fullAnswer += chunk.text;
            sendEvent("token", { text: chunk.text });
          } else if (chunk.type === "done") {
            fullAnswer = chunk.answer;
            tokenCount = chunk.tokenCount;
          }
        }

        // 5. Send completion
        const latencyMs = Date.now() - startTime;
        sendEvent("done", {
          answer: fullAnswer,
          latencyMs,
          tokenCount,
          retrievalHits: meta.retrievalHits.length,
          requestId,
        });
      } catch (err) {
        console.error(`[chat/stream] requestId=${requestId}`, err);

        const { code, message, hint } = classifyError(err);
        sendEvent("error", { code, message, hint, requestId });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}
