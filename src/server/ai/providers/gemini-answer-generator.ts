import type { AnswerGenerator, GenerateInput, GenerateOutput } from "./answer-generator";
import { getGeminiConfig, GeminiConfigError } from "../config/gemini-config";

/**
 * Gemini Answer Generator.
 * Nutzt Gemini für die Antwortgenerierung im RAG-Flow.
 */
export class GeminiAnswerGenerator implements AnswerGenerator {
  readonly name = "gemini";

  get model(): string {
    return getGeminiConfig().generationModel;
  }

  async generate(request: GenerateInput): Promise<GenerateOutput> {
    const config = getGeminiConfig();
    const startTime = Date.now();

    // Kontext aus Chunks aufbauen
    const contextBlock = request.contextChunks
      .map((chunk, i) => `[Quelle ${i + 1}: ${chunk.documentTitle}]\n${chunk.content}`)
      .join("\n\n---\n\n");

    // System-Prompt (food-spezifisch oder generisch)
    const systemPrompt = request.systemPrompt || 
      "Du bist ein hilfreicher Assistent. Beantworte die Frage basierend auf dem bereitgestellten Kontext.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.generationModel}:generateContent?key=${config.apiKey}`;

    const body = {
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

    // Citations aus den bereitgestellten Chunks ableiten
    const citations = request.contextChunks.map((chunk, i) => ({
      documentId: chunk.chunkId.split("_")[0] || chunk.chunkId,
      documentTitle: chunk.documentTitle,
      chunkId: chunk.chunkId,
      content: chunk.content.substring(0, 200),
      relevanceScore: 1 - i * 0.1, // Absteigend nach Rang
    }));

    return {
      answer,
      citations,
      model: config.generationModel,
      tokenCount,
      latencyMs,
    };
  }
}
