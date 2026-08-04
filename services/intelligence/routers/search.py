"""Hybrid search over the current user's memories.

Fuses up to four ranked signals with Reciprocal Rank Fusion (RRF, k=60):

* ``fts`` — full-text over what the user saved (``memories.search_tsv``).
* ``semantic`` — pgvector cosine distance over ``memories.embedding``.
* ``index_fts`` — full-text over content extracted from the link itself
  (``memory_index.search_tsv``: real page title, description, body text,
  transcript, keywords).
* ``index_semantic`` — pgvector over ``memory_index.embedding``.

The two index signals are what let "that article about pricing tiers" find a
saved link whose URL and platform label say nothing about pricing. A memory
ranked by several signals scores higher than one ranked by a single signal, which
is exactly the desired bias: matching both the URL and the page content is
stronger evidence than matching either alone.

Graceful degradation, in order:
* No embeddings for the user (or no pgvector) → full-text signals only.
* Link index empty or absent (migration 002 not run) → saved-content signals only.
* Nothing from any full-text/semantic signal → case-insensitive ILIKE fallback,
  which also covers the extracted metadata.

Every query is scoped to ``user_id`` in its SQL ``WHERE`` clause.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

import db
from auth import SessionUser, get_current_user
from embeddings import get_embedder
from schemas import SearchResponse, SearchResult

router = APIRouter()

_RRF_K = 60

#: Signals sourced from the extracted link index rather than the saved memory.
_INDEX_SIGNALS = frozenset({"index_fts", "index_semantic"})


def _rrf_fuse(
    ranked_lists: dict[str, list[str]], k: int = _RRF_K
) -> dict[str, tuple[float, list[str]]]:
    """Fuse multiple ranked id-lists via Reciprocal Rank Fusion.

    Returns ``id -> (score, matched_signals)`` where ``score`` is the summed
    RRF contribution and ``matched_signals`` lists the signals that ranked it.
    """
    fused: dict[str, tuple[float, list[str]]] = {}
    for signal, ids in ranked_lists.items():
        for rank, mem_id in enumerate(ids):
            contribution = 1.0 / (k + rank + 1)  # rank is 0-based
            prev_score, prev_signals = fused.get(mem_id, (0.0, []))
            fused[mem_id] = (prev_score + contribution, prev_signals + [signal])
    return fused


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Natural language query."),
    limit: int = Query(20, ge=1, le=100),
    user: SessionUser = Depends(get_current_user),
) -> SearchResponse:
    """Hybrid search over the user's memories and their extracted link content."""
    query_text = q.strip()
    if not query_text:
        return SearchResponse(query=q, count=0, mode="fts", results=[])

    # Fetch a wider candidate pool than the final limit so fusion has material.
    pool_size = min(limit * 3, 100)

    ranked_lists: dict[str, list[str]] = {}

    # --- Full-text over saved title + content -----------------------------
    try:
        fts_rows = await db.search_fts(user.id, query_text, pool_size)
    except Exception:
        fts_rows = []
    if fts_rows:
        ranked_lists["fts"] = [r["id"] for r in fts_rows]

    # --- Full-text over extracted link content ----------------------------
    try:
        index_fts_rows = await db.search_index_fts(user.id, query_text, pool_size)
    except Exception:
        # memory_index / its tsvector may not exist yet (migration 002 pending).
        index_fts_rows = []
    if index_fts_rows:
        ranked_lists["index_fts"] = [r["id"] for r in index_fts_rows]

    # --- Semantic signals (only worth embedding the query if vectors exist) ---
    try:
        has_memory_vectors = await db.user_has_embeddings(user.id)
    except Exception:
        has_memory_vectors = False
    try:
        has_index_vectors = await db.user_has_index_embeddings(user.id)
    except Exception:
        has_index_vectors = False

    if has_memory_vectors or has_index_vectors:
        try:
            embedder = get_embedder()
            query_vec = await embedder.embed(query_text)
        except Exception:
            query_vec = None

        if query_vec is not None:
            if has_memory_vectors:
                try:
                    sem_rows = await db.search_semantic(user.id, query_vec, pool_size)
                    if sem_rows:
                        ranked_lists["semantic"] = [r["id"] for r in sem_rows]
                except Exception:
                    # Missing pgvector / dimension mismatch / codec issue.
                    pass
            if has_index_vectors:
                try:
                    idx_rows = await db.search_index_semantic(
                        user.id, query_vec, pool_size
                    )
                    if idx_rows:
                        ranked_lists["index_semantic"] = [r["id"] for r in idx_rows]
                except Exception:
                    pass

    # --- Determine effective mode & fuse ----------------------------------
    mode: str
    if not ranked_lists:
        # Nothing from any ranked signal — last-resort ILIKE fallback.
        mode = "ilike"
        try:
            ilike_rows = await db.search_ilike(user.id, query_text, limit)
        except Exception:
            ilike_rows = []
        ranked_lists["ilike"] = [r["id"] for r in ilike_rows]
    elif len(ranked_lists) > 1:
        mode = "hybrid"
    elif "semantic" in ranked_lists or "index_semantic" in ranked_lists:
        mode = "semantic"
    else:
        mode = "fts"

    used_link_index = any(signal in _INDEX_SIGNALS for signal in ranked_lists)

    fused = _rrf_fuse(ranked_lists)
    if not fused:
        return SearchResponse(
            query=query_text,
            count=0,
            mode=mode,
            used_link_index=used_link_index,
            results=[],
        )

    # Order by fused score, take the top `limit`.
    ordered_ids = sorted(fused.items(), key=lambda kv: kv[1][0], reverse=True)
    top = ordered_ids[:limit]
    top_ids = [mem_id for mem_id, _ in top]

    # Fetch full rows (scoped to the user) and assemble results in fused order.
    rows_by_id = await db.fetch_memories_by_ids(user.id, top_ids)
    try:
        snippets = await db.fetch_index_snippets(user.id, top_ids)
    except Exception:
        snippets = {}

    results: list[SearchResult] = []
    for mem_id, (score, matched) in top:
        row = rows_by_id.get(mem_id)
        if row is None:
            continue  # row not owned / deleted between queries
        results.append(
            SearchResult(
                id=row["id"],
                title=row["title"],
                content=row["content"],
                type=row["type"],
                tags=list(row["tags"] or []),
                created_at=row["created_at"],
                score=round(score, 6),
                matched=matched,
                snippet=snippets.get(mem_id),
            )
        )

    return SearchResponse(
        query=query_text,
        count=len(results),
        mode=mode,
        used_link_index=used_link_index,
        results=results,
    )
