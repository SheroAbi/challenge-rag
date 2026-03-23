/**
 * AnswerGenerator-Interface.
 * Definiert den Vertrag für LLM-basierte Antwortgenerierung.
 */

export type StreamChunk =
  | { type: "token"; text: string }
  | { type: "done"; answer: string; tokenCount: number; latencyMs: number };

export interface AnswerGenerator {
  readonly name: string;
  readonly model: string;

  generate(request: GenerateInput): Promise<GenerateOutput>;

  /** Optional streaming generation. Yields token chunks and a final done chunk. */
  generateStream?(request: GenerateInput): AsyncGenerator<StreamChunk>;
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
