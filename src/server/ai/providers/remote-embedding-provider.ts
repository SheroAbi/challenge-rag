/**
 * Remote Embedding Provider.
 * Calls a self-hosted embedding service (Render.com) running
 * the EXACT same model: Xenova/all-MiniLM-L6-v2 (384 dimensions).
 *
 * → Kein Re-Indexing nötig, gleiche Vektoren wie zuvor.
 * → Kein ONNX-Runtime im Next.js-Bundle nötig.
 * → Keine Rate-Limits, eigene Infrastruktur.
 *
 * Set EMBEDDING_SERVICE_URL in your environment variables.
 * Example: EMBEDDING_SERVICE_URL=https://your-service.onrender.com
 */
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:3001";

export class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly name = "remote-xenova:all-MiniLM-L6-v2";
  readonly model = "Xenova/all-MiniLM-L6-v2";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();

    const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`Embedding service error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data.vectors || !Array.isArray(data.vectors)) {
      throw new Error("Embedding service returned invalid response (no vectors)");
    }

    return {
      vectors: data.vectors,
      model: this.model,
      dimensions: this.dimensions,
      tokenCount: data.tokenCount ?? 0,
      latencyMs: Date.now() - startTime,
    };
  }

  async embedSingle(text: string): Promise<number[]> {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`Embedding service error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    if (!data.vectors || !Array.isArray(data.vectors) || data.vectors.length === 0) {
      throw new Error("Embedding service returned no vectors");
    }

    return data.vectors[0];
  }
}
