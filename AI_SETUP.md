# Enable AI link memory and search

Put your **OpenAI API key** in `.env.local` in the project root (beside
`package.json`), using the exact name `OPENAI_API_KEY`. This file is ignored by Git.
Never prefix the key with `NEXT_PUBLIC_`.

```dotenv
OPENAI_API_KEY=your-api-key-here
INTELLIGENCE_SERVICE_URL=http://localhost:8000
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBED_DIM=384
NEXT_PUBLIC_IS_DEMO_MODE=false
```

Keep your existing `DATABASE_URL` and `AUTH_SECRET` in the root `.env` or
`.env.local`. Both processes must use the same database and auth secret.
The Python service now loads root `.env`, then root `.env.local`, then its own
optional `services/intelligence/.env`; process environment variables win over all files.
If `AUTH_SECRET` is absent, set it in the shared root file and sign in again.

## Start locally (PowerShell, from the project root)

```powershell
python -m venv services/intelligence/.venv
services/intelligence/.venv/Scripts/python -m pip install -r services/intelligence/requirements.txt
```

On a **new database**, create the base app tables with `npm run db:push` first.
On an existing database, do not accept Drizzle proposals to drop the manually
managed `embedding` or `search_tsv` columns. The following additive migrations
preserve all saved links and existing vectors:

```powershell
services/intelligence/.venv/Scripts/python services/intelligence/scripts/migrate.py
services/intelligence/.venv/Scripts/python -m uvicorn main:app --app-dir services/intelligence --port 8000
```

In another terminal, run `npm run dev`. Restart both processes after changing keys.
Use a real signed-in account; the demo runs locally without AI requests.

For previously saved links, run once:

```powershell
services/intelligence/.venv/Scripts/python services/intelligence/scripts/backfill_link_index.py --retry-failed
```

The backfill reads old/missing indexes, incompatible embedding models and failed
links. Each eligible link is attempted once per run, including libraries larger
than one batch. You can restrict it using `--user USER_ID`. Each indexing/search
operation uses the paid OpenAI API.

## What happens

Saving starts page extraction immediately after the save response. The card shows
reading progress, then the page context and topical tags in its preview. The service
stores extracted text, transcript when accessible, a grounded AI summary, tags,
natural-language retrieval intents and a semantic vector. Search embeds your query,
retrieves by meaning and keywords, and asks AI to judge relevance and exclude
unrelated candidates. For example, a page about spaced repetition can be found
with “help me stop forgetting what I study,” even when its URL contains none of those words.

OpenAI vectors use `dimensions=384`, matching the shipped pgvector schema. Existing
hash vectors are excluded by model identity until reindexed. If your database was
previously configured for 1536 dimensions, keep `EMBED_DIM=1536` to match it; changing
the setting alone does not alter an existing database column.

Public HTML and available YouTube captions are supported. Login-only pages,
paywalls, blocked requests, PDFs and content rendered only by JavaScript may not
yield readable content. The app reports failures and offers re-reading; it cannot
invent content it could not access. A successful mock test does not measure real
model relevance: test a few of your own saved links once the API key is configured.

## Production

Run the Python service on a persistent container/VM host and set its `DATABASE_URL`,
`AUTH_SECRET`, `OPENAI_API_KEY`, model settings and `ALLOWED_ORIGIN` there. Set the
Next.js deployment's `INTELLIGENCE_SERVICE_URL` to that service's HTTPS URL. Both
use the same database and auth secret. Apply migrations before releasing the app.
Allow 180 seconds for Next.js indexing routes; a Vercel-only deployment does not
start the Python service. Interrupted indexing can be recovered with the backfill.

## Checks

```powershell
npm run lint
npx tsc --noEmit
services/intelligence/.venv/Scripts/python -m unittest discover -s services/intelligence/tests -v
```

Run Python tests from `services/intelligence` instead if imports cannot resolve:
`.venv/Scripts/python -m unittest discover -s tests -v`.

Implementation references: [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)
and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
