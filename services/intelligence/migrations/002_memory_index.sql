-- File Hug — Memory Intelligence migration 002
--
-- Adds hybrid-search infrastructure to the `memory_index` table, which stores
-- what we extracted by actually opening each saved link (page title, meta
-- description, transcript, keywords…).
--
-- The TABLE ITSELF is created from the Drizzle schema (`src/db/schema.ts` →
-- `npm run db:push`). Run that FIRST, then this migration, which only adds the
-- two columns Drizzle cannot express plus their indexes.
--
-- IMPORTANT: vector(384) must match the service's EMBED_DIM env var (see the
-- same note in 001_intelligence.sql). Switching to OpenAI embeddings means
-- EMBED_DIM=1536 here and in 001, then re-running the indexer.
--
-- This migration is additive and idempotent.

CREATE EXTENSION IF NOT EXISTS vector;

-- Full-text vector over the flattened extracted text. Generated + stored so it
-- can never drift from `search_text`.
ALTER TABLE memory_index
    ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        to_tsvector(
            'english',
            coalesce(page_title, '') || ' ' ||
            coalesce(site_name, '') || ' ' ||
            coalesce(author, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(search_text, '')
        )
    ) STORED;

-- Semantic embedding of `search_text` (nullable until the link is indexed).
ALTER TABLE memory_index
    ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS idx_memory_index_search_tsv
    ON memory_index USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS idx_memory_index_embedding
    ON memory_index USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Search always filters by owner first, and the worker looks for rows to retry
-- by status, so index both.
CREATE INDEX IF NOT EXISTS idx_memory_index_user_id
    ON memory_index (user_id);

CREATE INDEX IF NOT EXISTS idx_memory_index_status
    ON memory_index (status);
