import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { getGeminiConfig } from "../config/gemini-config";
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini-embedding";
  readonly model: string;
  readonly dimensions: number;
  private ai: GoogleGenerativeAI;

  constructor() {
    const config = getGeminiConfig();
    this.ai = new GoogleGenerativeAI(config.apiKey);
    this.model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2-preview";
    this.dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 1536;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const model = this.ai.getGenerativeModel({ model: this.model });
    
    // Gemini currently requires embedding one text at a time or using batchEmbedContents
    // We'll use batchEmbedContents for efficiency
    const requests = texts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
    }));

    const response = await model.batchEmbedContents({
      requests: requests.map(r => ({ ...r, taskType: TaskType.RETRIEVAL_DOCUMENT, 
      // @ts-ignore
      outputDimensionality: this.dimensions })),
    });

    const vectors = response.embeddings.map((e: { values: number[] }) => e.values);
    let tokenCount = 0;
    
    // Estimate tokens until API provides them reliably in batch
    for (const text of texts) {
      tokenCount += Math.ceil(text.length / 4);
    }

    return {
      vectors,
      model: this.model,
      dimensions: this.dimensions,
      tokenCount,
      latencyMs: Date.now() - startTime,
    };
  }

  async embedSingle(text: string): Promise<number[]> {
    const model = this.ai.getGenerativeModel({ model: this.model });
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_QUERY,
      // @ts-ignore
      outputDimensionality: this.dimensions,
    });
    return result.embedding.values;
  }
}
