import { pipeline, env } from "@xenova/transformers";
import type { EmbeddingProvider as BaseEmbeddingProvider, EmbeddingResult } from "./embedding-provider";
env.allowLocalModels = false;
env.useBrowserCache = false;

// Force WASM backend on serverless (no native libonnxruntime.so available)
if (typeof process !== "undefined" && process.env.NETLIFY === "true") {
  // @ts-expect-error — onnxruntime backend config
  env.backends = { onnx: { wasm: {} } };
}

// ── Eagerly preload the model at module init ──
// This runs once when Next.js first imports this module,
// so the model is downloaded and ready before the first upload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _preloadPromise: Promise<any> | null = null;
function preloadModel() {
  if (!_preloadPromise) {
    console.log("⏳ [Preload] Lade Embedding-Model im Hintergrund...");
    _preloadPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { quantized: true })
      .then((p) => { console.log("✅ [Preload] Embedding-Model bereit!"); return p; })
      .catch((e) => { console.error("❌ [Preload] Fehler:", e); _preloadPromise = null; throw e; });
  }
  return _preloadPromise;
}
// Start preloading immediately when module is imported
preloadModel();

/**
 * Lokaler Embedding Provider über Transformers.js
 * Lädt beim ersten Start automatisch Xenova/all-MiniLM-L6-v2 herunter (ca. 22MB).
 * Führt Embeddings komplett lokal auf der CPU aus. Keine API, keine Limits!
 */
export class LocalEmbeddingProvider implements BaseEmbeddingProvider {
  readonly name = "local";
  readonly model = "Xenova/all-MiniLM-L6-v2-local";
  readonly dimensions = 384;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static extractor: any = null;
  
  // Feature extraction pipeline für Embeddings — nutzt die module-level preload Instanz
  private async getExtractor() {
    if (LocalEmbeddingProvider.extractor) return LocalEmbeddingProvider.extractor;
    LocalEmbeddingProvider.extractor = await preloadModel();
    return LocalEmbeddingProvider.extractor;
  }

  async embedSingle(text: string): Promise<number[]> {
    const res = await this.embed([text]);
    return res.vectors[0];
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const start = Date.now();
    if (!texts || texts.length === 0) {
      return { 
        vectors: [], 
        dimensions: this.dimensions, 
        model: this.model,
        tokenCount: 0,
        latencyMs: Date.now() - start
      };
    }

    const extractor = await this.getExtractor();

    // Transformers.js verarbeitet Arrays von Strings
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    
    // Die Vektoren als number[][] extahieren
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
        vectors.push(Array.from(output[i].data));
    }

    const tokenCount = Math.ceil(texts.join(" ").length / 4);

    return {
      vectors,
      dimensions: this.dimensions,
      model: this.model,
      tokenCount,
      latencyMs: Date.now() - start
    };
  }
}
