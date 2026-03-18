/**
 * Remote Embedding Provider.
 * Calls the Supabase Edge Function "embed" to generate embeddings
 * using Xenova/all-MiniLM-L6-v2 (384 dimensions).
 *
 * This avoids loading @xenova/transformers + ONNX binaries inside
 * the Next.js serverless bundle (which crashes on Netlify Lambda).
 */
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/embed`;

// Batch size limit for a single Edge Function call (keep payloads manageable)
const MAX_TEXTS_PER_CALL = 50;

export class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly name = "remote-xenova:all-MiniLM-L6-v2";
  readonly model = "Xenova/all-MiniLM-L6-v2";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const allVectors: number[][] = [];
    let totalTokenCount = 0;

    // Process in batches to avoid payload size limits
    for (let i = 0; i < texts.length; i += MAX_TEXTS_PER_CALL) {
      const batch = texts.slice(i, i + MAX_TEXTS_PER_CALL);
      const result = await this.callEdgeFunction(batch);
      allVectors.push(...result.vectors);
      totalTokenCount += result.tokenCount;
    }

    return {
      vectors: allVectors,
      model: this.model,
      dimensions: this.dimensions,
      tokenCount: totalTokenCount,
      latencyMs: Date.now() - startTime,
    };
  }

  async embedSingle(text: string): Promise<number[]> {
    const result = await this.callEdgeFunction([text]);
    return result.vectors[0];
  }

  private async callEdgeFunction(texts: string[]): Promise<{
    vectors: number[][];
    tokenCount: number;
  }> {
    const response = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Edge Function embed failed (${response.status}): ${errorBody}`
      );
    }

    const data = await response.json();

    if (!data.vectors || !Array.isArray(data.vectors)) {
      throw new Error("Edge Function returned invalid response (no vectors)");
    }

    return {
      vectors: data.vectors,
      tokenCount: data.tokenCount ?? 0,
    };
  }
}
