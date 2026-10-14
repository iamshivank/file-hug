"""File Hug — Memory Intelligence Service.

A standalone FastAPI microservice providing async URL extraction, hybrid
(semantic + full-text) search, and a dashboard summary over the same Neon
PostgreSQL database used by the Next.js app.

The Next.js app proxies ``/api/intelligence/*`` to this service, stripping the
prefix, so routers are mounted at the app root here.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from config import get_settings
from routers import dashboard, extract, link_index, search


logger = logging.getLogger("intelligence")


async def _check_embedding_dims() -> None:
    """Warn loudly when EMBED_DIM can't fit the database's vector(N) columns.

    The migrations fix the column size; EMBED_DIM only controls what we produce.
    A mismatch makes every vector write/query fail, so surface it at boot.
    """
    expected = get_settings().EMBED_DIM
    for table in ("memory_index", "memories"):
        try:
            actual = await db.embedding_column_dim(table)
        except Exception:  # missing extension/table: the routes degrade on their own
            continue
        if actual is not None and actual != expected:
            logger.error(
                "EMBED_DIM=%s but %s.embedding is vector(%s); semantic indexing "
                "will fail until they match (see AI_SETUP.md).",
                expected, table, actual,
            )


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create the DB pool on startup, close it on shutdown."""
    await db.init_pool()
    try:
        await _check_embedding_dims()
        yield
    finally:
        await db.close_pool()


settings = get_settings()

app = FastAPI(
    title="File Hug — Memory Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in settings.ALLOWED_ORIGIN.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Starlette answers a credentialed request under "*" by echoing the caller's
    # Origin, i.e. any site could read authenticated responses. Never combine them.
    allow_credentials="*" not in _origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "Cookie"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe — no auth required."""
    return {"status": "ok"}


app.include_router(extract.router, tags=["extract"])
app.include_router(link_index.router, tags=["index"])
app.include_router(search.router, tags=["search"])
app.include_router(dashboard.router, tags=["dashboard"])
