"""File Hug — Memory Intelligence Service.

A standalone FastAPI microservice providing async URL extraction, hybrid
(semantic + full-text) search, and a dashboard summary over the same Neon
PostgreSQL database used by the Next.js app.

The Next.js app proxies ``/api/intelligence/*`` to this service, stripping the
prefix, so routers are mounted at the app root here.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from config import get_settings
from routers import dashboard, extract, search


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create the DB pool on startup, close it on shutdown."""
    await db.init_pool()
    try:
        yield
    finally:
        await db.close_pool()


settings = get_settings()

app = FastAPI(
    title="File Hug — Memory Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe — no auth required."""
    return {"status": "ok"}


app.include_router(extract.router, tags=["extract"])
app.include_router(search.router, tags=["search"])
app.include_router(dashboard.router, tags=["dashboard"])
