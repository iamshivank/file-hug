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
    """Last-resort substring search (case-insensitive).

    Covers the saved title/content AND the extracted page metadata, so a query
    that matches only the real page title still finds the memory even when
    neither FTS nor embeddings are available.

    This is the bottom of the degradation ladder, so it degrades once more on its
    own: if ``memory_index`` is missing (migrations not yet applied) it retries
    against ``memories`` alone rather than returning nothing.
    """
    pool = get_pool()
    pattern = f"%{query_text}%"
    try:
        rows = await pool.fetch(
            """
            SELECT m.id
            FROM memories m
            LEFT JOIN memory_index mi ON mi.memory_id = m.id
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
        ORDER BY embedding <=> $2::vector ASC
        LIMIT $3
        """,
        user_id,
        vec_literal,
        limit,
    )
    return [dict(r) for r in rows]


async def user_has_index_embeddings(user_id: str) -> bool:
    """True if the user has at least one indexed link with an embedding."""
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT 1 FROM memory_index
        WHERE user_id = $1 AND embedding IS NOT NULL
        LIMIT 1
        """,
        user_id,
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
        "SELECT status FROM memory_index WHERE memory_id = $1 AND user_id = $2",
        memory_id,
        user_id,
    )
    return row["status"] if row else None


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
    await pool.execute(
        """
        INSERT INTO memory_index (
            memory_id, user_id, url, status, page_title, description, site_name,
            author, image_url, favicon_url, transcript, keywords, search_text,
            error, embedding, fetched_at, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4::index_status, $5, $6, $7,
            $8, $9, $10, $11, $12::text[], $13,
            $14, $15::vector, now(), now(), now()
        )
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
            fetched_at  = now(),
            updated_at  = now()
        """,
        memory_id,
        user_id,
        url,
        status,
        page_title,
        description,
        site_name,
        author,
        image_url,
        favicon_url,
        transcript,
        keywords,
        search_text,
        error,
        vec_literal,
    )


async def set_memory_embedding_if_null(
    memory_id: str, user_id: str, embedding: list[float]
) -> None:
    """Seed ``memories.embedding`` from the richer indexed text, if still empty.

    Scoped to the owner and guarded on NULL so a dedicated backfill (or a later,
    better embedding) is never clobbered.
    """
    pool = get_pool()
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in embedding) + "]"
    await pool.execute(
        """
        UPDATE memories
        SET embedding = $3::vector
        WHERE id = $1 AND user_id = $2 AND embedding IS NULL
        """,
        memory_id,
        user_id,
        vec_literal,
    )


async def improve_memory_title(
    memory_id: str, user_id: str, new_title: str
) -> bool:
    """Replace a placeholder title with the real page title.

    Only applies when the stored title is still the hostname-derived fallback —
    i.e. the link matched no platform rule, so `tags` holds a single element.
    Platform labels like "Instagram Reel" are deliberately preserved, since they
    describe the *kind* of thing saved and users navigate by them.
    """
    pool = get_pool()
    result = await pool.execute(
        """
        UPDATE memories
        SET title = left($3, 200), updated_at = now()
        WHERE id = $1
          AND user_id = $2
          AND type = 'url'
          AND coalesce(array_length(tags, 1), 0) <= 1
        """,
        memory_id,
        user_id,
        new_title,
    )
    # asyncpg returns the command tag, e.g. "UPDATE 1" or "UPDATE 0".
    return result.split()[-1] != "0"


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


async def fetch_links_needing_index(
    user_id: str | None, batch_size: int, *, include_failed: bool = False
) -> list[dict[str, Any]]:
    """Fetch link memories that have no usable ``memory_index`` row yet.

    Covers links saved before indexing existed, plus any left in ``pending`` by a
    crash or an unreachable service. Rows previously marked ``failed`` are skipped
    unless ``include_failed`` is set, so a re-run does not keep hammering pages
    that are genuinely unreachable.

    If ``user_id`` is None, spans all users (admin/backfill use only).
    """
    pool = get_pool()
    status_filter = (
        "mi.memory_id IS NULL OR mi.status IN ('pending', 'failed')"
        if include_failed
        else "mi.memory_id IS NULL OR mi.status = 'pending'"
    )
    query = f"""
        SELECT m.id, m.content, m.title, m.tags, m.user_id
        FROM memories m
        LEFT JOIN memory_index mi ON mi.memory_id = m.id
        WHERE m.type = 'url'
          AND m.user_id IS NOT NULL
          AND ({status_filter})
          {{user_clause}}
        ORDER BY m.created_at ASC
        LIMIT {{limit_param}}
    """
    if user_id is None:
        rows = await pool.fetch(
            query.format(user_clause="", limit_param="$1"),
            batch_size,
        )
    else:
        rows = await pool.fetch(
            query.format(user_clause="AND m.user_id = $1", limit_param="$2"),
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
