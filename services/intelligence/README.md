# File Hug — Memory Intelligence Service

A standalone **Python / FastAPI** microservice that provides the "memory
intelligence" layer for File Hug:

- **Async URL extraction** — OpenGraph / Twitter / `<title>` / meta-description
  parsing, plus YouTube transcript retrieval.
- **Hybrid search** — pgvector semantic search + PostgreSQL full-text search,
  fused with Reciprocal Rank Fusion (RRF).
- **Dashboard summary** — per-user aggregate stats.

It shares the **same Neon PostgreSQL database** as the Next.js app and connects
via `asyncpg`. It does not own or recreate the app's tables — a single additive
migration adds a full-text column, an embedding column, and their indexes.

---

## Requirements

- Python 3.11+
- Access to the shared Neon PostgreSQL database (`DATABASE_URL`)
- The `vector` (pgvector) extension available on the database

---

## Setup

```bash
cd services/intelligence

# 1. Create and activate a virtualenv
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# then edit .env — at minimum set DATABASE_URL and AUTH_SECRET

# 4. Run the migration (adds search_tsv + embedding columns and indexes)
psql "$DATABASE_URL" -f migrations/001_intelligence.sql

# 5. Run the service
uvicorn main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### Backfilling embeddings (optional)

Search works immediately (full-text only) with no embeddings. To enable the
semantic signal, populate the `embedding` column:

```bash
python scripts/backfill_embeddings.py            # all users
python scripts/backfill_embeddings.py --user u_1  # one user
```

The default embedder is a deterministic, offline `HashingEmbedder` (dim 384) so
this runs with **no API key**. Set `OPENAI_API_KEY` (and `EMBED_DIM=1536`, plus
`vector(1536)` in the migration) to use OpenAI embeddings instead.

---

## Environment variables

| Variable         | Required | Default                              | Description |
| ---------------- | -------- | ------------------------------------ | ----------- |
| `DATABASE_URL`   | Yes      | `postgresql://localhost:5432/filehug`| Shared Neon Postgres URL. A `?sslmode=require` suffix is handled automatically. |
| `AUTH_SECRET`    | Yes*     | `file-hug-dev-secret-change-me`      | HMAC key for verifying the `fh_session` token. **Must match the Next.js app.** |
| `OPENAI_API_KEY` | No       | _(unset)_                            | Enables OpenAI embeddings when present. |
| `EMBED_DIM`      | No       | `384`                                | Active embedding dimension. Must match `vector(N)` in the migration. |
| `ALLOWED_ORIGIN` | No       | `http://localhost:3000`              | CORS origin for the Next.js frontend. |

\* Defaults to the dev secret; set explicitly in any shared/production environment.

---

## Authentication

Every data endpoint requires a valid File Hug session. The token is read from
either the `fh_session` cookie or an `Authorization: Bearer <token>` header, and
its HMAC-SHA256 signature is verified in constant time. **All queries are scoped
to the authenticated `user_id`** — no endpoint can read or mutate another user's
memories.

---

## Endpoint reference

| Method | Path                     | Auth | Description |
| ------ | ------------------------ | ---- | ----------- |
| GET    | `/health`                | No   | Liveness probe → `{"status":"ok"}`. |
| POST   | `/extract`               | Yes  | Body `{ "url": "..." }`. Returns `{title, description, image, site_name, favicon, transcript, error}`. Always 200 (fetch errors surface in `error`). |
| GET    | `/search?q=...&limit=20` | Yes  | Hybrid search over the user's memories. Returns ranked `results` with `score` and matched signals, plus effective `mode` (`hybrid`/`fts`/`ilike`). |
| GET    | `/dashboard/summary`     | Yes  | Per-user totals, link/note counts, connected count, top platforms, recent activity, and 7-day saves. |

### Graceful degradation

- `/extract` never returns 5xx for a fetch failure — it returns partial data
  with an `error` field.
- `/search` falls back to FTS-only when no embeddings exist, and to `ILIKE`
  when FTS finds nothing. It works before any embeddings are backfilled and
  even if pgvector is unavailable.

---

## Next.js integration

The Next.js app proxies `/api/intelligence/*` to this service, **stripping the
`/api/intelligence` prefix** (so `/api/intelligence/search` → `/search` here).
The proxy forwards the user's session by reading the `fh_session` cookie and
sending it as `Authorization: Bearer <token>`.

The Next.js side reads the service base URL from `INTELLIGENCE_SERVICE_URL`
(e.g. `http://localhost:8000`). That proxy route and env documentation are
handled separately from this service.
```

Example proxy flow:

```
Browser → Next.js /api/intelligence/search?q=...
        → (reads fh_session cookie, forwards as Bearer)
        → INTELLIGENCE_SERVICE_URL + /search?q=...
        → this service (verifies token, scopes to user_id)
```
