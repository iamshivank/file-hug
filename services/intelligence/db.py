"""Database access layer (asyncpg).

Owns the connection pool lifecycle and provides small, parameterized query
helpers. EVERY helper that touches user data takes a ``user_id`` and scopes its
``WHERE`` clause to it — no query ever returns or mutates another user's rows.

Neon requires TLS. The ``DATABASE_URL`` may carry a ``?sslmode=...`` query
parameter (understood by libpq / @neondatabase/serverless but not by asyncpg's
DSN parser), so we strip it and translate it into asyncpg's ``ssl`` argument.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

import asyncpg

from config import get_settings
from embeddings import embedding_model

_pool: asyncpg.Pool | None = None

# libpq sslmode -> asyncpg ssl argument.
_SSLMODE_MAP = {
    "disable": False,
    "allow": "prefer",
    "prefer": "prefer",
    "require": "require",
    "verify-ca": "verify-ca",
    "verify-full": "verify-full",
}

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", ""}


def _prepare_dsn(database_url: str) -> tuple[str, Any]:
    """Return ``(clean_dsn, ssl_arg)``.

    Strips ``sslmode`` (and asyncpg-unsupported libpq-only params) from the URL
    query and derives the asyncpg ``ssl`` argument. Remote hosts default to
    TLS-required; local hosts default to no TLS.
    """
    parts = urlsplit(database_url)
    query = parse_qs(parts.query)

    sslmode = query.pop("sslmode", [None])[0]
    # channel_binding is a libpq-only hint asyncpg does not accept in the DSN.
    query.pop("channel_binding", None)

    clean_query = urlencode({k: v[0] for k, v in query.items()})
    clean_dsn = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, clean_query, parts.fragment)
    )

    if sslmode is not None:
        ssl_arg: Any = _SSLMODE_MAP.get(sslmode, "require")
    else:
        host = (parts.hostname or "").lower()
        ssl_arg = False if host in _LOCAL_HOSTS else "require"

    return clean_dsn, ssl_arg


async def init_pool() -> asyncpg.Pool:
    """Create the global connection pool (idempotent)."""
    global _pool
    if _pool is not None:
        return _pool

    settings = get_settings()
    dsn, ssl_arg = _prepare_dsn(settings.DATABASE_URL)
    _pool = await asyncpg.create_pool(dsn=dsn, ssl=ssl_arg, min_size=1, max_size=10)
    return _pool


async def close_pool() -> None:
    """Close the global connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the initialized pool or raise if the lifespan did not run."""
    if _pool is None:
        raise RuntimeError("Database pool is not initialized")
    return _pool


# ---------------------------------------------------------------------------
# Capability probes (graceful degradation)
# ---------------------------------------------------------------------------
async def embedding_column_dim(table: str) -> int | None:
    """Declared dimension of ``table.embedding`` (pgvector stores it as typmod).

    None when the table/column is missing or the column has no fixed dimension.
    """
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT a.atttypmod AS dim
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass($1)
          AND a.attname = 'embedding'
          AND NOT a.attisdropped
        """,
        table,
    )
    if row is None or row["dim"] is None or row["dim"] <= 0:
        return None
    return int(row["dim"])


# ---------------------------------------------------------------------------
# Search helpers — all scoped by user_id
# ---------------------------------------------------------------------------
async def search_fts(user_id: str, query_text: str, limit: int) -> list[dict[str, Any]]:
    """Full-text search over the generated ``search_tsv`` column.

    Returns rows ordered by descending ``ts_rank_cd``. Uses ``plainto_tsquery``.
    """
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, ts_rank_cd(search_tsv, plainto_tsquery('english', $2)) AS rank
        FROM memories
        WHERE user_id = $1
          AND search_tsv @@ plainto_tsquery('english', $2)
        ORDER BY rank DESC
        LIMIT $3
        """,
        user_id,
        query_text,
        limit,
    )
    return [dict(r) for r in rows]


async def search_ilike(
    user_id: str, query_text: str, limit: int
) -> list[dict[str, Any]]:
    """Last-resort substring search (case-insensitive).

    Covers the saved title/content AND the extracted page metadata, so a query
    that matches only the real page title still finds the memory even when
    neither FTS nor embeddings are available.

    This is the bottom of the degradation ladder, so it degrades once more on its
    own: if ``memory_index`` is missing (migrations not yet applied) it retries
    against ``memories`` alone rather than returning nothing.
    """
    pool = get_pool()
    # Escape LIKE metacharacters so "100%" or "my_file" match literally
    # (backslash is Postgres' default LIKE escape character).
    escaped = (
        query_text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    )
    pattern = f"%{escaped}%"
    try:
        rows = await pool.fetch(
            """
            SELECT m.id
            FROM memories m
            LEFT JOIN memory_index mi ON mi.memory_id = m.id AND mi.user_id = $1
            WHERE m.user_id = $1
              AND (
                m.title ILIKE $2
                OR m.content ILIKE $2
                OR mi.page_title ILIKE $2
                OR mi.description ILIKE $2
                OR mi.site_name ILIKE $2
                OR mi.search_text ILIKE $2
              )
            ORDER BY m.updated_at DESC
            LIMIT $3
            """,
            user_id,
            pattern,
            limit,
        )
    except asyncpg.PostgresError:
        rows = await pool.fetch(
            """
            SELECT id
            FROM memories
            WHERE user_id = $1
              AND (title ILIKE $2 OR content ILIKE $2)
            ORDER BY updated_at DESC
            LIMIT $3
            """,
            user_id,
            pattern,
            limit,
        )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Link-index search helpers — matching against extracted page content
# ---------------------------------------------------------------------------
async def search_index_fts(
    user_id: str, query_text: str, limit: int
) -> list[dict[str, Any]]:
    """Full-text search over what we extracted by opening each saved link.

    Returns ``memory_id`` aliased to ``id`` so results fuse directly with the
    other signals.
    """
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT memory_id AS id,
               ts_rank_cd(search_tsv, plainto_tsquery('english', $2)) AS rank
        FROM memory_index
        WHERE user_id = $1
          AND search_tsv @@ plainto_tsquery('english', $2)
        ORDER BY rank DESC
        LIMIT $3
        """,
        user_id,
        query_text,
        limit,
    )
    return [dict(r) for r in rows]


async def search_index_semantic(
    user_id: str, embedding: list[float], limit: int
) -> list[dict[str, Any]]:
    """Semantic search over indexed link content via pgvector cosine distance."""
    pool = get_pool()
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in embedding) + "]"
    rows = await pool.fetch(
        """
        SELECT memory_id AS id, (embedding <=> $2::vector) AS distance
        FROM memory_index
        WHERE user_id = $1
          AND embedding IS NOT NULL
          AND embedding_model = $4
        ORDER BY (embedding <=> $2::vector) + 0 ASC
        LIMIT $3
        """,
        user_id,
        vec_literal,
        limit,
        embedding_model(),
    )
    return [dict(r) for r in rows]


async def user_has_index_embeddings(user_id: str) -> bool:
    """True if the user has at least one indexed link with an embedding."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT 1 FROM memory_index
        WHERE user_id = $1 AND embedding IS NOT NULL AND embedding_model = $2
        LIMIT 1
        """,
        user_id,
        embedding_model(),
    )
    return row is not None


async def fetch_index_snippets(
    user_id: str, ids: list[str], length: int = 220
) -> dict[str, str]:
    """Return ``memory_id -> short excerpt`` for the given memories.

    Prefers the page's own description, falling back to the head of the extracted
    body text. Used to show *why* a result matched.
    """
    if not ids:
        return {}
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT memory_id,
               coalesce(nullif(description, ''), left(coalesce(search_text, ''), $3)) AS snippet
        FROM memory_index
        WHERE user_id = $1 AND memory_id = ANY($2::text[])
        """,
        user_id,
        ids,
        length,
    )
    return {r["memory_id"]: r["snippet"] for r in rows if r["snippet"]}


# ---------------------------------------------------------------------------
# Link-index writes — owned by the /index endpoint
# ---------------------------------------------------------------------------
async def fetch_memory_for_index(
    memory_id: str, user_id: str
) -> dict[str, Any] | None:
    """Fetch the memory to index, scoped to its owner. None when not found."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, content, type, title, tags
        FROM memories
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        """,
        memory_id,
        user_id,
    )
    return dict(row) if row else None


async def index_status(memory_id: str, user_id: str) -> str | None:
    """Return the current index status for a memory, or None when unindexed."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT status FROM memory_index WHERE memory_id = $1 AND user_id = $2 AND embedding_model = $3",
        memory_id,
        user_id,
        embedding_model(),
    )
    return row["status"] if row else None


def _strip_nul(value: str | None) -> str | None:
    return value.replace("\x00", "") if value else value


async def upsert_memory_index(
    *,
    memory_id: str,
    user_id: str,
    url: str,
    status: str,
    page_title: str | None,
    description: str | None,
    site_name: str | None,
    author: str | None,
    image_url: str | None,
    favicon_url: str | None,
    transcript: str | None,
    keywords: list[str],
    search_text: str | None,
    error: str | None,
    embedding: list[float] | None,
    source_url: str | None = None,
) -> None:
    """Insert or replace the index row for a memory.

    ``memory_id`` is the primary key, so re-indexing a link overwrites its
    previous result rather than accumulating rows. ``embedding`` is written as a
    text literal cast to ``vector`` so no pgvector codec registration is needed.
    """
    pool = get_pool()
    vec_literal = (
        "[" + ",".join(f"{v:.6f}" for v in embedding) + "]" if embedding else None
    )
    # Postgres text cannot hold NUL; scraped pages and transcripts sometimes do,
    # and one stray \x00 would otherwise fail the whole write.
    clean = _strip_nul
    await pool.execute(
        """
        INSERT INTO memory_index (
            memory_id, user_id, url, status, page_title, description, site_name,
            author, image_url, favicon_url, transcript, keywords, search_text,
            error, embedding, embedding_model, fetched_at, created_at, updated_at
        ) SELECT
            $1, $2, $3, $4::index_status, $5, $6, $7,
            $8, $9, $10, $11, $12::text[], $13,
            $14, $15::vector, $16, now(), now(), now()
        WHERE EXISTS (SELECT 1 FROM memories m WHERE m.id = $1 AND m.user_id = $2
                      AND ($17::text IS NULL OR m.content = $17))
        ON CONFLICT (memory_id) DO UPDATE SET
            user_id     = EXCLUDED.user_id,
            url         = EXCLUDED.url,
            status      = EXCLUDED.status,
            page_title  = EXCLUDED.page_title,
            description = EXCLUDED.description,
            site_name   = EXCLUDED.site_name,
            author      = EXCLUDED.author,
            image_url   = EXCLUDED.image_url,
            favicon_url = EXCLUDED.favicon_url,
            transcript  = EXCLUDED.transcript,
            keywords    = EXCLUDED.keywords,
            search_text = EXCLUDED.search_text,
            error       = EXCLUDED.error,
            embedding   = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            fetched_at  = now(),
            updated_at  = now()
        """,
        memory_id,
        user_id,
        clean(url),
        status,
        clean(page_title),
        clean(description),
        clean(site_name),
        clean(author),
        clean(image_url),
        clean(favicon_url),
        clean(transcript),
        [clean(k) for k in keywords],
        clean(search_text),
        clean(error),
        vec_literal,
        embedding_model() if embedding else None,
        source_url,
    )


async def fetch_memories_by_ids(
    user_id: str, ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Fetch full memory rows for the given ids, scoped to the user.

    Returns a mapping of ``id -> row`` (rows belonging to other users are never
    returned because of the ``user_id`` filter).
    """
    if not ids:
        return {}
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, title, content, type, tags, created_at
        FROM memories
        WHERE user_id = $1 AND id = ANY($2::text[])
        """,
        user_id,
        ids,
    )
    return {r["id"]: dict(r) for r in rows}


# ---------------------------------------------------------------------------
# Dashboard helpers — all scoped by user_id
# ---------------------------------------------------------------------------
async def dashboard_counts(user_id: str) -> dict[str, int]:
    """Return total, links, notes, and connected counts for the user."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*)                                            AS total,
            COUNT(*) FILTER (WHERE type = 'url')                AS links,
            COUNT(*) FILTER (WHERE type = 'note')               AS notes,
            COUNT(*) FILTER (WHERE array_length(linked_memory_ids, 1) > 0)
                                                                AS connected
        FROM memories
        WHERE user_id = $1
        """,
        user_id,
    )
    return {
        "total": row["total"] or 0,
        "links": row["links"] or 0,
        "notes": row["notes"] or 0,
        "connected": row["connected"] or 0,
    }


async def dashboard_top_platforms(
    user_id: str, limit: int = 5
) -> list[dict[str, Any]]:
    """Top platforms derived from ``tags[0]`` of the user's url memories."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT tags[1] AS platform, COUNT(*) AS count
        FROM memories
        WHERE user_id = $1
          AND type = 'url'
          AND array_length(tags, 1) > 0
        GROUP BY tags[1]
        ORDER BY count DESC, platform ASC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    return [{"platform": r["platform"], "count": r["count"]} for r in rows]


async def dashboard_recent(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    """Most recent memories for the user."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT id, title, type, created_at
        FROM memories
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    return [dict(r) for r in rows]


async def dashboard_recent_saves(user_id: str, days: int = 7) -> int:
    """Count of memories created in the last ``days`` days for the user."""
    pool = get_pool()
    since = datetime.now(timezone.utc) - timedelta(days=days)
    row = await pool.fetchrow(
        "SELECT COUNT(*) AS n FROM memories WHERE user_id = $1 AND created_at >= $2",
        user_id,
        since,
    )
    return row["n"] or 0


# ---------------------------------------------------------------------------
# Backfill helper (used by scripts/backfill_link_index.py)
# ---------------------------------------------------------------------------
async def fetch_links_needing_index(
    user_id: str | None, batch_size: int, *, include_failed: bool = False,
    exclude_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Admin backfill, keyset exclusions ensure every eligible link is attempted once."""
    rows = await get_pool().fetch(
        """
        SELECT m.id, m.content, m.title, m.tags, m.user_id
        FROM memories m LEFT JOIN memory_index mi ON mi.memory_id = m.id
        WHERE m.type = 'url' AND m.user_id IS NOT NULL
          AND ($1::text IS NULL OR m.user_id = $1)
          AND NOT (m.id = ANY($2::text[]))
          AND (mi.memory_id IS NULL OR mi.status = 'pending'
               OR ($3 AND mi.status = 'failed')
               OR (mi.status = 'ready' AND mi.embedding_model IS DISTINCT FROM $4))
        ORDER BY m.created_at, m.id LIMIT $5
        """, user_id, exclude_ids or [], include_failed, embedding_model(), batch_size)
    return [dict(row) for row in rows]
