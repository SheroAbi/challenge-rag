/**
 * Remote Embedding Provider.
 * Calls the HuggingFace Inference API to generate embeddings using
 * the EXACT same model as the local provider: sentence-transformers/all-MiniLM-L6-v2
 *
 * → Kein Re-Indexing nötig, gleiche Vektoren wie zuvor.
 * → Kein ONNX-Runtime nötig, läuft überall (Netlify, Vercel, etc.)
 */
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

// Optional: set HF_API_TOKEN env var for higher rate limits (free tier)
const HF_API_TOKEN = process.env.HF_API_TOKEN || "";

// Batch size limit per HF API call
const MAX_TEXTS_PER_CALL = 32;

export class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hf-inference:all-MiniLM-L6-v2";
  readonly model = "sentence-transformers/all-MiniLM-L6-v2";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const allVectors: number[][] = [];
    let totalTokenCount = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += MAX_TEXTS_PER_CALL) {
      const batch = texts.slice(i, i + MAX_TEXTS_PER_CALL);
      const vectors = await this.callHuggingFace(batch);
      allVectors.push(...vectors);
      totalTokenCount += batch.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
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
    const vectors = await this.callHuggingFace([text]);
    return vectors[0];
  }

  private async callHuggingFace(texts: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (HF_API_TOKEN) {
      headers["Authorization"] = `Bearer ${HF_API_TOKEN}`;
    }

    // Retry logic for HF cold starts (model loading)
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(HF_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          inputs: texts,
          options: { wait_for_model: true },
        }),
      });

      if (response.status === 503) {
        // Model is loading, wait and retry
        const body = await response.json();
        const waitTime = body.estimated_time ? Math.ceil(body.estimated_time * 1000) : 5000;
        console.log(`[HF Embedding] Model loading, retrying in ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        lastError = new Error(`HuggingFace API error (${response.status}): ${errorBody}`);
        // Retry on 429 (rate limit) with backoff
        if (response.status === 429) {
          const waitTime = 2000 * (attempt + 1);
          console.log(`[HF Embedding] Rate limited, retrying in ${waitTime}ms...`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }
        throw lastError;
      }

      const data = await response.json();

      // HF returns array of arrays for batch input
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("HuggingFace returned invalid response (expected array of vectors)");
      }

      // Normalize vectors (L2 norm) for cosine similarity
      return (data as number[][]).map((vec) => {
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return norm > 0 ? vec.map((v) => v / norm) : vec;
      });
    }

    throw lastError || new Error("HuggingFace API failed after 3 retries");
  }
}
