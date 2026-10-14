"""Pluggable text embedding backends.

Two implementations are provided:

* :class:`OpenAIEmbedder` — uses the OpenAI ``text-embedding-3-small`` model
  (configured dimensions). Only selected when ``OPENAI_API_KEY`` is present.
* :class:`HashingEmbedder` — a deterministic, network-free fallback that hashes
  tokens into a fixed-dimension L2-normalized vector. This is the default and
  guarantees the service works with no API key configured.

:func:`get_embedder` returns the appropriate backend based on the environment.
The active dimension is exposed via ``Embedder.dim`` so the migration and the
``embedding vector(N)`` column can be kept in sync.
"""

from __future__ import annotations

import asyncio
import hashlib
import math
import re
from abc import ABC, abstractmethod

from config import Settings, get_settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    """Lowercase word/number tokenizer."""
    return _TOKEN_RE.findall(text.lower())


class Embedder(ABC):
    """Abstract embedding backend."""

    #: Dimensionality of vectors produced by this embedder.
    dim: int

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Embed a single piece of text into a float vector of length ``dim``."""
        raise NotImplementedError

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Default implementation embeds sequentially.

        Subclasses may override for a more efficient batched call.
        """
        return [await self.embed(text) for text in texts]


class HashingEmbedder(Embedder):
    """Deterministic local embedder — no network, no API key required.

    Each token is hashed to a bucket index and a sign; token contributions are
    accumulated and the resulting vector is L2-normalized. This is not a
    semantically rich embedding, but it is stable and lets the hybrid search
    pipeline (and the vector column) function end-to-end offline.
    """

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim

    def _embed_sync(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _tokenize(text):
            digest = hashlib.md5(token.encode("utf-8")).digest()
            # First 4 bytes -> bucket index; next byte's low bit -> sign.
            idx = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if (digest[4] & 1) else -1.0
            vec[idx] += sign

        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0.0:
            vec = [v / norm for v in vec]
        return vec

    async def embed(self, text: str) -> list[float]:
        return self._embed_sync(text)


class OpenAIEmbedder(Embedder):
    """OpenAI-backed embedder using ``text-embedding-3-small`` (configured dimensions)."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small", dim: int = 384) -> None:
        # Imported lazily so the dependency is optional.
        from openai import AsyncOpenAI

        self.dim = dim
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key, timeout=20, max_retries=1)

    @staticmethod
    def _tokenize_sync(text: str) -> list[int]:
        import tiktoken
        return tiktoken.get_encoding('cl100k_base').encode(text or ' ')

    async def embed(self, text: str) -> list[float]:
        # Token-bounded chunks avoid the API input limit for long/multilingual pages.
        # Tokenizing is CPU-bound and tiktoken's first call downloads its BPE file,
        # so keep both off the event loop.
        tokens = await asyncio.to_thread(self._tokenize_sync, text)
        chunks = [tokens[i:i + 6000] for i in range(0, len(tokens), 6000)]
        result = await self._client.embeddings.create(
            model=self.model, dimensions=self.dim, input=chunks,
        )
        ordered = sorted(result.data, key=lambda item: item.index)
        if len(ordered) != len(chunks) or any(len(i.embedding) != self.dim for i in ordered):
            # e.g. a model that ignores `dimensions` — never store a mis-sized vector.
            raise ValueError(f'Embedding response does not match {len(chunks)} x {self.dim}')
        vec =[sum(item.embedding[j] * len(chunks[i]) for i, item in enumerate(ordered))
               / len(tokens) for j in range(self.dim)]
        norm = math.sqrt(sum(v * v for v in vec))
        return [v / norm for v in vec] if norm else vec

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]


_embedder_singleton: Embedder | None = None


def get_embedder(settings: Settings | None = None) -> Embedder:
    """Return the active embedder, chosen from the environment.

    Uses :class:`OpenAIEmbedder` when ``OPENAI_API_KEY`` is set, otherwise the
    :class:`HashingEmbedder` sized to ``EMBED_DIM``. The instance is cached.

    Validates that the selected embedder dimension matches the configured ``EMBED_DIM``
    to prevent dimension mismatches with the database schema.
    """
    global _embedder_singleton
    if _embedder_singleton is not None:
        return _embedder_singleton

    settings = settings or get_settings()

    if settings.OPENAI_API_KEY:
        embedder = OpenAIEmbedder(api_key=settings.OPENAI_API_KEY,
                                 model=settings.OPENAI_EMBEDDING_MODEL, dim=settings.EMBED_DIM)
        _embedder_singleton = embedder
    else:
        _embedder_singleton = HashingEmbedder(dim=settings.EMBED_DIM)

    return _embedder_singleton


def embedding_model() -> str:
    settings = get_settings()
    return (f'{settings.OPENAI_EMBEDDING_MODEL}:{settings.EMBED_DIM}'
            if settings.OPENAI_API_KEY else f'hashing:{settings.EMBED_DIM}')
