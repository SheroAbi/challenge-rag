import { z } from "zod";

/**
 * Zod-Schemas für alle API-Request/Response-Contracts.
 * Jeder Endpunkt hat ein klar definiertes Input/Output-Schema.
 */

// ==================== Themes ====================

export const themeKeySchema = z.enum(["saas_docs", "food", "exercises"]);
export type ThemeKey = z.infer<typeof themeKeySchema>;

// ==================== Chat ====================

export const chatQueryRequestSchema = z.object({
  question: z
    .string()
    .min(1, "Frage darf nicht leer sein")
    .max(2000, "Frage darf maximal 2000 Zeichen lang sein"),
  sessionId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(50).default(10),
  theme: themeKeySchema,
});
export type ChatQueryRequest = z.infer<typeof chatQueryRequestSchema>;

export const chatQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      documentId: z.string(),
      documentTitle: z.string(),
      chunkId: z.string(),
      content: z.string(),
      relevanceScore: z.number(),
    })
  ),
  sessionId: z.string(),
  model: z.string().nullable(),
  latencyMs: z.number(),
  resultTable: z.object({
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }).optional(),
  retrievalHits: z.array(
    z.object({
      chunkId: z.string(),
      documentId: z.string(),
      documentTitle: z.string(),
      content: z.string(),
      score: z.number(),
      position: z.number(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      sourceId: z.string().optional(),
    })
  ).optional(),
});
export type ChatQueryResponse = z.infer<typeof chatQueryResponseSchema>;

// ==================== Retrieval ====================

export const retrievalRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).default(10),
  theme: themeKeySchema,
});
export type RetrievalRequest = z.infer<typeof retrievalRequestSchema>;

export const retrievalResponseSchema = z.object({
  matches: z.array(
    z.object({
      chunkId: z.string(),
      documentId: z.string(),
      documentTitle: z.string(),
      content: z.string(),
      score: z.number(),
      position: z.number(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      sourceId: z.string().optional(),
    })
  ),
  model: z.string().nullable(),
  latencyMs: z.number(),
});
export type RetrievalResponse = z.infer<typeof retrievalResponseSchema>;

// ==================== Generation ====================

export const generateRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  contextChunks: z.array(
    z.object({
      content: z.string(),
      documentTitle: z.string(),
      chunkId: z.string(),
    })
  ),
  tone: z.enum(["professional", "friendly", "technical"]).default("professional"),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const generateResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      documentId: z.string(),
      documentTitle: z.string(),
      chunkId: z.string(),
      content: z.string(),
      relevanceScore: z.number(),
    })
  ),
  model: z.string().nullable(),
  latencyMs: z.number(),
});
export type GenerateResponse = z.infer<typeof generateResponseSchema>;

// ==================== Knowledge / Dokumente ====================

export const documentCreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  sourceType: z.enum(["manual", "upload", "url", "api"]),
  content: z.string().min(1),
  sourceUrl: z.string().url().optional(),
});
export type DocumentCreateRequest = z.infer<typeof documentCreateRequestSchema>;

export const knowledgeImportRequestSchema = z.object({
  sourceType: z.enum(["manual", "upload", "url"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  theme: themeKeySchema,
});
export type KnowledgeImportRequest = z.infer<typeof knowledgeImportRequestSchema>;

// ==================== Health ====================

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  timestamp: z.string(),
  environment: z.string(),
  features: z.object({
    supabase: z.boolean(),
    embedding: z.boolean(),
    generation: z.boolean(),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
