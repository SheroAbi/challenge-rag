/**
 * Remote Embedding Provider.
 * Calls the HuggingFace Inference API to generate embeddings using
 * the EXACT same model as the local provider: sentence-transformers/all-MiniLM-L6-v2
 *
 * → Kein Re-Indexing nötig, gleiche Vektoren wie zuvor.
 * → Kein ONNX-Runtime nötig, läuft überall (Netlify, Vercel, etc.)
 *
 * The HF feature-extraction API returns token-level embeddings,
 * so we apply mean-pooling + L2-normalization to produce sentence vectors.
 */
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

// Optional: set HF_API_TOKEN env var for higher rate limits (free tier)
const HF_API_TOKEN = process.env.HF_API_TOKEN || "";

export class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hf-inference:all-MiniLM-L6-v2";
  readonly model = "sentence-transformers/all-MiniLM-L6-v2";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const allVectors: number[][] = [];
    let totalTokenCount = 0;

    // Process one at a time to avoid batch format issues
    for (const text of texts) {
      const vec = await this.embedSingle(text);
      allVectors.push(vec);
      totalTokenCount += Math.ceil(text.length / 4);
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
    const raw = await this.callHuggingFace(text);
    return this.toSentenceEmbedding(raw);
  }

  /**
   * HF feature-extraction returns different shapes depending on the model:
   *   - Token-level: number[][] (N_tokens × 384) → needs mean-pooling
   *   - Sentence-level: number[] (384) → already pooled
   * We handle both cases.
   */
  private toSentenceEmbedding(raw: unknown): number[] {
    // Case 1: Already a flat 384-dim vector
    if (Array.isArray(raw) && typeof raw[0] === "number") {
      return this.l2Normalize(raw as number[]);
    }

    // Case 2: Token-level embeddings [N_tokens × 384] → mean-pool
    if (Array.isArray(raw) && Array.isArray(raw[0]) && typeof (raw[0] as number[])[0] === "number") {
      const tokenVecs = raw as number[][];
      const dim = tokenVecs[0].length;
      const meanVec = new Array(dim).fill(0);

      for (const tokenVec of tokenVecs) {
        for (let i = 0; i < dim; i++) {
          meanVec[i] += tokenVec[i];
        }
      }
      for (let i = 0; i < dim; i++) {
        meanVec[i] /= tokenVecs.length;
      }

      return this.l2Normalize(meanVec);
    }

    throw new Error(`Unexpected HF response shape: ${JSON.stringify(raw).substring(0, 200)}`);
  }

  private l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }

  private async callHuggingFace(text: string): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (HF_API_TOKEN) {
      headers["Authorization"] = `Bearer ${HF_API_TOKEN}`;
    }

    // Retry logic for HF cold starts (model loading) and rate limits
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(HF_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            inputs: text,
            options: { wait_for_model: true },
          }),
        });

        if (response.status === 503) {
          // Model is loading, wait and retry
          const body = await response.json().catch(() => ({}));
          const waitTime = (body as Record<string, number>).estimated_time
            ? Math.ceil((body as Record<string, number>).estimated_time * 1000)
            : 5000;
          console.warn(`[HF Embedding] Model loading, retrying in ${waitTime}ms (attempt ${attempt + 1}/3)...`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }

        if (response.status === 429) {
          const waitTime = 2000 * (attempt + 1);
          console.warn(`[HF Embedding] Rate limited, retrying in ${waitTime}ms (attempt ${attempt + 1}/3)...`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HuggingFace API error (${response.status}): ${errorBody}`);
        }

        return await response.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          console.warn(`[HF Embedding] Error on attempt ${attempt + 1}/3: ${lastError.message}. Retrying...`);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error("HuggingFace API failed after 3 retries");
  }
}
