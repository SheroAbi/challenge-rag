/**
 * Universal RAG Retriever.
 * Ein einziger Retriever für ALLE Themes.
 * - Food: Hybrid (Trigram + Semantic)
 * - Alles andere: Semantic-only (pgvector)
 */

import { getSupabaseClient } from "@/integrations/supabase/client";
import type { EmbeddingProvider } from "@/server/ai/providers/embedding-provider";
import { getThemeConfig } from "@/server/rag/theme-router";
import type { ThemeKey } from "@/server/contracts/schemas";

// ────────────────── Types ──────────────────

export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  position: number;
  metadata?: Record<string, unknown>;
  sourceId?: string;
}

export interface RetrieverInput {
  query: string;
  topK: number;
  threshold?: number;
}

export interface RetrieverOutput {
  matches: RetrievalHit[];
  model: string | null;
  latencyMs: number;
}

// ────────────────── Implementation ──────────────────

// Remote embedding provider – calls Supabase Edge Function instead of loading
// @xenova/transformers locally (ONNX binaries are not available on Netlify Lambda)
import { RemoteEmbeddingProvider } from "@/server/ai/providers/remote-embedding-provider";

let _embeddingProvider: EmbeddingProvider | null = null;
function getEmbeddingProvider(): EmbeddingProvider {
  if (!_embeddingProvider) {
    _embeddingProvider = new RemoteEmbeddingProvider();
  }
  return _embeddingProvider;
}

export class UniversalRetriever {
  readonly name: string;
  private theme: ThemeKey;

  constructor(theme: ThemeKey) {
    this.theme = theme;
    this.name = `${theme}-retriever`;
  }

  async search(request: RetrieverInput): Promise<RetrieverOutput> {
    const startTime = Date.now();
    const supabase = getSupabaseClient();

    if (this.theme === "food") {
      // Hybrid: Lexikalisch + Semantisch parallel
      const [lexicalResults, semanticResults] = await Promise.all([
        this.lexicalSearch(supabase, request),
        this.semanticSearch(supabase, request),
      ]);
      const merged = this.mergeAndRerank(lexicalResults, semanticResults, request.topK);
      const ep = await getEmbeddingProvider();
      return { matches: merged, model: ep.model, latencyMs: Date.now() - startTime };
    }

    // Semantic-only für alle anderen Themes
    const hits = await this.semanticSearch(supabase, request);
    const ep = await getEmbeddingProvider();
    return { matches: hits.slice(0, request.topK), model: ep.model, latencyMs: Date.now() - startTime };
  }

  // ── Lexikalische Suche (nur Food, Trigram auf food_items) ──

  private async lexicalSearch(
    supabase: ReturnType<typeof getSupabaseClient>,
    request: RetrieverInput
  ): Promise<RetrievalHit[]> {
    try {
      const { data, error } = await supabase.rpc("search_food_items_lexical", {
        search_query: request.query,
        max_results: request.topK,
      });

      if (error || !data) return [];

      return (data as Record<string, unknown>[]).map((item, i) => ({
        chunkId: String(item.id),
        documentId: String(item.id),
        documentTitle: String(item.display_name),
        content: `${item.display_name} | ${item.brand || ""} | ${item.calories_kcal} kcal | ${item.protein_g}g Protein | ${item.carbs_g}g Carbs | ${item.fat_g}g Fett`,
        score: Number(item.similarity_rank) + 0.1, // Boost für exakte Treffer
        position: i,
        metadata: {
          calories: Number(item.calories_kcal),
          protein: Number(item.protein_g),
          carbs: Number(item.carbs_g),
          fat: Number(item.fat_g),
          brand: item.brand,
        },
      }));
    } catch {
      return [];
    }
  }

  // ── Semantische Suche (alle Themes, pgvector) ──

  private async semanticSearch(
    supabase: ReturnType<typeof getSupabaseClient>,
    request: RetrieverInput
  ): Promise<RetrievalHit[]> {
    try {
      const themeConfig = getThemeConfig(this.theme);
      const ep2 = await getEmbeddingProvider();
      const queryEmbedding = await ep2.embedSingle(request.query);

      console.log(`[Retriever] Theme: ${this.theme}, RPC: ${themeConfig.matchRpc}, Query: "${request.query.substring(0, 50)}...", Embedding dims: ${queryEmbedding.length}`);

      const { data, error } = await supabase.rpc(themeConfig.matchRpc as string & keyof never, {
        query_embedding: queryEmbedding,
        match_count: request.topK * 3,
        similarity_threshold: request.threshold || 0.0,
      });

      if (error) {
        console.error(`[Retriever] RPC Error for ${themeConfig.matchRpc}:`, error.message, error.details, error.hint);
        return [];
      }

      if (!data || (data as unknown[]).length === 0) {
        console.warn(`[Retriever] RPC ${themeConfig.matchRpc} returned no data`);
        return [];
      }

      console.log(`[Retriever] RPC returned ${(data as unknown[]).length} results`);

      const seen = new Set<string>();
      const hits: RetrievalHit[] = [];

      for (const item of data as Record<string, unknown>[]) {
        if (hits.length >= request.topK) break;

        // Food: Dedupliziere nach Titel (gleiche Lebensmittel zusammenführen)
        // SaaS/Exercises: Dedupliziere nach Content (verhindert echte Duplikate,
        // erlaubt aber verschiedene Chunks vom selben Dokument)
        const content = String(item.content || "");
        const key = this.theme === "food"
          ? String(item.source_title || item.document_title || item.id).toLowerCase()
          : content.substring(0, 150).toLowerCase().trim();

        if (!seen.has(key)) {
          seen.add(key);

          // Food chunks haben food_item_id und spezielle Metadata
          if (this.theme === "food") {
            const m = (item.metadata as Record<string, unknown>) || {};
            hits.push({
              chunkId: String(item.id),
              documentId: String(item.food_item_id || item.id),
              documentTitle: String(item.source_title),
              content: String(item.content),
              score: Number(item.similarity),
              position: hits.length,
              metadata: {
                calories: m.calories_kcal,
                protein: m.protein_g,
                carbs: m.carbs_g,
                fat: m.fat_g,
                brand: m.brand,
              },
            });
          } else {
            hits.push({
              chunkId: String(item.id),
              documentId: String(item.source_id || item.id),
              documentTitle: String(item.source_title || item.document_title || "Unbekannt"),
              content: String(item.content),
              score: Number(item.similarity),
              position: hits.length,
              metadata: item.metadata as Record<string, unknown>,
              sourceId: item.source_id ? String(item.source_id) : undefined,
            });
          }
        }
      }

      return hits;
    } catch {
      return [];
    }
  }

  // ── Merge & Rerank (nur für Hybrid-Suche) ──

  private mergeAndRerank(
    lexical: RetrievalHit[],
    semantic: RetrievalHit[],
    topK: number
  ): RetrievalHit[] {
    const seen = new Set<string>();
    const all: RetrievalHit[] = [];

    // Semantische Treffer zuerst (primäre Quelle)
    for (const hit of semantic) {
      const key = hit.documentTitle.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(hit);
      }
    }

    // Lexikalische Treffer hinzufügen (mit Boost)
    for (const hit of lexical) {
      const key = hit.documentTitle.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(hit);
      }
    }

    all.sort((a, b) => b.score - a.score);
    return all.slice(0, topK).map((hit, i) => ({ ...hit, position: i }));
  }
}
