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
async def has_column(table: str, column: str) -> bool:
    """Return True if ``table.column`` exists in the current database."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
        LIMIT 1
        """,
        table,
        column,
    )
    return row is not None


async def user_has_embeddings(user_id: str) -> bool:
    """Return True if the user has at least one row with a non-null embedding."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM memories WHERE user_id = $1 AND embedding IS NOT NULL LIMIT 1",
        user_id,
    )
    return row is not None


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


async def search_semantic(
    user_id: str, embedding: list[float], limit: int
) -> list[dict[str, Any]]:
    """Semantic search via pgvector cosine distance (``<=>``).

    The embedding is passed as a text literal and cast to ``vector`` so no
    pgvector codec registration is required on the asyncpg connection.
    """
    pool = get_pool()
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in embedding) + "]"
    rows = await pool.fetch(
        """
        SELECT id, (embedding <=> $2::vector) AS distance
        FROM memories
        WHERE user_id = $1
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector ASC
        LIMIT $3
        """,
        user_id,
        vec_literal,
        limit,
    )
    return [dict(r) for r in rows]


async def search_ilike(
    user_id: str, query_text: str, limit: int
) -> list[dict[str, Any]]:
    """Last-resort substring search on title/content (case-insensitive)."""
    pool = get_pool()
    pattern = f"%{query_text}%"
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
# Backfill helper (used by scripts/backfill_embeddings.py)
# ---------------------------------------------------------------------------
async def fetch_rows_needing_embedding(
    user_id: str | None, batch_size: int
) -> list[dict[str, Any]]:
    """Fetch a batch of memories with a NULL embedding.

    If ``user_id`` is None, spans all users (admin/backfill use only).
    """
    pool = get_pool()
    if user_id is None:
        rows = await pool.fetch(
            """
            SELECT id, title, content
            FROM memories
            WHERE embedding IS NULL
            ORDER BY created_at ASC
            LIMIT $1
            """,
            batch_size,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT id, title, content
            FROM memories
            WHERE embedding IS NULL AND user_id = $1
            ORDER BY created_at ASC
            LIMIT $2
            """,
            user_id,
            batch_size,
        )
    return [dict(r) for r in rows]


async def update_embedding(memory_id: str, embedding: list[float]) -> None:
    """Set the embedding for a single memory (id is a trusted internal value)."""
    pool = get_pool()
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in embedding) + "]"
    await pool.execute(
        "UPDATE memories SET embedding = $1::vector WHERE id = $2",
        vec_literal,
        memory_id,
    )
