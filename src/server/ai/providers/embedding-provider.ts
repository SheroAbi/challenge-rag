/**
 * EmbeddingProvider-Interface.
 * Definiert den Vertrag für jeden Embedding-Anbieter.
 */
export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;

  embed(texts: string[]): Promise<EmbeddingResult>;
  embedSingle(text: string): Promise<number[]>;
}

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
  tokenCount: number;
  latencyMs: number;
}
