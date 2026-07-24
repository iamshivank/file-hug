"""Dashboard summary for the current user."""

from __future__ import annotations

from fastapi import APIRouter, Depends

import db
from auth import SessionUser, get_current_user
from schemas import DashboardSummary, PlatformCount, RecentMemory

router = APIRouter()


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(
    user: SessionUser = Depends(get_current_user),
) -> DashboardSummary:
    """Aggregate stats for the authenticated user's memories."""
    counts = await db.dashboard_counts(user.id)
    platforms = await db.dashboard_top_platforms(user.id, limit=5)
    recent = await db.dashboard_recent(user.id, limit=5)
    saves_7d = await db.dashboard_recent_saves(user.id, days=7)

    return DashboardSummary(
        total_memories=counts["total"],
        links=counts["links"],
        notes=counts["notes"],
        connected_memories=counts["connected"],
        top_platforms=[
            PlatformCount(platform=p["platform"], count=p["count"]) for p in platforms
        ],
        recent_activity=[
            RecentMemory(
                id=r["id"],
                title=r["title"],
                type=r["type"],
                created_at=r["created_at"],
            )
            for r in recent
        ],
        saves_last_7_days=saves_7d,
    )
