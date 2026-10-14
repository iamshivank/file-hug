-- Add provenance without deleting old vectors. Old hashing vectors must never be
-- compared with OpenAI query vectors, even if their dimensions happen to match.
ALTER TABLE memory_index ADD COLUMN IF NOT EXISTS embedding_model text;
