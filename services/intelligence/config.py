"""Application configuration via pydantic-settings.

All values are read from the environment (or a local ``.env`` file). Sensible
defaults are provided so the service can boot with *no* configuration for local
development — in particular ``AUTH_SECRET`` falls back to the same dev secret
the Next.js app uses, and embeddings default to the local ``HashingEmbedder``.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# Must match the fallback secret used by the Next.js app when AUTH_SECRET is unset.
DEV_AUTH_SECRET = "file-hug-dev-secret-change-me"


class Settings(BaseSettings):
    """Runtime settings for the intelligence service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Shared Neon PostgreSQL connection string (postgres:// URL).
    DATABASE_URL: str = "postgresql://localhost:5432/filehug"

    # HMAC key used to verify the fh_session cookie. Matches Next.js fallback.
    AUTH_SECRET: str = DEV_AUTH_SECRET

    # Optional — enables OpenAIEmbedder when present.
    OPENAI_API_KEY: str | None = None

    # Active embedding dimension. MUST match the vector(N) column in the migration.
    # Default 384 matches HashingEmbedder.
    EMBED_DIM: int = 384

    # CORS origin for the Next.js frontend.
    ALLOWED_ORIGIN: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
