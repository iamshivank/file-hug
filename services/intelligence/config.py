"""Application configuration via pydantic-settings.

All values are read from the environment (or a local ``.env`` file). Sensible
defaults are provided so the service can boot with *no* configuration for local
development — embeddings default to the local ``HashingEmbedder``. In production,
``AUTH_SECRET`` MUST be provided via environment variable.
"""

from __future__ import annotations

import os
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

    # HMAC key used to verify the fh_session cookie. MUST be set in production.
    AUTH_SECRET: str | None = None

    # Optional — enables OpenAIEmbedder when present.
    OPENAI_API_KEY: str | None = None

    # Active embedding dimension. MUST match the vector(N) column in the migration.
    # Default 384 matches HashingEmbedder.
    EMBED_DIM: int = 384

    # CORS origin for the Next.js frontend.
    ALLOWED_ORIGIN: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance with validation."""
    settings = Settings()

    # In local development mode (explicit opt-in), allow DEV_AUTH_SECRET fallback.
    # In production, AUTH_SECRET MUST be provided.
    local_dev_mode = os.getenv("LOCAL_DEV_MODE", "").lower() in ("1", "true", "yes")

    if settings.AUTH_SECRET is None:
        if local_dev_mode:
            settings.AUTH_SECRET = DEV_AUTH_SECRET
        else:
            raise ValueError(
                "AUTH_SECRET environment variable is required. "
                "Set LOCAL_DEV_MODE=true only for local development."
            )

    # Never use DEV_AUTH_SECRET in production when verify_token is called.
    if not local_dev_mode and settings.AUTH_SECRET == DEV_AUTH_SECRET:
        raise ValueError(
            "Production deployment detected DEV_AUTH_SECRET. "
            "AUTH_SECRET must be set to a deployment-provided secret."
        )

    return settings
