-- ============================================================
-- Phase 2: Food-Pipeline – Spezifische Tabellen & Indizes
-- ============================================================

-- ============================================================
-- 1. food_import_runs – Tracking jedes Import-Laufs
-- ============================================================
CREATE TABLE food_import_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_hash       TEXT,
  parser_type     TEXT NOT NULL CHECK (parser_type IN ('mfp_tsv', 'flat_tabular_food', 'json_records')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_records   INTEGER DEFAULT 0,
  processed       INTEGER DEFAULT 0,
  deduplicated    INTEGER DEFAULT 0,
  skipped         INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  error_summary   TEXT,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_runs_workspace ON food_import_runs(workspace_id);
CREATE INDEX idx_food_runs_status ON food_import_runs(status);
CREATE UNIQUE INDEX idx_food_runs_hash ON food_import_runs(workspace_id, file_hash)
  WHERE file_hash IS NOT NULL AND status = 'completed';

-- ============================================================
-- 2. food_import_errors – Fehlerhafte Records pro Run
-- ============================================================
CREATE TABLE food_import_errors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          UUID NOT NULL REFERENCES food_import_runs(id) ON DELETE CASCADE,
  record_ref      TEXT,
  error_code      TEXT NOT NULL,
  raw_preview     TEXT,
  diagnosis       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_food_errors_run ON food_import_errors(run_id);

-- ============================================================
-- 3. food_items – Normalisierte Food-Basis
-- ============================================================
CREATE TABLE food_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_key     TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  canonical_name    TEXT NOT NULL,
  brand             TEXT,
  serving_text      TEXT,
  aliases           TEXT[] DEFAULT '{}',

  -- Standardisierte Nährwerte
  calories_kcal     NUMERIC,
  protein_g         NUMERIC,
  carbs_g           NUMERIC,
  fat_g             NUMERIC,
  fiber_g           NUMERIC,
  sugar_g           NUMERIC,
  sodium_mg         NUMERIC,

  occurrence_count  INTEGER DEFAULT 1,
  first_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW(),

  search_text       TEXT NOT NULL DEFAULT '',
  metadata          JSONB DEFAULT '{}'::jsonb,

  import_run_id     UUID REFERENCES food_import_runs(id) ON DELETE SET NULL,
  import_source_ref TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (workspace_id, canonical_key)
);

CREATE INDEX idx_food_items_workspace ON food_items(workspace_id);
CREATE INDEX idx_food_items_search_trgm ON food_items USING gin (search_text gin_trgm_ops);
CREATE INDEX idx_food_items_canonical ON food_items(workspace_id, canonical_name);
CREATE INDEX idx_food_items_brand ON food_items(workspace_id, brand) WHERE brand IS NOT NULL;

-- ============================================================
-- 4. Erweitere rag_food_chunks mit food_item_id FK
-- ============================================================
ALTER TABLE rag_food_chunks
  ADD COLUMN IF NOT EXISTS food_item_id UUID REFERENCES food_items(id) ON DELETE SET NULL;

CREATE INDEX idx_food_chunks_item ON rag_food_chunks(food_item_id) WHERE food_item_id IS NOT NULL;

-- ============================================================
-- 5. HNSW-Index auf rag_food_chunks.embedding
-- ============================================================
CREATE INDEX idx_food_chunks_hnsw ON rag_food_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 6. Aktualisierte match_rag_food_chunks RPC
-- ============================================================
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
  food_item_id UUID,
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
    r.food_item_id,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_food_chunks r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
    AND (filter_workspace_id IS NULL OR r.workspace_id = filter_workspace_id)
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 7. Lexikalische Suche RPC auf food_items
-- ============================================================
CREATE OR REPLACE FUNCTION search_food_items_lexical(
  search_query TEXT,
  filter_workspace_id UUID DEFAULT NULL,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  display_name TEXT,
  canonical_name TEXT,
  brand TEXT,
  serving_text TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  similarity_rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.id,
    fi.workspace_id,
    fi.display_name,
    fi.canonical_name,
    fi.brand,
    fi.serving_text,
    fi.calories_kcal,
    fi.protein_g,
    fi.carbs_g,
    fi.fat_g,
    similarity(fi.search_text, search_query) AS similarity_rank
  FROM food_items fi
  WHERE (filter_workspace_id IS NULL OR fi.workspace_id = filter_workspace_id)
    AND fi.search_text % search_query
  ORDER BY similarity_rank DESC
  LIMIT max_results;
END;
$$;
