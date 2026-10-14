"""Apply the additive intelligence migrations after the base Drizzle schema exists."""
import asyncio
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import db  # noqa: E402
from config import get_settings  # noqa: E402

#: The dimension written in the .sql files; replaced with the configured EMBED_DIM.
_SQL_DIM = re.compile(r"\bvector\(384\)")


def render(sql: str, dim: int) -> str:
    """Size the `embedding vector(N)` columns to EMBED_DIM.

    The files say vector(384) (the default). Without this, a fresh database run
    with EMBED_DIM=1536 would get 384-d columns that reject every vector written.
    """
    return _SQL_DIM.sub(f"vector({int(dim)})", sql)


async def main():
    dim = get_settings().EMBED_DIM
    await db.init_pool()
    try:
        async with db.get_pool().acquire() as conn:
            async with conn.transaction():
                for path in sorted((ROOT / 'migrations').glob('*.sql')):
                    await conn.execute(render(path.read_text(encoding='utf-8'), dim))
                    print(f'Applied {path.name}')

        # ADD COLUMN IF NOT EXISTS never resizes an existing column, so an older
        # database can still disagree with EMBED_DIM. Say so instead of failing later.
        mismatched = False
        for table in ('memories', 'memory_index'):
            actual = await db.embedding_column_dim(table)
            if actual is not None and actual != dim:
                mismatched = True
                print(f'WARNING: {table}.embedding is vector({actual}) but EMBED_DIM={dim}. '
                      f'Set EMBED_DIM={actual} or migrate the column (see AI_SETUP.md).')
        if mismatched:
            sys.exit(1)
    finally:
        await db.close_pool()


if __name__ == '__main__':
    asyncio.run(main())
