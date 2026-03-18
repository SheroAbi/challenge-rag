-- ============================================================
-- Phase 2: SaaS & Exercises HNSW Indizes & RPC Updates
-- ============================================================

-- 1. HNSW Index für SaaS
CREATE INDEX IF NOT EXISTS idx_saas_chunks_hnsw ON rag_saas_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. HNSW Index für Exercises
CREATE INDEX IF NOT EXISTS idx_exercise_chunks_hnsw ON rag_exercise_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. Update SaaS RPC to filter out NULL embeddings
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
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Update Exercises RPC to filter out NULL embeddings
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
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
