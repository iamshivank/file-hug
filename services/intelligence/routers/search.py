"""Hybrid search over the current user's memories.

Combines two ranked signals with Reciprocal Rank Fusion (RRF, k=60):

* Full-text search (``search_tsv`` + ``plainto_tsquery`` + ``ts_rank_cd``).
* Semantic search (pgvector cosine distance against the ``embedding`` column).

Graceful degradation:
* If the user has no embeddings (or the ``embedding`` column is unavailable),
  we run FTS-only.
* If FTS returns nothing, we fall back to a case-insensitive ILIKE search.

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
    """Hybrid semantic + full-text search over the user's own memories."""
    query_text = q.strip()
    if not query_text:
        return SearchResponse(query=q, count=0, mode="fts", results=[])

    # Fetch a wider candidate pool than the final limit so fusion has material.
    pool_size = min(limit * 3, 100)

    # --- Full-text signal -------------------------------------------------
    try:
        fts_rows = await db.search_fts(user.id, query_text, pool_size)
    except Exception:
        fts_rows = []
    fts_ids = [r["id"] for r in fts_rows]

    # --- Semantic signal (only if embeddings exist for this user) ---------
    semantic_ids: list[str] = []
    semantic_available = False
    try:
        if await db.user_has_embeddings(user.id):
            semantic_available = True
            embedder = get_embedder()
            query_vec = await embedder.embed(query_text)
            sem_rows = await db.search_semantic(user.id, query_vec, pool_size)
            semantic_ids = [r["id"] for r in sem_rows]
    except Exception:
        # Missing pgvector / dimension mismatch / codec issue -> FTS-only.
        semantic_available = False
        semantic_ids = []

    # --- Determine effective mode & fuse ----------------------------------
    ranked_lists: dict[str, list[str]] = {}
    if fts_ids:
        ranked_lists["fts"] = fts_ids
    if semantic_ids:
        ranked_lists["semantic"] = semantic_ids

    mode: str
    if not ranked_lists:
        # Nothing from FTS/semantic — last-resort ILIKE fallback.
        mode = "ilike"
        try:
            ilike_rows = await db.search_ilike(user.id, query_text, limit)
        except Exception:
            ilike_rows = []
        ranked_lists["ilike"] = [r["id"] for r in ilike_rows]
    elif "semantic" in ranked_lists and semantic_available and "fts" in ranked_lists:
        mode = "hybrid"
    elif "semantic" in ranked_lists:
        mode = "hybrid" if semantic_available else "fts"
    else:
        mode = "fts"

    fused = _rrf_fuse(ranked_lists)
    if not fused:
        return SearchResponse(query=query_text, count=0, mode=mode, results=[])

    # Order by fused score, take the top `limit`.
    ordered_ids = sorted(fused.items(), key=lambda kv: kv[1][0], reverse=True)
    top = ordered_ids[:limit]
    top_ids = [mem_id for mem_id, _ in top]

    # Fetch full rows (scoped to the user) and assemble results in fused order.
    rows_by_id = await db.fetch_memories_by_ids(user.id, top_ids)

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
            )
        )

    return SearchResponse(
        query=query_text,
        count=len(results),
        mode=mode,
        results=results,
    )
