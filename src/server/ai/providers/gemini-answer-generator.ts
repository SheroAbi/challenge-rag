import type { AnswerGenerator, GenerateInput, GenerateOutput, StreamChunk } from "./answer-generator";
import { getGeminiConfig, GeminiConfigError } from "../config/gemini-config";

/**
 * Gemini Answer Generator.
 * Nutzt Gemini für die Antwortgenerierung im RAG-Flow.
 * Unterstützt sowohl Block- als auch Stream-Generierung.
 */
export class GeminiAnswerGenerator implements AnswerGenerator {
  readonly name = "gemini";

  get model(): string {
    return getGeminiConfig().generationModel;
  }

  private buildRequestBody(request: GenerateInput) {
    const contextBlock = request.contextChunks
      .map((chunk, i) => `[Quelle ${i + 1}: ${chunk.documentTitle}]\n${chunk.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = request.systemPrompt ||
      "Du bist ein hilfreicher Assistent. Beantworte die Frage basierend auf dem bereitgestellten Kontext.";

    return {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Kontext:\n${contextBlock}\n\n---\n\nFrage: ${request.question}\n\nBitte beantworte die Frage ausschließlich anhand des obigen Kontexts. Wenn du die Antwort nicht im Kontext findest, sage das ehrlich. Gib am Ende deiner Antwort die verwendeten Quellen an.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: request.tone === "technical" ? 0.2 : request.tone === "friendly" ? 0.7 : 0.4,
        maxOutputTokens: 2048,
      },
    };
  }

  async generate(request: GenerateInput): Promise<GenerateOutput> {
    const config = getGeminiConfig();
    const startTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.generationModel}:generateContent?key=${config.apiKey}`;
    const body = this.buildRequestBody(request);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 404) {
        throw new GeminiConfigError(
          `Generierungsmodell '${config.generationModel}' nicht verfügbar. API: ${errorBody}`
        );
      }
      throw new Error(`Gemini Generation API Fehler (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Keine Antwort generiert.";
    const tokenCount = data.usageMetadata?.totalTokenCount || 0;
    const latencyMs = Date.now() - startTime;

    const citations = request.contextChunks.map((chunk, i) => ({
      documentId: chunk.chunkId.split("_")[0] || chunk.chunkId,
      documentTitle: chunk.documentTitle,
      chunkId: chunk.chunkId,
      content: chunk.content.substring(0, 200),
      relevanceScore: 1 - i * 0.1,
    }));

    return {
      answer,
      citations,
      model: config.generationModel,
      tokenCount,
      latencyMs,
    };
  }

  /**
   * Streaming-Generierung über Gemini REST SSE-Endpunkt.
   * Nutzt `streamGenerateContent?alt=sse` für echtes Token-Streaming.
   */
  async *generateStream(request: GenerateInput): AsyncGenerator<StreamChunk> {
    const config = getGeminiConfig();
    const startTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.generationModel}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    const body = this.buildRequestBody(request);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 404) {
        throw new GeminiConfigError(
          `Generierungsmodell '${config.generationModel}' nicht verfügbar. API: ${errorBody}`
        );
      }
      throw new Error(`Gemini Generation API Fehler (${response.status}): ${errorBody}`);
    }

    if (!response.body) {
      throw new Error("Gemini stream response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = "";
    let tokenCount = 0;
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

              if (text) {
                fullAnswer += text;
                yield { type: "token", text };
              }

              // Capture token count from the last chunk's usageMetadata
              if (data.usageMetadata?.totalTokenCount) {
                tokenCount = data.usageMetadata.totalTokenCount;
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      type: "done",
      answer: fullAnswer || "Keine Antwort generiert.",
      tokenCount,
      latencyMs: Date.now() - startTime,
    };
  }
}
