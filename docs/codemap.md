# Codemap – Vollständige Dateiübersicht

> Autoritative Übersicht aller Dateien im Projekt. Status: **AKTIV** = zur Laufzeit genutzt, **KONFIGURATION** = Build/Dev-Tooling.

---

## `src/app/` – Seiten & API-Routen

| Datei | Zweck | Typ |
|---|---|---|
| `page.tsx` | Landing-Page mit integriertem Chat | Seite |
| `layout.tsx` | Root-Layout (Fonts, ThemeProvider, AppShell) | Layout |
| `globals.css` | Design-System (Light/Dark CSS Vars, Tailwind @theme) | Styles |
| `favicon.ico` | App-Icon | Asset |
| `about/page.tsx` | Projekt-Info, Tech-Stack, Architektur-Übersicht | Seite |
| `ask/page.tsx` | Redirect → `/` (Kompatibilität) | Redirect |
| `knowledge/page.tsx` | Wissensbasis-UI, Live-Stats, Upload-Trigger | Seite |
| `api/health/route.ts` | GET — Liveness-Check + Feature-Flags | API |
| `api/chat/query/route.ts` | POST — Chat-Orchestrierung (RAG → LLM → Antwort) | API |
| `api/rag/retrieve/route.ts` | POST — Reiner Retrieval-Endpunkt | API |
| `api/knowledge/stats/route.ts` | GET — DB-Statistiken (Chunks, Items, Imports) | API |
| `api/knowledge/tables/route.ts` | GET — Dynamische RAG-Tabellenübersicht | API |
| `api/knowledge/upload/route.ts` | POST — SSE-Upload (Parsing → Embedding → Indexierung) | API |

## `src/components/` – UI-Komponenten

| Datei | Zweck |
|---|---|
| `animated-ai-chat.tsx` | Haupt-Chat-UI mit Theme-Selector, Chunk-Selector, Markdown-Rendering |
| `rag-upload-modal.tsx` | Upload-Modal mit Drag&Drop, Tabellen-Selektor, SSE-Logs |
| `theme-provider.tsx` | next-themes Wrapper |
| `shell/app-shell.tsx` | App-Rahmen (Desktop-Sidebar + Mobile-Drawer) |
| `shell/app-sidebar.tsx` | Sidebar-Navigation (collapsible, animiert) |
| `shell/theme-toggle.tsx` | Dark/Light Mode Toggle |

## `src/server/ai/` – KI-Provider

| Datei | Zweck |
|---|---|
| `config/gemini-config.ts` | Gemini-Konfiguration (Generation-only, Env-Validierung) |
| `providers/embedding-provider.ts` | EmbeddingProvider Interface + Stub |
| `providers/remote-embedding-provider.ts` | Ruft den Render.com Embedding Microservice via HTTP auf |
| `providers/answer-generator.ts` | AnswerGenerator Interface + Stub |
| `providers/gemini-answer-generator.ts` | Gemini LLM Generierung |
| `providers/retriever.ts` | Retriever Interface + Stub |

## `src/server/food/` – Food-Pipeline

| Datei | Zweck |
|---|---|
| `food-indexer.ts` | Batch-Embedding + DB-Upsert für Food-Items |
| `food-hybrid-retriever.ts` | Hybrid-Retrieval (Trigram + Semantic) |
| `chunk-builder.ts` | Food-Chunk Text-Builder |
| `normalizer.ts` | Food-Record Normalisierung + Deduplizierung |
| `parsers/flat-tabular-parser.ts` | CSV/TSV Parser |
| `parsers/format-detector.ts` | Auto-Format-Erkennung |
| `parsers/json-parser.ts` | JSON/JSONL Parser |
| `parsers/mfp-tsv-parser.ts` | MFP-spezifischer TSV-Streaming-Parser |
| `parsers/types.ts` | Parser-Typen |

## `src/server/dataset/` – Universal-Pipeline

| Datei | Zweck |
|---|---|
| `dataset-indexer.ts` | Universal-Indexer für jede `rag_*_chunks`-Tabelle |
| `universal-parser.ts` | Universal-Parser (JSON, CSV, TSV, JSONL) |

## `src/server/rag/` – Retrieval & Routing

| Datei | Zweck |
|---|---|
| `generic-semantic-retriever.ts` | Semantisches Retrieval für nicht-Food Themes |
| `theme-router.ts` | Theme → Tabelle/RPC Mapping |

## `src/server/` – Weitere Server-Logik

| Datei | Zweck |
|---|---|
| `services/rag-orchestrator.ts` | Haupt-Orchestrator (Retrieval → Generation → Response) |
| `contracts/schemas.ts` | Zod-Schemas für alle API-Contracts |
| `domain/types.ts` | Domänentypen (Document, Chat, Retrieval, Ingestion) |

## `src/integrations/` + `src/lib/`

| Datei | Zweck |
|---|---|
| `integrations/supabase/client.ts` | Supabase-Client Factory |
| `lib/errors.ts` | Domänen-Fehlerklassen (NotImplementedServiceError etc.) |
| `lib/utils.ts` | Hilfsfunktionen (cn, generateRequestId) |
| `lib/types/api.ts` | API Response Envelope (apiSuccess, apiError) |

## `supabase/migrations/`

| Datei | Inhalt |
|---|---|
| `001_initial_schema.sql` | pgvector, food_items, rag_food_chunks, RPCs |
| `002_theme_rag_tables.sql` | rag_saas_chunks, rag_exercise_chunks, Theme-RPCs |
| `003_food_pipeline.sql` | Food-Pipeline DB-Objekte |
| `004_saas_exercises_hnsw.sql` | HNSW-Indizes + RPC-Updates |
| `005_remove_workspace_id_from_rpcs.sql` | Single-Tenant RPC-Refactoring |
| `006_runtime_alignment.sql` | pg_trgm, import_runs, import_errors, get_rag_tables() |

## `embedding-service/` – Embedding Microservice (Render.com)

| Datei | Zweck |
|---|---|
| `index.mjs` | Minimaler Express Server mit `@xenova/transformers` (all-MiniLM-L6-v2) |
| `package.json` | Dependencies für den dedizierten Service |

## Root-Konfiguration

| Datei | Zweck |
|---|---|
| `package.json` | Dependencies + Scripts |
| `tsconfig.json` | TypeScript-Konfiguration (Strict, Path Aliases) |
| `eslint.config.mjs` | ESLint mit next/core-web-vitals + typescript |
| `postcss.config.mjs` | PostCSS für Tailwind |
| `next.config.ts` | Next.js Konfiguration |
| `.env.local` | Umgebungsvariablen (nicht committed) |
