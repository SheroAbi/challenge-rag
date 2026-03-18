-- ============================================================
-- RAG Help Center – Theme Tables & RPCs
-- ============================================================
-- Migration für themenspezifische RAG-Tabellen (SaaS, Food, Exercises)
-- ============================================================

-- ============================================================
-- 1. SaaS Docs
-- ============================================================
CREATE TABLE rag_saas_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id     TEXT,
  source_title  TEXT,
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  embedding     vector(384),
  token_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saas_workspace ON rag_saas_chunks(workspace_id);

CREATE OR REPLACE FUNCTION match_rag_saas_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  filter_workspace_id UUID DEFAULT NULL,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  source_id TEXT,
  source_title TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.workspace_id,
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_saas_chunks r
  WHERE 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================
-- 2. Food
-- ============================================================
CREATE TABLE rag_food_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id     TEXT,
  source_title  TEXT,
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  embedding     vector(384),
  token_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_workspace ON rag_food_chunks(workspace_id);

CREATE OR REPLACE FUNCTION match_rag_food_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  filter_workspace_id UUID DEFAULT NULL,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  source_id TEXT,
  source_title TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.workspace_id,
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_food_chunks r
  WHERE 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================
-- 3. Exercises
-- ============================================================
CREATE TABLE rag_exercise_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id     TEXT,
  source_title  TEXT,
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}'::jsonb,
  embedding     vector(384),
  token_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercise_workspace ON rag_exercise_chunks(workspace_id);

CREATE OR REPLACE FUNCTION match_rag_exercise_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  filter_workspace_id UUID DEFAULT NULL,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  source_id TEXT,
  source_title TEXT,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.workspace_id,
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_exercise_chunks r
  WHERE 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
