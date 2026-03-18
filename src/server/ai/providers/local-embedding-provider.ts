import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";
import type { EmbeddingProvider, EmbeddingResult } from "./embedding-provider";

env.allowLocalModels = false;
env.useBrowserCache = false;

// WASM configuration for Netlify/Lambda
// This forces WASM single thread mode to avoid native binary errors
// @ts-ignore
env.backends.onnx.wasm.numThreads = 1;
// @ts-ignore
env.backends.onnx.wasm.simd = true;

// Preload promise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _preloadPromise: Promise<any> | null = null;
function preloadModel() {
  if (!_preloadPromise) {
    console.log("⏳ [Preload] Lade Embedding-Model (WASM/Xenova)...");
    _preloadPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true })
      .then((p) => { console.log("✅ [Preload] Embedding-Model bereit!"); return p; })
      .catch((e) => { console.error("❌ [Preload] Fehler:", e); _preloadPromise = null; throw e; });
  }
  return _preloadPromise;
}

// Start preloading immediately when module is imported
preloadModel();

/**
 * Lokaler Embedding Provider über Transformers.js (WASM Backend)
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local-xenova:all-MiniLM-L6-v2";
  readonly model = "Xenova/all-MiniLM-L6-v2";
  readonly dimensions = 384;

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    return preloadModel();
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const pipe = await this.getPipeline();
    const vectors: number[][] = [];
    let tokenCount = 0;

    for (const text of texts) {
      const output = await pipe(text, { pooling: "mean", normalize: true });
      vectors.push(Array.from(output.data as Float32Array));
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
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }
}
