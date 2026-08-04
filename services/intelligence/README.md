# File Hug — Memory Intelligence Service

A standalone **Python / FastAPI** microservice that provides the "memory
intelligence" layer for File Hug:

- **Async URL extraction** — OpenGraph / Twitter / `<title>` / meta-description
  parsing, **page body text**, plus YouTube transcript retrieval.
- **Link indexing** — opens each saved link and stores what it found in
  `memory_index`, so search can match words that appear *inside* a page rather
  than only in its URL.
- **Hybrid search** — pgvector semantic search + PostgreSQL full-text search over
  both the saved memory and the extracted link content, fused with Reciprocal
  Rank Fusion (RRF).
- **Dashboard summary** — per-user aggregate stats.

It shares the **same Neon PostgreSQL database** as the Next.js app and connects
via `asyncpg`. It does not own or recreate the app's tables: `memories` and
`memory_index` are both created from the Drizzle schema (`npm run db:push`), and
the migrations here are additive, adding only the full-text and vector columns
Drizzle cannot express, plus their indexes.

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

# 4. Create the tables from the Drizzle schema FIRST (run from the repo root).
#    This creates `memory_index`, which migration 002 then extends.
#    cd ../.. && npm run db:push

# 5. Run the migrations (add search_tsv + embedding columns and their indexes)
psql "$DATABASE_URL" -f migrations/001_intelligence.sql
psql "$DATABASE_URL" -f migrations/002_memory_index.sql

# 6. Run the service
uvicorn main:app --reload --port 8000
```

> **Order matters.** `db:push` before the migrations, since 002 alters a table
> Drizzle creates. And if `drizzle-kit push` ever offers to drop `search_tsv`,
> `embedding`, or their indexes, answer **no** — it does not know about columns
> added outside the Drizzle schema.

Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### Backfilling the link index (for existing links)

Links saved from now on are indexed automatically. Links saved *before* indexing
existed have no `memory_index` row, so search can only match their titles. This
reads them:

```bash
python scripts/backfill_link_index.py                  # all users
python scripts/backfill_link_index.py --user u_1       # one user
python scripts/backfill_link_index.py --retry-failed   # re-attempt failures once
```

It makes real HTTP requests to third-party sites, so concurrency defaults to a
polite 4 (`--concurrency` to change). Also picks up anything stuck in `pending`
because the service was down when a link was saved.

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
| POST   | `/extract`               | Yes  | Body `{ "url": "..." }`. Returns `{final_url, title, description, image, site_name, favicon, author, keywords, text, transcript, error}` without persisting anything. Always 200 (fetch errors surface in `error`). |
| POST   | `/index`                 | Yes  | Body `{ "memory_id": "...", "force": false }`. Opens that memory's link, extracts it, embeds it, and upserts one `memory_index` row. Returns `status` (`ready`/`failed`/`skipped`) and a summary of what was stored. |
| GET    | `/search?q=...&limit=20` | Yes  | Hybrid search over the user's memories **and** their indexed link content. Returns ranked `results` with `score`, matched signals and a `snippet`, plus the effective `mode` and `used_link_index`. |
| GET    | `/dashboard/summary`     | Yes  | Per-user totals, link/note counts, connected count, top platforms, recent activity, and 7-day saves. |

### How indexing fits together

```
User saves a link
  → Next.js POST /api/memories               (stores it, status = 'pending')
  → after() → POST /index                    (this service, background)
      → fetch the URL, parse metadata + body text (+ transcript)
      → embed the result
      → upsert memory_index                  (status = 'ready' | 'failed')
  → the UI polls /api/memories until it is no longer 'pending'
```

`/index` is idempotent: it skips a memory that already has a `ready` row unless
`force` is set. A link that fails still gets a row (with `status='failed'` and the
reason), so the UI can show what happened and offer a retry instead of the link
looking permanently un-indexed.

### Search signals

`/search` fuses up to four ranked lists with RRF, so a memory matched by several
signals outranks one matched by a single signal:

| Signal           | Source |
| ---------------- | ------ |
| `fts`            | `memories.search_tsv` — what the user saved (title + content) |
| `semantic`       | `memories.embedding` |
| `index_fts`      | `memory_index.search_tsv` — real page title, description, body text, transcript, keywords |
| `index_semantic` | `memory_index.embedding` |

### Graceful degradation

- `/extract` and `/index` never return 5xx for a fetch failure — they return
  partial data with an `error` field.
- `/search` drops the semantic signals when the user has no embeddings (or
  pgvector is unavailable), drops the `index_*` signals when the link index is
  empty or missing (migration 002 not yet run), and falls back to `ILIKE` when no
  ranked signal produced anything. It works before any embeddings are backfilled.
- `/index` still stores the extracted text when embedding fails, so full-text
  search keeps working without a vector.

---

## Deploying

This is a **persistent ASGI process**, so it cannot run on Vercel next to the
Next.js app — it needs a container/VM host: Railway, Render, Fly.io, Google Cloud
Run, or any box running the included `Dockerfile`.

```bash
docker build -t filehug-intelligence services/intelligence
docker run -p 8000:8000 --env-file services/intelligence/.env filehug-intelligence
```

Set on the service:

| Variable         | Value |
| ---------------- | ----- |
| `DATABASE_URL`   | The **same** Neon database as the Next.js app |
| `AUTH_SECRET`    | The **same** secret as the Next.js app, or every request 401s |
| `ALLOWED_ORIGIN` | Your production origin, e.g. `https://filehug.app` |

Then set `INTELLIGENCE_SERVICE_URL` on the **Next.js** side to this service's
public URL. Until you do, the app treats link intelligence as switched off and
behaves exactly as it did before the feature existed — links save, search falls
back to local filtering, no errors are shown.

Finally, run `scripts/backfill_link_index.py` once to index links saved before the
service existed.

### Health & sizing

- `GET /health` needs no auth — point your platform's health check at it.
- One worker holds one asyncpg pool (`max_size=10`). Scale workers/replicas with
  your Postgres connection limit in mind; on Neon, prefer the pooled connection
  string if you run several replicas.
- The default embedder is offline and CPU-only, so a small instance is fine.
  `OPENAI_API_KEY` swaps in API-backed embeddings (and requires `EMBED_DIM=1536`
  plus a matching `vector(1536)` column).

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

`/index` is called by the Next.js **server** rather than the browser (see
`src/features/memories/services/IntelligenceClient.ts`), which forwards the same
session token directly.

> **Session tokens must carry `exp`.** `auth.py` rejects any payload without a
> live `exp` claim. The Next.js signer (`src/features/auth/session.ts`) adds one;
> if you ever change that signer, keep the claim or every call here will 401.
