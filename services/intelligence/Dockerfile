# File Hug — Memory Intelligence service
#
# A long-running ASGI process, which is why it can't live on Vercel alongside the
# Next.js app. Any container host works: Railway, Render, Fly.io, Cloud Run.
#
#   docker build -t filehug-intelligence services/intelligence
#   docker run -p 8000:8000 --env-file services/intelligence/.env filehug-intelligence
#
# Required env at runtime: DATABASE_URL, AUTH_SECRET (must match the Next.js app).
# Optional: OPENAI_API_KEY, EMBED_DIM, ALLOWED_ORIGIN.

FROM python:3.12-slim

# Faster, quieter Python in containers; no .pyc clutter, unbuffered logs so the
# host's log collector sees output immediately.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so the layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user — this process fetches arbitrary third-party URLs, so it
# should hold the fewest privileges that still work.
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Most platforms inject $PORT; fall back to 8000 for plain `docker run`.
# Single worker by default: each holds its own asyncpg pool (max_size=10), so
# raise workers only with your database's connection limit in mind.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
