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
from extraction import build_search_text, fetch_page  # noqa: E402


async def _index_one(row: dict, semaphore: asyncio.Semaphore) -> str:
    """Index a single link memory. Returns its resulting status."""
    async with semaphore:
        memory_id = row["id"]
        user_id = row["user_id"]
        url = row["content"]

        page = await fetch_page(url)

        extra = [row.get("title") or "", " ".join(row.get("tags") or [])]
        search_text = build_search_text(page, extra=[v for v in extra if v])
        row_status = "ready" if search_text else "failed"

        embedding = None
        if search_text:
            try:
                embedding = await get_embedder().embed(search_text)
            except Exception as exc:
                print(f"    ! embedding failed for {memory_id}: {exc}")

        await db.upsert_memory_index(
            memory_id=memory_id,
            user_id=user_id,
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
                await db.set_memory_embedding_if_null(memory_id, user_id, embedding)
            except Exception:
                # `memories.embedding` only exists once migration 001 has run.
                pass

        if row_status == "ready" and page.title:
            try:
                await db.improve_memory_title(memory_id, user_id, page.title)
            except Exception:
                pass

        marker = "ok " if row_status == "ready" else "fail"
        detail = page.error or f"{len(search_text)} chars"
        print(f"    [{marker}] {url}  ({detail})")
        return row_status


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

    while True:
        rows = await db.fetch_links_needing_index(
            user_id, batch_size, include_failed=retry_failed
        )
        if not rows:
            break

        print(f"  indexing {len(rows)} links…")
        statuses = await asyncio.gather(
            *(_index_one(row, semaphore) for row in rows),
            return_exceptions=True,
        )

        batch_successes = 0
        for status in statuses:
            if isinstance(status, BaseException):
                # An unexpected error leaves the row untouched. Count it as failed
                # so the totals are honest; `--retry-failed` can pick it up later.
                print(f"    ! unexpected error: {status}")
                failed += 1
            elif status == "ready":
                ready += 1
                batch_successes += 1
            else:
                failed += 1

        print(f"  running totals: {ready} indexed, {failed} failed")

        # Detect a no-progress batch: all items failed, so we made no progress
        if batch_successes == 0:
            print("  no progress in this batch (all failed), stopping to prevent infinite loop")
            break

        # A short batch means we've drained the queue.
        if len(rows) < batch_size:
            break

        # Without --retry-failed, rows that just failed are excluded from the next
        # query, so the loop terminates. With it, they are not — stop after one
        # pass rather than retrying the same unreachable pages forever.
        if retry_failed:
            break

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
