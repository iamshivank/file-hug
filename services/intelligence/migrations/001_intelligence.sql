-- File Hug — Memory Intelligence migration 001
--
-- Adds hybrid-search infrastructure to the EXISTING `memories` table:
--   * a STORED generated `search_tsv` tsvector column (title + content)
--   * a nullable `embedding vector(N)` column
--   * a GIN index for full-text search and an IVFFlat index for vector search
--
-- IMPORTANT: the vector dimension below (384) MUST match the service's
-- EMBED_DIM env var. Default 384 corresponds to the local HashingEmbedder.
-- If you switch to OpenAI (text-embedding-3-small, dim 1536), set EMBED_DIM=1536
-- AND change vector(384) -> vector(1536) here (and drop/recreate the column
-- + index), then re-run scripts/backfill_embeddings.py.
--
-- This migration is additive only. It does NOT recreate any app tables.

CREATE EXTENSION IF NOT EXISTS vector;

-- Full-text search vector (generated + stored so it stays in sync with rows).
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce(title, '') || ' ' || coalesce(content, '')
        )
    ) STORED;

-- Semantic embedding column (nullable; backfilled asynchronously).
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- GIN index for fast full-text matching.
CREATE INDEX IF NOT EXISTS idx_memories_search_tsv
    ON memories USING GIN (search_tsv);

-- IVFFlat index for cosine-distance vector search.
-- NOTE: IVFFlat requires ANALYZE / data present to be effective; `lists` is a
-- tuning knob (rule of thumb: rows/1000). Cosine ops class = vector_cosine_ops.
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
