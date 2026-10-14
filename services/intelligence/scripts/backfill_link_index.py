"""Backfill the link index for saved links that were never read.

New links are indexed automatically the moment they are saved. This script exists
for the ones that predate that — plus anything left stuck in ``pending`` because
the service was down when its save happened.

For each link it opens the URL, extracts metadata / body text / transcript, embeds
the result, and upserts a ``memory_index`` row, exactly as ``POST /index`` does.
Runs fully async. By default it processes ALL users; pass ``--user <id>`` to
restrict to one.

Usage (from the service root, with the venv active)::

    python scripts/backfill_link_index.py                  # all users
    python scripts/backfill_link_index.py --user u_123     # one user
    python scripts/backfill_link_index.py --batch 20 --concurrency 4
    python scripts/backfill_link_index.py --retry-failed   # also retry failures

This makes live HTTP requests to third-party sites, so it is rate-limited by
``--concurrency`` (default 4) to stay a polite crawler. Prerequisites:
``migrations/002_memory_index.sql`` must have been applied.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

# Allow running as `python scripts/backfill_link_index.py` by putting the service
# root (the parent of this file's directory) on the import path.
_SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVICE_ROOT not in sys.path:
    sys.path.insert(0, _SERVICE_ROOT)

import db  # noqa: E402
from embeddings import get_embedder  # noqa: E402


async def _index_one(row: dict, semaphore: asyncio.Semaphore) -> str:
    """Index a single link memory. Returns its resulting status."""
    async with semaphore:
        from routers.link_index import index_memory
        from schemas import IndexRequest
        from auth import SessionUser
        result = await index_memory(IndexRequest(memory_id=row['id'], force=True),
                                    SessionUser(id=row['user_id']))
        print(f"    [{result.status}] {row['id']}")
        return result.status


async def backfill(
    user_id: str | None,
    batch_size: int,
    concurrency: int,
    retry_failed: bool,
) -> tuple[int, int]:
    """Index every un-indexed link. Returns ``(ready_count, failed_count)``."""
    print(f"Using embedder dim={get_embedder().dim}, concurrency={concurrency}")

    semaphore = asyncio.Semaphore(concurrency)
    ready = 0
    failed = 0

    seen: list[str] = []
    while True:
        rows = await db.fetch_links_needing_index(
            user_id, batch_size, include_failed=retry_failed, exclude_ids=seen
        )
        if not rows:
            break

        seen.extend(row["id"] for row in rows)
        print(f"  indexing {len(rows)} links…")
        statuses = await asyncio.gather(
            *(_index_one(row, semaphore) for row in rows),
            return_exceptions=True,
        )

        for status in statuses:
            if isinstance(status, BaseException):
                # An unexpected error leaves the row untouched. Count it as failed
                # so the totals are honest; `--retry-failed` can pick it up later.
                print(f"    ! unexpected error: {status}")
                failed += 1
            elif status == "ready":
                ready += 1
            else:
                failed += 1

        print(f"  running totals: {ready} indexed, {failed} failed")


    return ready, failed


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Backfill the saved-link index.")
    parser.add_argument("--user", dest="user", default=None, help="Restrict to a user id.")
    parser.add_argument("--batch", dest="batch", type=int, default=20, help="Batch size.")
    parser.add_argument(
        "--concurrency",
        dest="concurrency",
        type=int,
        default=4,
        help="Concurrent page fetches (keep modest — these are real HTTP requests).",
    )
    parser.add_argument(
        "--retry-failed",
        dest="retry_failed",
        action="store_true",
        help="Also re-attempt links previously marked failed (single pass).",
    )
    args = parser.parse_args()

    await db.init_pool()
    try:
        ready, failed = await backfill(
            args.user, args.batch, max(1, args.concurrency), args.retry_failed
        )
        print(f"Done. {ready} links indexed, {failed} failed.")
    finally:
        await db.close_pool()


if __name__ == "__main__":
    asyncio.run(_main())
