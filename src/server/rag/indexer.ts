/**
 * Universal RAG Indexer.
 * Ein einziger Indexer für ALLE Themes.
 * - indexFoods(): Food-Pipeline (food_items upsert + chunk-building + rag_food_chunks)
 * - indexRecords(): Universal-Pipeline (beliebige rag_*_chunks-Tabelle)
 */

import { getSupabaseClient } from "@/integrations/supabase/client";
import type { EmbeddingProvider } from "@/server/ai/providers/embedding-provider";
import type { NormalizedFood } from "@/server/food/normalizer";
import * as crypto from "crypto";

// Lazy-load to avoid crashing Netlify serverless (ONNX native binary not available)
let _embeddingProvider: EmbeddingProvider | null = null;
async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (_embeddingProvider) return _embeddingProvider;
  const { GeminiEmbeddingProvider } = await import("@/server/ai/providers/gemini-embedding-provider");
  _embeddingProvider = new GeminiEmbeddingProvider();
  return _embeddingProvider;
}
export { _embeddingProvider as embeddingProvider };

const EMBEDDING_BATCH_SIZE = 100;
const DB_BATCH_SIZE = 100;

// ────────────────── Types ──────────────────

export interface IndexingResult {
  total: number;
  indexed: number;
  errors: number;
  errorDetails: { title: string; error: string }[];
}

export interface DatasetRecord {
  sourceId: string;
  sourceTitle: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ContentBuilderConfig {
  contentFields?: string[];
  titleField?: string;
  idField?: string;
  metadataFields?: string[];
}

// ────────────────── Food Chunk Builder (inline) ──────────────────

function buildFoodChunk(food: NormalizedFood): { content: string; metadata: Record<string, unknown>; sourceTitle: string } {
  const lines: string[] = [];

  lines.push(`Lebensmittel: ${food.displayName}`);
  if (food.brand) lines.push(`Marke: ${food.brand}`);
  if (food.servingText) lines.push(`Portion: ${food.servingText}`);

  lines.push("");
  lines.push("Nährwerte:");
  if (food.caloriesKcal !== null) lines.push(`  Kalorien: ${food.caloriesKcal} kcal`);
  if (food.proteinG !== null) lines.push(`  Protein: ${food.proteinG} g`);
  if (food.carbsG !== null) lines.push(`  Kohlenhydrate: ${food.carbsG} g`);
  if (food.fatG !== null) lines.push(`  Fett: ${food.fatG} g`);
  if (food.fiberG !== null) lines.push(`  Ballaststoffe: ${food.fiberG} g`);
  if (food.sugarG !== null) lines.push(`  Zucker: ${food.sugarG} g`);
  if (food.sodiumMg !== null) lines.push(`  Natrium: ${food.sodiumMg} mg`);

  if (food.aliases.length > 0) {
    lines.push("");
    lines.push(`Bekannte Namen: ${food.aliases.join(", ")}`);
  }

  if (food.occurrenceCount > 1) {
    lines.push(`Häufigkeit in der Datenbank: ${food.occurrenceCount}x gefunden`);
  }

  const content = lines.join("\n");

  const metadata: Record<string, unknown> = {
    type: "food_item",
    canonical_key: food.canonicalKey,
    brand: food.brand,
    serving: food.servingText,
    calories_kcal: food.caloriesKcal,
    protein_g: food.proteinG,
    carbs_g: food.carbsG,
    fat_g: food.fatG,
    fiber_g: food.fiberG,
    sugar_g: food.sugarG,
    sodium_mg: food.sodiumMg,
    aliases: food.aliases,
    occurrence_count: food.occurrenceCount,
  };

  return { content, metadata, sourceTitle: food.displayName };
}

// ────────────────── Dataset Record Builder (inline) ──────────────────

export function buildDatasetRecord(
  record: Record<string, unknown>,
  index: number,
  config?: ContentBuilderConfig
): DatasetRecord {
  const keys = Object.keys(record);

  // Title bestimmen
  let sourceTitle = `Record ${index + 1}`;
  if (config?.titleField && record[config.titleField] != null) {
    sourceTitle = String(record[config.titleField]);
  } else {
    for (const key of ["title", "name", "question", "label", "heading", "übung", "exercise"]) {
      if (record[key] != null && typeof record[key] === "string") {
        sourceTitle = String(record[key]);
        break;
      }
    }
    if (sourceTitle === `Record ${index + 1}`) {
      for (const key of keys) {
        if (typeof record[key] === "string" && String(record[key]).length > 3) {
          sourceTitle = String(record[key]).substring(0, 200);
          break;
        }
      }
    }
  }

  // Source-ID bestimmen
  let sourceId = `record_${index}`;
  if (config?.idField && record[config.idField] != null) {
    sourceId = String(record[config.idField]);
  } else if (record["id"] != null) {
    sourceId = String(record["id"]);
  }

  // Content-String aufbauen
  let content: string;
  if (config?.contentFields && config.contentFields.length > 0) {
    content = config.contentFields
      .filter((f) => record[f] != null)
      .map((f) => `${f}: ${String(record[f])}`)
      .join("\n");
  } else {
    content = keys
      .filter((k) => record[k] != null && record[k] !== "")
      .map((k) => {
        const val = record[k];
        const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
        return `${label}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`;
      })
      .join("\n");
  }

  // Metadata
  const metadata: Record<string, unknown> = {};
  if (config?.metadataFields) {
    for (const f of config.metadataFields) {
      if (record[f] != null) metadata[f] = record[f];
    }
  } else {
    for (const key of keys) {
      if (record[key] != null) metadata[key] = record[key];
    }
  }

  return { sourceId, sourceTitle, content, metadata };
}

// ────────────────── indexFoods (Food-Pipeline) ──────────────────

/**
 * Indexiert normalisierte Foods → food_items + rag_food_chunks.
 */
export async function indexFoods(
  foods: NormalizedFood[],
  runId?: string,
  onProgress?: (indexed: number, total: number, logMsg?: string) => void
): Promise<IndexingResult> {
  const supabase = getSupabaseClient();
  const result: IndexingResult = { total: foods.length, indexed: 0, errors: 0, errorDetails: [] };

  // Phase 1: Upsert food_items
  for (let i = 0; i < foods.length; i += DB_BATCH_SIZE) {
    const batch = foods.slice(i, i + DB_BATCH_SIZE);
    const rows = batch.map((food) => ({
      canonical_key: food.canonicalKey,
      display_name: food.displayName,
      canonical_name: food.canonicalName,
      brand: food.brand,
      serving_text: food.servingText,
      aliases: food.aliases,
      calories_kcal: food.caloriesKcal,
      protein_g: food.proteinG,
      carbs_g: food.carbsG,
      fat_g: food.fatG,
      fiber_g: food.fiberG,
      sugar_g: food.sugarG,
      sodium_mg: food.sodiumMg,
      occurrence_count: food.occurrenceCount,
      search_text: food.searchText,
      metadata: food.metadata,
      import_run_id: runId || null,
    }));

    const { error } = await supabase
      .from("food_items")
      .upsert(rows, { onConflict: "canonical_key" });

    if (error) {
      for (const r of rows) {
        result.errors++;
        result.errorDetails.push({ title: r.display_name, error: error.message });
      }
    }
  }

  // Phase 2: food_item IDs zurückholen
  const { data: foodItemRows } = await supabase
    .from("food_items")
    .select("id, canonical_key");

  const keyToId = new Map<string, string>();
  for (const row of foodItemRows || []) {
    keyToId.set(row.canonical_key, row.id);
  }

  // Phase 3: Chunks bauen + Embeddings + rag_food_chunks upsert
  const chunks = foods.map((food) => ({
    food,
    chunk: buildFoodChunk(food),
    foodItemId: keyToId.get(food.canonicalKey),
  }));

  const processBatch = async (batch: typeof chunks, batchIndex: number) => {
    const texts = batch.map((c) => c.chunk.content);
    onProgress?.(result.indexed, chunks.length, `  ├─ Sende Batch ${batchIndex + 1} (${batch.length} Items) an Embedding...`);

    try {
      const ep = await getEmbeddingProvider();
      const embeddingResult = await ep.embed(texts);

      const rows = batch.map((c, j) => ({
        source_id: `food_${c.food.canonicalKey}`,
        source_title: c.chunk.sourceTitle,
        content: c.chunk.content,
        metadata: {
          ...c.chunk.metadata,
          embedding_model: embeddingResult.model,
          embedding_dimensions: embeddingResult.dimensions,
          content_hash: crypto.createHash("md5").update(c.chunk.content).digest("hex"),
        },
        embedding: embeddingResult.vectors[j],
        food_item_id: c.foodItemId || null,
        token_count: Math.ceil(c.chunk.content.length / 4),
      }));

      const { error } = await supabase.from("rag_food_chunks").upsert(rows, {
        onConflict: "id",
      });

      if (error) {
        result.errors += batch.length;
        for (const c of batch) {
          result.errorDetails.push({ title: c.food.displayName, error: error.message });
        }
        onProgress?.(result.indexed, chunks.length, `  ├─ ❌ FEHLER beim Supabase Upsert für Batch ${batchIndex + 1}: ${error.message}`);
      } else {
        result.indexed += batch.length;
        onProgress?.(result.indexed, chunks.length, `  ├─ Batch ${batchIndex + 1} erfolgreich: +${batch.length} (${result.indexed}/${chunks.length} gesamt)`);
      }
    } catch (err) {
      result.errors += batch.length;
      const errMsg = err instanceof Error ? err.message : String(err);
      for (const c of batch) {
        result.errorDetails.push({ title: c.food.displayName, error: errMsg });
      }
      onProgress?.(result.indexed, chunks.length, `  ├─ ❌ FEHLER im Batch-Prozess ${batchIndex + 1}: ${errMsg}`);
    }
  };

  const batches = [];
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    batches.push(chunks.slice(i, i + EMBEDDING_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i);
  }

  onProgress?.(result.indexed, chunks.length, `  └─ Phase 3 abgeschlossen.`);
  return result;
}

// ────────────────── indexRecords (Universal-Pipeline) ──────────────────

/**
 * Indexiert generische Records in eine beliebige rag_*_chunks-Tabelle.
 */
export async function indexRecords(
  tableName: string,
  records: Record<string, unknown>[],
  config?: ContentBuilderConfig,
  runId?: string,
  onProgress?: (indexed: number, total: number, logMsg?: string) => void
): Promise<IndexingResult> {
  const supabase = getSupabaseClient();
  const result: IndexingResult = { total: records.length, indexed: 0, errors: 0, errorDetails: [] };

  const datasetRecords = records.map((r, i) => buildDatasetRecord(r, i, config));

  for (let i = 0; i < datasetRecords.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = datasetRecords.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts = batch.map((r) => r.content);

    try {
      onProgress?.(result.indexed, datasetRecords.length, `├─ Sende Batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} (${batch.length} Items) an Embedding...`);
      const ep = await getEmbeddingProvider();
      const embeddingResult = await ep.embed(texts);

      const rows = batch.map((r, j) => ({
        source_id: r.sourceId,
        source_title: r.sourceTitle,
        content: r.content,
        metadata: {
          ...r.metadata,
          embedding_model: embeddingResult.model,
          embedding_dimensions: embeddingResult.dimensions,
          content_hash: crypto.createHash("md5").update(r.content).digest("hex"),
          import_run_id: runId || null,
        },
        embedding: embeddingResult.vectors[j],
        token_count: Math.ceil(r.content.length / 4),
      }));

      const { error } = await supabase.from(tableName).insert(rows);

      if (error) {
        result.errors += batch.length;
        for (const r of batch) {
          result.errorDetails.push({ title: r.sourceTitle, error: error.message });
        }
        onProgress?.(result.indexed, datasetRecords.length, `├─ ❌ DB Fehler: ${error.message}`);
      } else {
        result.indexed += batch.length;
        onProgress?.(result.indexed, datasetRecords.length, `├─ Batch erfolgreich: +${batch.length} (${result.indexed}/${datasetRecords.length})`);
      }
    } catch (err) {
      result.errors += batch.length;
      const errMsg = err instanceof Error ? err.message : "Unknown embedding error";
      for (const r of batch) {
        result.errorDetails.push({ title: r.sourceTitle, error: errMsg });
      }
      onProgress?.(result.indexed, datasetRecords.length, `├─ ❌ FEHLER: ${errMsg}`);
    }
  }

  return result;
}
