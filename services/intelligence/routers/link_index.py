"""Build the searchable index for a saved link.

``POST /index`` is the write side of link intelligence: given a memory id, it
opens that memory's URL, extracts everything it can (title, description, author,
keywords, body text, transcript), embeds the result, and upserts one row into
``memory_index``. ``GET /search`` then matches against that row, so a query can
hit words that appear *inside* the page rather than only in the URL.

Ownership: the memory is loaded with a ``user_id`` filter, so a caller can only
index links they own, and the index row inherits that ``user_id``.

Failure handling: a page that cannot be fetched still gets a row — with
``status='failed'`` and the reason in ``error`` — so the UI can show what
happened and offer a retry instead of silently looking un-indexed forever.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status as http_status

import db
from auth import SessionUser, get_current_user
from embeddings import get_embedder
from extraction import build_search_text, fetch_page
from schemas import IndexRequest, IndexResponse

router = APIRouter()


@router.post("/index", response_model=IndexResponse)
async def index_memory(
    body: IndexRequest,
    user: SessionUser = Depends(get_current_user),
) -> IndexResponse:
    """Fetch a saved link, extract its content, and store it for search."""
    memory = await db.fetch_memory_for_index(body.memory_id, user.id)
    if memory is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Memory not found"
        )

    if memory["type"] != "url":
        # Notes carry their own text already — there is nothing to open.
        return IndexResponse(
            memory_id=body.memory_id, status="skipped", error="Not a link memory"
        )

    if not body.force:
        existing = await db.index_status(body.memory_id, user.id)
        if existing == "ready":
            return IndexResponse(memory_id=body.memory_id, status="skipped")

    url = memory["content"]
    page = await fetch_page(url)

    # The platform label ("Instagram Reel") and tags are worth indexing too, so a
    # search for "reel" matches on the extracted row as well as the saved title.
    extra = [memory.get("title") or "", " ".join(memory.get("tags") or [])]
    search_text = build_search_text(page, extra=[value for value in extra if value])

    # A row counts as ready when it yielded *something* searchable. A fetch error
    # alongside a usable transcript is still a win.
    row_status = "ready" if search_text else "failed"

    embedding: list[float] | None = None
    if search_text:
        try:
            embedder = get_embedder()
            embedding = await embedder.embed(search_text)
        except Exception:
            # No embedder (or an API failure) must not lose the extracted text —
            # full-text search still works without a vector.
            embedding = None

    await db.upsert_memory_index(
        memory_id=body.memory_id,
        user_id=user.id,
        url=page.final_url or url,
        status=row_status,
        page_title=page.title,
        description=page.description,
        site_name=page.site_name,
        author=page.author,
        image_url=page.image,
        favicon_url=page.favicon,
        transcript=page.transcript,
        keywords=page.keywords,
        search_text=search_text or None,
        error=page.error,
        embedding=embedding,
    )

    if embedding:
        try:
            # The indexed text describes the link far better than "Instagram Reel
            # + a URL" does, so it also seeds the memory's own embedding.
            await db.set_memory_embedding_if_null(body.memory_id, user.id, embedding)
        except Exception:
            # `memories.embedding` only exists once migration 001 has run.
            pass

    if row_status == "ready" and page.title:
        try:
            await db.improve_memory_title(body.memory_id, user.id, page.title)
        except Exception:
            pass

    return IndexResponse(
        memory_id=body.memory_id,
        status=row_status,
        url=page.final_url or url,
        page_title=page.title,
        description=page.description,
        site_name=page.site_name,
        author=page.author,
        image_url=page.image,
        favicon_url=page.favicon,
        keywords=page.keywords,
        has_transcript=bool(page.transcript),
        indexed_chars=len(search_text or ""),
        error=page.error,
    )
