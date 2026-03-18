import express from "express";
import { pipeline, env } from "@xenova/transformers";

// Configure for server environment
env.allowLocalModels = false;
env.useBrowserCache = false;
env.allowRemoteModels = true;
env.cacheDir = "/tmp/models";

// Singleton pipeline
let _pipeline = null;

async function getPipeline() {
  if (!_pipeline) {
    console.log("⏳ Loading model Xenova/all-MiniLM-L6-v2...");
    _pipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
    console.log("✅ Model loaded!");
  }
  return _pipeline;
}

// Preload model on boot
getPipeline().catch((e) => console.error("❌ Model load failed:", e));

const app = express();
app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", model: "Xenova/all-MiniLM-L6-v2", dimensions: 384 });
});

// Embedding endpoint
app.post("/embed", async (req, res) => {
  try {
    const { text, texts } = req.body;

    let inputTexts;
    if (typeof text === "string") {
      inputTexts = [text];
    } else if (Array.isArray(texts)) {
      inputTexts = texts;
    } else {
      return res.status(400).json({ error: "Send { text: string } or { texts: string[] }" });
    }

    const startTime = Date.now();
    const pipe = await getPipeline();
    const vectors = [];
    let tokenCount = 0;

    for (const t of inputTexts) {
      const output = await pipe(t, { pooling: "mean", normalize: true });
      vectors.push(Array.from(output.data));
      tokenCount += Math.ceil(t.length / 4);
    }

    res.json({
      vectors,
      model: "Xenova/all-MiniLM-L6-v2",
      dimensions: 384,
      tokenCount,
      latencyMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error("Embedding error:", err);
    res.status(500).json({ error: err.message || "Embedding failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Embedding service running on port ${PORT}`);
});
