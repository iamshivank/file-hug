"""Application configuration via pydantic-settings.

All values are read from the environment (or a local ``.env`` file). Sensible
defaults are provided so the service can boot with *no* configuration for local
development — embeddings default to the local ``HashingEmbedder``. In production,
``AUTH_SECRET`` MUST be provided via environment variable.
"""

from __future__ import annotations

from pathlib import Path
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Must match the fallback secret used by the Next.js app when AUTH_SECRET is unset.
DEV_AUTH_SECRET = "file-hug-dev-secret-change-me"


class Settings(BaseSettings):
    """Runtime settings for the intelligence service."""

    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parents[2] / '.env',
                  Path(__file__).resolve().parents[2] / '.env.local',
                  Path(__file__).resolve().parent / '.env'),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Shared Neon PostgreSQL connection string (postgres:// URL).
    DATABASE_URL: str = "postgresql://localhost:5432/filehug"

    # HMAC key used to verify the fh_session cookie. MUST be set in production.
    AUTH_SECRET: str | None = None

    # Optional — enables OpenAIEmbedder when present.
    OPENAI_API_KEY: str | None = None
    OPENAI_CHAT_MODEL: str = "gpt-4.1-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Active embedding dimension. MUST match the vector(N) column in the migration.
    # Default 384 matches HashingEmbedder.
    EMBED_DIM: int = 384

    # CORS origin(s) for the Next.js frontend; comma-separated for several.
    ALLOWED_ORIGIN: str = "http://localhost:3000"

    # Explicit opt-in to the DEV_AUTH_SECRET fallback. Read through settings (not
    # os.environ) so it also works when set in one of the .env files above.
    LOCAL_DEV_MODE: bool = False

    @field_validator("AUTH_SECRET", "OPENAI_API_KEY", mode="before")
    @classmethod
    def _empty_is_unset(cls, value: object) -> object:
        # `AUTH_SECRET=` in a .env file means "unset" -- exactly how the Next.js app
        # treats it (it falls back to the dev secret). Accepting "" here would sign
        # with an empty HMAC key that no Next.js token matches and anyone can forge.
        if isinstance(value, str) and not value.strip():
            return None
        return value


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance with validation."""
    settings = Settings()

    # In local development mode (explicit opt-in), allow DEV_AUTH_SECRET fallback.
    # In production, AUTH_SECRET MUST be provided.
    local_dev_mode = settings.LOCAL_DEV_MODE

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
