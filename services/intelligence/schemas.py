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
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None
    favicon: str | None = None
    transcript: str | None = None
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
        description="Which signals matched, e.g. ['fts', 'semantic', 'ilike'].",
    )


class SearchResponse(BaseModel):
    query: str
    count: int
    mode: str = Field(description="Effective search mode: 'hybrid' (FTS+semantic), 'semantic' (semantic-only), 'fts', or 'ilike'.")
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
