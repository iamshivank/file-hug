"""Backfill embeddings for memories with a NULL embedding.

Computes vectors via the active ``get_embedder()`` and UPDATEs rows in batches.
Runs fully async. By default it processes ALL users; pass ``--user <id>`` to
restrict to a single user.

Usage (from the service root, with the venv active)::

    python scripts/backfill_embeddings.py                 # all users
    python scripts/backfill_embeddings.py --user u_123    # one user
    python scripts/backfill_embeddings.py --batch 100

The vector dimension produced by the embedder MUST match the ``embedding
vector(N)`` column created by migrations/001_intelligence.sql.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

# Allow running as `python scripts/backfill_embeddings.py` by putting the
# service root (the parent of this file's directory) on the import path.
_SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVICE_ROOT not in sys.path:
    sys.path.insert(0, _SERVICE_ROOT)

import db  # noqa: E402
from embeddings import get_embedder  # noqa: E402


async def backfill(user_id: str | None, batch_size: int) -> int:
    """Backfill embeddings; returns the total number of rows updated."""
    embedder = get_embedder()
    print(f"Using embedder dim={embedder.dim}")

    total = 0
    while True:
        rows = await db.fetch_rows_needing_embedding(user_id, batch_size)
        if not rows:
            break

        texts = [
            f"{r.get('title') or ''} {r.get('content') or ''}".strip() for r in rows
        ]
        vectors = await embedder.embed_batch(texts)

        # Validate that the embedder returned the correct number of vectors.
        if len(vectors) != len(rows):
            raise ValueError(
                f"Embedder returned {len(vectors)} vectors but expected {len(rows)} "
                f"(one per row). Cannot proceed with mismatched counts."
            )

        for row, vec in zip(rows, vectors):
            await db.update_embedding(row["id"], vec)

        total += len(rows)
        print(f"  updated {len(rows)} rows (running total: {total})")

        # If a full batch was fetched there may be more; otherwise we're done.
        if len(rows) < batch_size:
            break

    return total


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Backfill memory embeddings.")
    parser.add_argument("--user", dest="user", default=None, help="Restrict to a user id.")
    parser.add_argument("--batch", dest="batch", type=int, default=50, help="Batch size.")
    args = parser.parse_args()

    await db.init_pool()
    try:
        updated = await backfill(args.user, args.batch)
        print(f"Done. {updated} rows updated.")
    finally:
        await db.close_pool()


if __name__ == "__main__":
    asyncio.run(_main())
