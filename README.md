# Everlast RAG – Multi-Theme Knowledge Base

> **Recruiting-Challenge**: Vollständig implementiertes RAG-System mit lokalen Embeddings, Gemini-Generierung und Multi-Theme-Retrieval.

---

## Quick Start

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen einrichten
cp .env.example .env.local
# → Werte eintragen (siehe unten)

# 3. Dev-Server starten
npm run dev

# 4. Browser öffnen → http://localhost:3000
```

## Umgebungsvariablen

```env
# Supabase (Pflicht)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gemini (Pflicht für LLM-Generierung)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_GENERATION_MODEL=gemini-2.0-flash
```

> **Embeddings laufen lokal** via `@xenova/transformers` – kein externer API-Key nötig.

## Technologie-Stack

| Technologie | Version | Zweck |
|---|---|---|
| **Next.js** | 16.1.6 | App Router, Route Handlers |
| **React** | 19.2.3 | UI mit Framer Motion Animationen |
| **TypeScript** | 5.x | Strict Mode |
| **Tailwind CSS** | 4.x | Design System mit Dark Mode |
| **Supabase** | 2.x | PostgreSQL + pgvector + HNSW |
| **@xenova/transformers** | 2.x | Lokale Embeddings (all-MiniLM-L6-v2) |
| **Gemini API** | — | LLM-Generierung (Antworten) |
| **Zod** | 4.x | Schema-Validierung |

## API-Endpunkte

| Methode | Route | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Liveness-Check + Feature-Flags |
| `POST` | `/api/chat/query` | Chat-Orchestrierung (Retrieval → LLM → Antwort) |
| `POST` | `/api/rag/retrieve` | Reiner Vektor-Retrieval-Endpunkt |
| `POST` | `/api/knowledge/upload` | SSE-Upload: Parsing → Embedding → Indexierung |
| `GET` | `/api/knowledge/stats` | Live-Statistiken (Chunks, Items, Imports) |
| `GET` | `/api/knowledge/tables` | Dynamische RAG-Tabellenübersicht |

## Themes (Datenbereiche)

| Theme | Tabelle | Retrieval-Methode |
|---|---|---|
| **Food** | `rag_food_chunks` + `food_items` | Hybrid (Trigram + Semantic) |
| **SaaS Docs** | `rag_saas_chunks` | Semantisch (pgvector) |
| **Exercises** | `rag_exercise_chunks` | Semantisch (pgvector + Bilder) |

## Projektstruktur

```
challenge-rag/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing + Chat
│   │   ├── about/page.tsx            # Projekt-Info
│   │   ├── knowledge/page.tsx        # Wissensbasis-UI
│   │   └── api/                      # Route Handlers
│   │       ├── health/
│   │       ├── chat/query/
│   │       ├── rag/retrieve/
│   │       └── knowledge/{stats,tables,upload}/
│   ├── components/                   # React-Komponenten
│   │   ├── animated-ai-chat.tsx      # Chat-UI
│   │   ├── rag-upload-modal.tsx      # Upload-Modal
│   │   └── shell/                    # App-Shell + Sidebar
│   ├── server/                       # Backend-Logik
│   │   ├── ai/                       # Provider-Interfaces + Implementierungen
│   │   ├── food/                     # Food-Pipeline (Parser, Indexer, Retriever)
│   │   ├── dataset/                  # Universal-Pipeline (Parser, Indexer)
│   │   ├── rag/                      # Theme-Router + semantisches Retrieval
│   │   ├── services/                 # RAG-Orchestrator
│   │   ├── contracts/schemas.ts      # Zod-API-Contracts
│   │   └── domain/types.ts           # Domänentypen
│   ├── integrations/supabase/        # Supabase-Client
│   └── lib/                          # Utilities + Error-Klassen
├── supabase/migrations/              # 6 SQL-Migrationen
├── docs/                             # Doku (Blueprint, Codemap, Erklärung)
└── package.json
```

## Datenbank-Migrationen

| Migration | Inhalt |
|---|---|
| `001_initial_schema.sql` | Basis: pgvector, food_items, rag_food_chunks |
| `002_theme_rag_tables.sql` | Theme-Tabellen + RPCs |
| `003_food_pipeline.sql` | Food-Pipeline-Objekte |
| `004_saas_exercises_hnsw.sql` | HNSW-Indizes + RPC-Updates |
| `005_remove_workspace_id_from_rpcs.sql` | Single-Tenant RPCs |
| `006_runtime_alignment.sql` | pg_trgm, import_runs, import_errors, get_rag_tables() |

## Architektur

```
User → Chat-UI → /api/chat/query → RAG-Orchestrator
                                       ↓
                               Theme-Router (food/saas/exercises)
                                       ↓
                          ┌─────────────┴─────────────┐
                    Food-Hybrid-Retriever    Generic-Semantic-Retriever
                    (Trigram + pgvector)           (pgvector)
                          └─────────────┬─────────────┘
                                       ↓
                              Gemini Answer Generator
                                       ↓
                              Antwort + Quellen → UI
```

## Weiterführende Dokumentation

- [`docs/project-blueprint.md`](docs/project-blueprint.md) – Architektur & Design-Entscheidungen
- [`docs/codebase-explained.md`](docs/codebase-explained.md) – Datei-für-Datei Erklärung
- [`docs/codemap.md`](docs/codemap.md) – Autoritative Datei-Codemap

---

**Recruiting-Challenge** · Next.js 16 · TypeScript · Supabase · RAG v1.0.0
