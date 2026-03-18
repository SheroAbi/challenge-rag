-- ================================================================
-- Migration 006: Runtime Alignment
-- Idempotente Ergänzungen für den aktuellen Codebase-Stand.
-- Bestehende Daten bleiben unangetastet.
-- ================================================================

-- 1. pg_trgm Extension für lexikalische Suche (food_items trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. import_runs – wird von /api/knowledge/upload genutzt
CREATE TABLE IF NOT EXISTS import_runs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name     text NOT NULL,
  file_hash     text,
  parser_type   text NOT NULL,
  dataset_type  text NOT NULL,
  status        text NOT NULL DEFAULT 'processing',
  total_records integer DEFAULT 0,
  processed     integer DEFAULT 0,
  deduplicated  integer DEFAULT 0,
  skipped       integer DEFAULT 0,
  errors        integer DEFAULT 0,
  error_summary text,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- 3. import_errors – Fehlerlog pro Import-Run
CREATE TABLE IF NOT EXISTS import_errors (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id      uuid REFERENCES import_runs(id) ON DELETE CASCADE,
  record_ref  text,
  error_code  text,
  raw_preview text,
  created_at  timestamptz DEFAULT now()
);

-- 4. get_rag_tables() – RPC für /api/knowledge/tables
CREATE OR REPLACE FUNCTION get_rag_tables()
RETURNS TABLE (table_name text, row_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::text,
    (
      SELECT reltuples::bigint
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t.table_name
        AND n.nspname = 'public'
    ) AS row_count
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name LIKE 'rag\_%\_chunks'
  ORDER BY t.table_name;
END;
$$;
