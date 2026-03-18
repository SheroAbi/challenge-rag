# Codebase Explained – Datei-für-Datei Erklärung

> Dieses Dokument erklärt die Kernlogik jeder Datei im Detail — ideal für Onboarding oder Präsentationen.

---

## 1. Datenfluss-Überblick

```
Benutzer-Frage
    ↓
/api/chat/query (Route Handler)
    ↓
RAG-Orchestrator
    ├── Theme-Router → wählt Retriever basierend auf ThemeKey
    ├── Food-Theme → FoodHybridRetriever (Trigram + Semantic)
    └── Andere Themes → GenericSemanticRetriever (Semantic only)
    ↓
Remote Microservice Embedding (Render.com HTTP Call)
    ↓
pgvector Similarity Search (Supabase RPCs)
    ↓
GeminiAnswerGenerator → Antwort mit Kontext
    ↓
JSON Response → Chat-UI
```

---

## 2. API-Schicht (`src/app/api/`)

### `chat/query/route.ts`
Haupt-Endpunkt. Validiert via `chatQueryRequestSchema`, ruft den `ragOrchestrator` auf, der:
1. Den Theme-Router nach dem passenden Retriever fragt
2. Top-K Chunks aus der Datenbank holt
3. Die Chunks als Kontext an den GeminiAnswerGenerator gibt
4. Antwort + Citations + ResultTable zurückgibt

### `rag/retrieve/route.ts`
Reiner Retrieval-Endpunkt ohne LLM-Generierung. Nützlich für direktes Testen der Vektorsuche.

### `knowledge/upload/route.ts`
SSE-Streaming-Upload. Zwei Pfade:
- **Food + TSV**: Streaming-Parser (`MfpTsvParser`) → Normalisierung → Batch-Embedding → Upsert
- **Universal**: komplette Datei lesen → `parseDataset()` → `indexDataset()` → Upsert

Erstellt `import_runs` und `import_errors` Einträge für Tracking.

### `knowledge/stats/route.ts`
Zählt food_items, alle RAG-Chunks und import_runs. Liefert `lastImport` Timestamp.

### `knowledge/tables/route.ts`
Ruft die `get_rag_tables()` RPC auf um alle `rag_*_chunks`-Tabellen dynamisch zu erkennen + Row-Counts zu liefern.

### `health/route.ts`
Einfacher Liveness-Check. Prüft Supabase-URL und Gemini-Konfiguration dynamisch.

---

## 3. Server-Logik (`src/server/`)

### AI Provider (`ai/providers/`)
- **`embedding-provider.ts`**: Interface `EmbeddingProvider` mit `embed()` und `embedSingle()`
- **`remote-embedding-provider.ts`**: Aufruf des Render.com Microservices (`embedding-service/`). Umgeht Netlify Serverless (ONNX) Einschränkungen, behält aber das gleiche Modell `all-MiniLM-L6-v2`.
- **`answer-generator.ts`**: Interface `AnswerGenerator`
- **`gemini-answer-generator.ts`**: Gemini REST API Anbindung. Baut System-Prompt mit Kontext-Chunks, sendet an `generativelanguage.googleapis.com`
- **`retriever.ts`**: Interface `Retriever` mit generischem `search()` Vertrag

### Food-Pipeline (`food/`)
- **`normalizer.ts`**: Normalisiert MFP-Einträge zu `NormalizedFood` (Canonical Keys, Search Text, Aliases)
- **`chunk-builder.ts`**: Baut strukturierten Text-Chunk für Embedding aus Food-Daten
- **`food-indexer.ts`**: Batch-Upload in `food_items` (Upsert) + `rag_food_chunks` (Embedding + Upsert)
- **`food-hybrid-retriever.ts`**: Kombiniert `search_food_items_lexical` (Trigram) mit `match_rag_food_chunks` (Semantic), merged und rerankt
- **Parser**: `mfp-tsv-parser.ts` (MFP-spezifisch), `flat-tabular-parser.ts` (generisch CSV/TSV), `json-parser.ts`, `format-detector.ts`

### Universal-Pipeline (`dataset/`)
- **`universal-parser.ts`**: Erkennt Format (JSON/JSONL/CSV/TSV) und parsed zu Array von Records
- **`dataset-indexer.ts`**: Baut aus Records DatasetRecords (title, content, metadata), embedded und inserted in beliebige `rag_*_chunks`-Tabelle

### RAG-Routing (`rag/`)
- **`theme-router.ts`**: Mappt `ThemeKey` → `{ tableName, matchRpc, label, description }`
- **`generic-semantic-retriever.ts`**: Embedding + RPC-basiertes Retrieval für jedes Theme außer Food

### Orchestrator (`services/rag-orchestrator.ts`)
Koordiniert den gesamten Flow: Theme-basierter Retriever → Ergebnisse → GeminiAnswerGenerator → Formatierung als strukturierte Antwort.

---

## 4. Frontend (`src/components/`)

### `animated-ai-chat.tsx`
Haupt-Chat-Komponente auf der Startseite:
- Theme-Dropdown (Food/SaaS/Exercises)
- TopK-Selector (5/10/15/20)
- Streaming-Typing-Indicator
- Markdown-Rendering mit ReactMarkdown + remark-gfm
- Spezielle Exercise-Cards mit Bild-Lightbox bei Übungs-Ergebnissen

### `rag-upload-modal.tsx`
Upload-Modal:
- Dynamische Tabellen-Auswahl aus `/api/knowledge/tables`
- Drag & Drop Datei-Upload
- SSE-basierter Live-Fortschritt
- Collapsibles Terminal-Log mit Timestamps

### `shell/app-shell.tsx`
App-Rahmen: Desktop zeigt sticky Sidebar, Mobile zeigt Overlay-Drawer mit Framer Motion Animationen.

### `shell/app-sidebar.tsx`
Animierte collapsible Sidebar mit Navigation, Theme-Toggle, API-Health Link.

---

## 5. Datenbank (`supabase/migrations/`)

6 Migrationen bauen sukzessiv auf:
1. **001**: pgvector Extension, food_items, rag_food_chunks + Match-RPCs
2. **002**: rag_saas_chunks, rag_exercise_chunks + Theme-RPCs
3. **003**: Food-Pipeline Indizes
4. **004**: HNSW-Indizes für performanten Vektor-Scan
5. **005**: Workspace-Parameter aus RPCs entfernt (Single-Tenant)
6. **006**: pg_trgm, import_runs, import_errors, get_rag_tables()
