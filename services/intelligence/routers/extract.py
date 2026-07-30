"""One-shot URL metadata + transcript extraction.

A thin HTTP wrapper over :mod:`extraction`. It returns what was found without
persisting anything — use ``POST /index`` when the result should be stored for
search. Extraction failures degrade gracefully: this endpoint returns HTTP 200
with an ``error`` field rather than a 5xx, alongside any partial data.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from auth import SessionUser, get_current_user
from extraction import fetch_page
from schemas import ExtractRequest, ExtractResponse

router = APIRouter()


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    body: ExtractRequest,
    _user: SessionUser = Depends(get_current_user),
) -> ExtractResponse:
    """Fetch a URL and return its metadata, body text, and any transcript."""
    page = await fetch_page(body.url)
    return ExtractResponse(
        url=page.url,
        final_url=page.final_url,
        title=page.title,
        description=page.description,
        image=page.image,
        site_name=page.site_name,
        favicon=page.favicon,
        author=page.author,
        keywords=page.keywords,
        text=page.text,
        transcript=page.transcript,
        error=page.error,
    )
