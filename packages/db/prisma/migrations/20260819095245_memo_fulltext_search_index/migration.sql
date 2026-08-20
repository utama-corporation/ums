-- Enable trigram matching, used for ILIKE-style substring/typo-tolerant search fallback.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search index over memo title + memo number (search entrypoint used by GET /api/v1/search).
CREATE INDEX IF NOT EXISTS "Memo_search_fts_idx" ON "Memo" USING GIN (
  to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("memoNumber", ''))
);

-- Trigram indexes accelerate ILIKE '%term%' fallback matching on the same columns.
CREATE INDEX IF NOT EXISTS "Memo_title_trgm_idx" ON "Memo" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Memo_memoNumber_trgm_idx" ON "Memo" USING GIN ("memoNumber" gin_trgm_ops);
