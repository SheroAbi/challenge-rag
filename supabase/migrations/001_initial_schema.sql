-- ============================================================
-- RAG Help Center – Initiales Datenbankschema
-- ============================================================
-- Dieses Schema bildet die Grundlage für das mandantenfähige
-- RAG-System mit pgvector-Support für Vektorsuche.
-- ============================================================

-- Extension für Vektorsuche aktivieren
CREATE EXTENSION IF NOT EXISTS vector;

-- Extension für UUID-Generierung
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Workspaces (Mandantenstruktur)
-- ============================================================
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);

-- ============================================================
-- Documents (Wissensquellen pro Workspace)
-- ============================================================
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'manual'
                CHECK (source_type IN ('manual', 'upload', 'url', 'api')),
  source_url    TEXT,
  content       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'chunked', 'embedded', 'failed')),
  chunk_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_status ON documents(status);

-- ============================================================
-- Document Chunks (Textabschnitte eines Dokuments)
-- ============================================================
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  token_count   INTEGER DEFAULT 0,
  -- Nullable: wird erst bei Embedding-Aktivierung befüllt
  embedding     vector(384),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_position ON document_chunks(document_id, position);

-- ============================================================
-- Chat Sessions
-- ============================================================
CREATE TABLE chat_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT DEFAULT 'Neue Sitzung',
  message_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_workspace ON chat_sessions(workspace_id);

-- ============================================================
-- Chat Messages
-- ============================================================
CREATE TABLE chat_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT NOT NULL,
  citations     JSONB DEFAULT '[]',
  latency_ms    INTEGER,
  token_count   INTEGER,
  model         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id);
CREATE INDEX idx_messages_created ON chat_messages(created_at);

-- ============================================================
-- Connections (Provider-Konfigurationen)
-- ============================================================
CREATE TABLE connections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  provider_type   TEXT NOT NULL CHECK (provider_type IN ('embedding', 'generation')),
  status          TEXT NOT NULL DEFAULT 'unconfigured'
                  CHECK (status IN ('active', 'inactive', 'error', 'unconfigured')),
  is_configured   BOOLEAN DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connections_workspace ON connections(workspace_id);
CREATE UNIQUE INDEX idx_connections_unique ON connections(workspace_id, provider);

-- ============================================================
-- Ingestion Jobs (Import-/Verarbeitungstracking)
-- ============================================================
CREATE TABLE ingestion_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_workspace ON ingestion_jobs(workspace_id);
CREATE INDEX idx_jobs_status ON ingestion_jobs(status);

-- ============================================================
-- Default-Workspace (Seed)
-- ============================================================
INSERT INTO workspaces (slug, name, description, is_default)
VALUES (
  'default',
  'Acme Help Center',
  'Standard-Workspace für das RAG Help Center Demo-Projekt.',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;
