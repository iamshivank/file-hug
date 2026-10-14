# File Hug intelligence service

See [AI setup](../../AI_SETUP.md) for the authoritative setup, API key location,
migrations, backfill, verification and deployment instructions.

FastAPI provides authenticated `/index`, `/search`, `/extract` and
`/dashboard/summary` endpoints; `/health` is a public liveness check.
Next.js forwards the signed user session. All retrieval and indexing queries
are scoped to that user.

`/index` extracts public page content, generates a grounded summary, topical tags
and retrieval intents, then stores the context and an OpenAI embedding.
`/search` retrieves semantic and keyword candidates and uses AI relevance judgments
to filter and order them. Responses report `mode`, `used_link_index` and an optional
`notice` explaining degraded behavior.

The API key is loaded from the project root `.env.local` or service environment.
No API key means keyword-only search. The historical hashing embedder is kept only
for compatibility with offline utilities; live search never calls it semantic AI.
