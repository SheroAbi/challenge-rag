import type { ThemeKey } from "@/server/contracts/schemas";
import { getThemeConfig } from "@/server/rag/theme-router";
import { UniversalRetriever } from "@/server/rag/retriever";
import type { RetrievalHit } from "@/server/rag/retriever";
import { GeminiAnswerGenerator } from "@/server/ai/providers/gemini-answer-generator";
import { isGeminiConfigured } from "@/server/ai/config/gemini-config";
import { NotImplementedServiceError } from "@/lib/errors";

/**
 * RAG-Orchestrator.
 * Koordiniert den gesamten Retrieve-then-Generate-Flow:
 * Frage → Embedding → Vektorsuche → Kontextaufbau → LLM-Generierung → Antwort
 */

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface RagOrchestratorInput {
  question: string;
  sessionId?: string;
  topK: number;
  theme: ThemeKey;
}

export interface RagOrchestratorOutput {
  answer: string;
  citations: Citation[];
  sessionId: string;
  model: string | null;
  retrievalHits: RetrievalHit[];
  latencyMs: number;
  resultTable?: {
    title: string;
    columns: string[];
    rows: string[][];
  };
}

export interface IRagOrchestrator {
  query(input: RagOrchestratorInput): Promise<RagOrchestratorOutput>;
}

const answerGenerator = new GeminiAnswerGenerator();

/**
 * Aktive Implementierung des RAG-Orchestrators.
 */
export class RagOrchestrator implements IRagOrchestrator {
  async query(input: RagOrchestratorInput): Promise<RagOrchestratorOutput> {
    const startTime = Date.now();
    const themeConfig = getThemeConfig(input.theme);

    if (!isGeminiConfigured()) {
      throw new NotImplementedServiceError(
        "RagOrchestrator",
        `query (${themeConfig.label}) – GEMINI_API_KEY nicht konfiguriert`
      );
    }

    // 1. Universal Retrieval (hybrid für food, semantic für alles andere)
    const retriever = new UniversalRetriever(input.theme);

    const retrievalResult = await retriever.search({
      query: input.question,
      topK: input.topK,
      threshold: 0.1,
    });

    // 2. Generation
    const contextChunks = retrievalResult.matches.map((hit) => ({
      content: hit.content,
      documentTitle: hit.documentTitle,
      chunkId: hit.chunkId,
    }));

    const generationResult = await answerGenerator.generate({
      question: input.question,
      contextChunks,
      tone: "professional",
      systemPrompt: themeConfig.promptHint,
    });

    // 3. Citations aufbereiten
    const isExercise = input.theme === "exercises";
    const citations: Citation[] = retrievalResult.matches.map((hit) => ({
      documentId: hit.documentId,
      documentTitle: hit.documentTitle,
      chunkId: hit.chunkId,
      content: isExercise ? hit.content : hit.content.substring(0, 300),
      relevanceScore: hit.score,
      metadata: hit.metadata,
    }));

    // 4. Result Table aufbauen
    const resultTable = this.buildResultTable(input.theme, retrievalResult.matches);

    return {
      answer: generationResult.answer,
      citations,
      sessionId: input.sessionId || crypto.randomUUID(),
      model: generationResult.model,
      retrievalHits: retrievalResult.matches,
      latencyMs: Date.now() - startTime,
      resultTable,
    };
  }

  private buildResultTable(theme: ThemeKey, hits: RetrievalHit[]) {
    if (hits.length === 0) return undefined;

    if (theme === "food") {
      return {
        title: "Nährwerte (Retrieval-Daten)",
        columns: ["Lebensmittel", "Marke", "Kalorien", "Protein", "Carbs", "Fett", "Score"],
        rows: hits.map(hit => {
          const m = hit.metadata || {};
          if (m.calories !== undefined) {
             return [hit.documentTitle, String(m.brand || "-"), String(m.calories) + " kcal", String(m.protein) + "g", String(m.carbs) + "g", String(m.fat) + "g", (hit.score * 100).toFixed(1) + "%"];
          }
          const parts = hit.content.split("|").map(s => s.trim());
          if (parts.length >= 6) {
             return [parts[0], parts[1] || "-", parts[2], parts[3], parts[4], parts[5], (hit.score * 100).toFixed(1) + "%"];
          }
          return [hit.documentTitle, "-", "-", "-", "-", "-", (hit.score * 100).toFixed(1) + "%"];
        })
      };
    }

    if (theme === "exercises") {
      return {
        title: "Übungen",
        columns: ["Übung", "Kategorie", "Muskelgruppe", "Equipment", "Level", "Score"],
        rows: hits.map(hit => {
          const m = hit.metadata || {};
          const muscles = Array.isArray(m.primaryMuscles) ? (m.primaryMuscles as string[]).join(", ") : String(m.primaryMuscles || "-");
          return [
            hit.documentTitle,
            String(m.category || "-"),
            muscles,
            String(m.equipment || "-"),
            String(m.level || "-"),
            (hit.score * 100).toFixed(1) + "%"
          ];
        })
      };
    }

    return {
      title: "Relevante Dokumente",
      columns: ["Dokument", "Kategorie", "Score"],
      rows: hits.map(hit => [
        hit.documentTitle,
        String(hit.metadata?.category || hit.metadata?.tags || "-"),
        (hit.score * 100).toFixed(1) + "%"
      ])
    };
  }
}

export const ragOrchestrator: IRagOrchestrator = new RagOrchestrator();
