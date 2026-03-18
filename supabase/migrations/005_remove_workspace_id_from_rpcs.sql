-- ============================================================
-- Phase 3: Remove workspace_id from RPCs
-- ============================================================

-- 1. Aktualisierte match_rag_food_chunks RPC
DROP FUNCTION IF EXISTS match_rag_food_chunks;
CREATE OR REPLACE FUNCTION match_rag_food_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
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
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    r.food_item_id,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_food_chunks r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Lexikalische Suche RPC auf food_items
DROP FUNCTION IF EXISTS search_food_items_lexical;
CREATE OR REPLACE FUNCTION search_food_items_lexical(
  search_query TEXT,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
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
  WHERE fi.search_text % search_query
  ORDER BY similarity_rank DESC
  LIMIT max_results;
END;
$$;

-- 3. Update SaaS RPC
DROP FUNCTION IF EXISTS match_rag_saas_chunks;
CREATE OR REPLACE FUNCTION match_rag_saas_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
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
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_saas_chunks r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Update Exercises RPC
DROP FUNCTION IF EXISTS match_rag_exercise_chunks;
CREATE OR REPLACE FUNCTION match_rag_exercise_chunks(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
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
    r.source_id,
    r.source_title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM rag_exercise_chunks r
  WHERE r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
