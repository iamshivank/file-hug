"""Pydantic request/response models for the intelligence service."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# /extract
# ---------------------------------------------------------------------------
class ExtractRequest(BaseModel):
    url: str = Field(..., description="The URL to fetch and extract metadata from.")


class ExtractResponse(BaseModel):
    url: str
    final_url: str | None = Field(
        default=None, description="Where the URL resolved to after redirects."
    )
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None
    favicon: str | None = None
    author: str | None = None
    keywords: list[str] = Field(default_factory=list)
    text: str | None = Field(
        default=None, description="The page's visible body text, truncated."
    )
    transcript: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# /index
# ---------------------------------------------------------------------------
class IndexRequest(BaseModel):
    memory_id: str = Field(..., description="Id of the link memory to index.")
    force: bool = Field(
        default=False,
        description="Re-index even when a ready row already exists for this memory.",
    )


class IndexResponse(BaseModel):
    memory_id: str
    status: str = Field(description="'ready', 'failed', or 'skipped'.")
    url: str | None = None
    page_title: str | None = None
    description: str | None = None
    site_name: str | None = None
    author: str | None = None
    image_url: str | None = None
    favicon_url: str | None = None
    keywords: list[str] = Field(default_factory=list)
    has_transcript: bool = False
    #: Length of the indexed text — a cheap way for callers to see how much
    #: searchable content the page yielded.
    indexed_chars: int = 0
    error: str | None = None


# ---------------------------------------------------------------------------
# /search
# ---------------------------------------------------------------------------
class SearchResult(BaseModel):
    id: str
    title: str
    content: str
    type: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    score: float
    matched: list[str] = Field(
        default_factory=list,
        description=(
            "Which signals ranked this result: 'fts'/'semantic' over the saved "
            "title+content, 'index_fts'/'index_semantic' over the extracted page "
            "content, or 'ilike' from the substring fallback."
        ),
    )
    #: A short excerpt of the extracted page content, when the link was indexed.
    snippet: str | None = None


class SearchResponse(BaseModel):
    query: str
    count: int
    mode: str = Field(
        description=(
            "Effective search mode: 'hybrid' (two or more signals), 'semantic', "
            "'fts', or 'ilike'."
        )
    )
    #: True when at least one signal came from the extracted link index.
    used_link_index: bool = False
    results: list[SearchResult] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# /dashboard/summary
# ---------------------------------------------------------------------------
class PlatformCount(BaseModel):
    platform: str
    count: int


class RecentMemory(BaseModel):
    id: str
    title: str
    type: str
    created_at: datetime


class DashboardSummary(BaseModel):
    total_memories: int
    links: int
    notes: int
    connected_memories: int
    top_platforms: list[PlatformCount] = Field(default_factory=list)
    recent_activity: list[RecentMemory] = Field(default_factory=list)
    saves_last_7_days: int
