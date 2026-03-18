/**
 * AnswerGenerator-Interface.
 * Definiert den Vertrag für LLM-basierte Antwortgenerierung.
 */
export interface AnswerGenerator {
  readonly name: string;
  readonly model: string;

  generate(request: GenerateInput): Promise<GenerateOutput>;
}

export interface GenerateInput {
  question: string;
  contextChunks: {
    content: string;
    documentTitle: string;
    chunkId: string;
  }[];
  tone: "professional" | "friendly" | "technical";
  systemPrompt?: string;
}

export interface GenerateOutput {
  answer: string;
  citations: {
    documentId: string;
    documentTitle: string;
    chunkId: string;
    content: string;
    relevanceScore: number;
  }[];
  model: string;
  tokenCount: number;
  latencyMs: number;
}
