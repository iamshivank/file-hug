@AGENTS.md

# File Hug

## Product Overview

File Hug is a SaaS application that acts as an AI-powered memory for everything users discover online. Users save reels, articles, ChatGPT conversations, memes, links, and ideas in one place, then search them later using natural language.

**Tagline:** Never lose something you wanted to remember.

---

## Current State

The app is well past the landing page. It has:

- ✅ Landing page (marketing sections + waitlist form)
- ✅ Auth — email/password, Google OAuth, and a client-only demo mode
- ✅ Dashboard at `/app` — save links and notes, group by platform, connect memories
- ✅ Link intelligence — saved links are opened, read, and indexed for search
- ✅ Hybrid search — semantic + full-text, over both saved text and link contents
- ✅ Billing — Razorpay, plans free/pro/ai
- ❌ No Chrome extension
- ❌ No WhatsApp integration
- ❌ No LLM-generated summaries (search is embeddings + FTS, not a chat model)

---

## Tech Stack

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Framework        | Next.js 16.2.7 (App Router)                    |
| Language         | TypeScript (strict)                            |
| Styling          | TailwindCSS 4 + custom CSS tokens              |
| Icons            | Lucide React                                   |
| 3D / canvas      | three                                          |
| Database         | **Neon PostgreSQL** via **Drizzle ORM**        |
| Auth             | Custom HMAC-signed cookie + Google OAuth       |
| Payments         | Razorpay                                       |
| Intelligence     | Standalone **Python / FastAPI** service        |
| Embeddings       | pgvector (local hashing embedder, or OpenAI)   |
| Deployment       | Vercel-ready (the Python service deploys separately) |

> There is no MongoDB and no Mongoose. `src/models/` holds plain TypeScript
> interfaces, not schemas.

---

## Project Structure

```
file-hug/
├── .env                                # DATABASE_URL, AUTH_SECRET, OAuth, Razorpay, …
├── drizzle.config.ts
│
├── services/
│   └── intelligence/                   # Python FastAPI microservice (own README)
│       ├── main.py                     # App + router mounting
│       ├── config.py                   # pydantic-settings (DATABASE_URL, AUTH_SECRET, EMBED_DIM)
│       ├── auth.py                     # Verifies the app's fh_session token (requires `exp`)
│       ├── db.py                       # asyncpg pool + all queries (every one scoped by user_id)
│       ├── embeddings.py               # HashingEmbedder (default) | OpenAIEmbedder
│       ├── extraction.py               # Fetch + parse a URL: metadata, body text, transcript
│       ├── routers/
│       │   ├── extract.py              # POST /extract      — one-shot, no persistence
│       │   ├── link_index.py           # POST /index        — extract + embed + upsert memory_index
│       │   ├── search.py               # GET  /search       — RRF fusion of up to 4 signals
│       │   └── dashboard.py            # GET  /dashboard/summary
│       └── migrations/
│           ├── 001_intelligence.sql    # memories.search_tsv + memories.embedding
│           └── 002_memory_index.sql    # memory_index.search_tsv + .embedding
│
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout — fonts, SEO metadata, analytics
    │   ├── page.tsx                    # Landing page
    │   ├── login/page.tsx
    │   ├── app/                        # The authenticated product
    │   │   ├── page.tsx                # Renders MemoryDashboard
    │   │   └── profile/                # Account + plan upgrade
    │   ├── globals.css                 # Design system — tokens, animations, utilities
    │   └── api/
    │       ├── auth/…                   # signup, login, signout, session, demo, google/*
    │       ├── memories/route.ts        # GET/POST/PATCH memories
    │       ├── memories/reindex/route.ts# POST — re-read one link (synchronous)
    │       ├── intelligence/[...path]/  # Proxy → the FastAPI service
    │       ├── billing/…                # order, verify, webhook
    │       └── waitlist/route.ts
    │
    ├── db/schema.ts                    # Drizzle schema — the source of truth for tables
    ├── lib/db.ts                       # Neon pool + drizzle (WebSocket driver, for transactions)
    │
    ├── features/
    │   ├── auth/                       # session.ts (HMAC + exp), oauth, password, UI
    │   ├── billing/                    # plans, razorpay, subscription read/write
    │   ├── memories/
    │   │   ├── components/             # Dashboard, cards, previews, composer, search bar
    │   │   ├── hooks/
    │   │   │   ├── useMemories.ts      # CRUD + enrichment polling + reindex
    │   │   │   └── useSmartSearch.ts   # Server ranking with local fallback
    │   │   ├── repositories/           # MemoryRepository — Drizzle queries
    │   │   ├── services/
    │   │   │   ├── MemoryService.ts    # Validation, plan limits, connections
    │   │   │   └── IntelligenceClient.ts # Server → FastAPI (`server-only`)
    │   │   ├── types/memory.types.ts
    │   │   └── utils/
    │   │       ├── urlDetection.ts     # URL → platform + subtype + title
    │   │       ├── platforms.ts        # The platform registry (labels, icon availability)
    │   │       ├── embed.ts            # URL → iframe embed info
    │   │       ├── grouping.ts         # Group links by platform
    │   │       └── search.ts           # Local filtering + ranking application
    │   └── theme/                      # Light/dark toggle
    │
    └── components/landing/             # Marketing sections
```

---

## Architecture

### Backend pattern

```
API Route → Service → Repository → Drizzle → Neon Postgres
```

- **Types** (`types/`): shared interfaces — no logic.
- **Repositories**: data access only. Every read/write takes a `userId` and scopes to it.
- **Services**: business logic — validation, plan limits, bidirectional connections. Return `{ success, data?, error? }`; never throw to the API layer.
- **API Routes**: HTTP only — parse, delegate, format, status codes.

### The two-process split

The Next.js app owns writes and the UI. The Python service owns anything that
means *reaching out to the internet or doing vector maths*: fetching pages,
parsing them, embedding text, and ranking search results. They share one database.

```
Browser ──► Next.js /api/intelligence/*  ──► (proxy, forwards fh_session as Bearer)
                                          ──► FastAPI service
Next.js server ──► IntelligenceClient ────► FastAPI POST /index
Both ──────────────────────────────────────► the same Neon database
```

**The service is optional, and being absent is a first-class state — not an
error.** `INTELLIGENCE_SERVICE_URL` unset means the feature is off:
`MemoryService` skips writing `pending` rows (otherwise every link would sit on
"reading this link…" forever), the proxy returns `503 {configured: false}`, and
`useSmartSearch` falls back to local filtering without warning the user. When it
*is* configured but unreachable, that's a 502 and the UI does say so.

Never make a user-facing feature hard-depend on it, and never let a missing
`memory_index` row or table break a core read/write — `getAll` and `save` both
catch and continue. It cannot run on Vercel; see the service's README for hosting.

### Link indexing flow

1. `POST /api/memories` saves the link and writes a `memory_index` row with `status='pending'`, in the same transaction.
2. `after()` (from `next/server`) fires `POST /index` on the service once the response is sent — the user never waits for a page fetch.
3. The service opens the URL, extracts metadata + body text + transcript, embeds it, and upserts the row as `ready` or `failed`.
4. `useMemories` polls (bounded) while anything is `pending`, then stops.
5. `LinkPreview` offers a retry, which calls `POST /api/memories/reindex` synchronously.

### Frontend pattern

- Client components use `'use client'`. Landing sections and dashboard UI are client components (animations, local state).
- Scroll animations use `IntersectionObserver` — no animation library.
- Server components: `layout.tsx`, `page.tsx`, and the `/app` pages.

---

## Database

`src/db/schema.ts` is the source of truth. `npm run db:push` applies it.

| Table           | Purpose |
| --------------- | ------- |
| `users`         | Accounts (email/password hash, Google id, demo flag) |
| `subscriptions` | Plan + status + Razorpay ids |
| `memories`      | Links and notes — `content`, `type`, `title`, `tags[]`, `linkedMemoryIds[]` |
| `memory_index`  | What we learned by opening each link — page title, description, body text, transcript, keywords |
| `waitlist`      | Landing-page signups |

### Columns Drizzle does not own

`memories` and `memory_index` each have two columns added by SQL migration
instead, because drizzle-pg has no type for them:

- `search_tsv tsvector` — generated + stored, GIN-indexed
- `embedding vector(N)` — pgvector, IVFFlat-indexed

**If `drizzle-kit push` offers to drop these, say no.** Run `db:push` first, then
the migrations in `services/intelligence/migrations/`.

### Memory connections

`memories.linkedMemoryIds` is a symmetric adjacency list: a connection is written
on **both** sides. `MemoryService.save/update` diffs the requested set and mirrors
each change onto the other memory inside the same transaction. Notes and links can
connect to each other freely (undirected graph), capped at 25 per memory.

---

## API Reference

### `POST /api/memories`

Saves a link or a note. Auto-detects which unless `type` is given.

Link URLs are normalised on save — `instagram.com/reel/x` is stored as
`https://instagram.com/reel/x` — so embeds, previews and indexing all work from a
parseable URL.

Returns `201` with the memory (link memories carry `enrichment.status: 'pending'`),
or `400` with an error.

### `PATCH /api/memories`

Updates `title`, `content`, and/or `linkedMemoryIds`. Requires a real session
(`401` for demo/anonymous). Ownership-checked.

### `POST /api/memories/reindex`

Body `{ id }`. Re-opens the link and rebuilds its index, waiting for the result and
returning the fresh enrichment. `502` when the service is unreachable.

### `POST /api/waitlist`

Body `{ name, email }`. `201` on success; `400` on validation failure or duplicate.

### `/api/intelligence/*`

Proxy to the FastAPI service, stripping the prefix. See that service's README for
its endpoints.

---

## Plans

| Plan | Price (INR/mo) | Links     | Notes     | Search  |
| ---- | -------------- | --------- | --------- | ------- |
| free | 0              | 1,000     | unlimited | indexed |
| pro  | 99             | unlimited | unlimited | indexed |
| ai   | 199            | unlimited | unlimited | ai      |

The Free link limit is enforced server-side in `MemoryService.save` (notes are
never limited).

---

## Design System

The design lives in `globals.css` — a warm, premium dark theme with a light mode.
Colors are CSS custom properties exposed to Tailwind via `@theme inline`, so use
semantic class names (`text-muted`, `bg-surface`, `border-border`,
`text-primary-light`, `text-danger`, `text-on-accent`) rather than raw hex.

Check `globals.css` before inventing a token — e.g. there is `--danger` and
`--success` but no `--warning`.

### Utility classes

- `.glass` / `.glass-strong` — glassmorphism with backdrop blur
- `.gradient-text`, `.gradient-border`
- `.bg-grid` / `.bg-dots`, `.glow-orb`
- `.card`, `.memory-card`, `.composer`, `.library-shell`, `.library-stat`, `.kbd`
- `.section-padding`

### Animations

`float` / `float-delayed` / `float-slow`, `pulse-glow`, `slide-up`, `fade-in`,
`shimmer`, `gradient-shift`.

---

## Environment Variables

### Next.js app (`.env`)

| Variable                    | Required | Description |
| --------------------------- | -------- | ----------- |
| `DATABASE_URL`              | Yes      | Neon Postgres connection string |
| `AUTH_SECRET`               | Yes      | HMAC key for the `fh_session` cookie. **Must match the Python service.** |
| `NEXT_PUBLIC_IS_DEMO_MODE`  | No       | `true` serves client-side seed data; no DB, no API writes |
| `GOOGLE_CLIENT_ID` / `_SECRET` | No    | Google OAuth; falls back to a demo session when blank |
| `INTELLIGENCE_SERVICE_URL`  | No       | Base URL of the Python service. **Unset = link intelligence is off** (no localhost default — that would point a serverless deploy at itself). |
| `RAZORPAY_*`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | No | Billing |

### Intelligence service

See `services/intelligence/README.md` — `DATABASE_URL`, `AUTH_SECRET`,
`OPENAI_API_KEY` (optional), `EMBED_DIM`, `ALLOWED_ORIGIN`, `LOCAL_DEV_MODE`.

---

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Serve the production build
npm run lint         # ESLint
npm run db:push      # Apply src/db/schema.ts to the database
npm run db:studio    # Drizzle Studio

# Intelligence service (separate process)
cd services/intelligence && uvicorn main:app --reload --port 8000
```

`npm run lint` currently reports 5 pre-existing `react-hooks` errors (Hero,
SaveMemoryForm, ThemeToggle, useMemories, MemoryDashboard memoization). Treat that
as the baseline; don't let a change add to it.

---

## Conventions

1. **File naming:** components PascalCase (`Hero.tsx`); utils/libs/services camelCase (`urlDetection.ts`). Classes get their own PascalCase files (`MemoryService.ts`).
2. **Imports:** the `@/` alias maps to `src/`.
3. **Client components** need `'use client'`. Server-only modules import `'server-only'`.
4. **No inline styles** — Tailwind classes or CSS custom properties.
5. **Form state** uses explicit status unions (`'idle' | 'loading' | 'success' | 'error'`).
6. **Ownership:** every memory query is scoped by `userId`. Reads return empty rather than leaking; writes no-op without a user.
7. **Adding a platform:** add an entry to `utils/platforms.ts`, a rule to `utils/urlDetection.ts`, optionally an embed case in `utils/embed.ts` and a glyph in `PlatformIcon.tsx` (`hasIcon: true`). Grouping picks it up automatically.
8. **Session tokens carry `exp`.** The Python service rejects tokens without it — don't remove the claim from `session.ts`.

---

## Future Work

- Chrome extension for one-click saving
- WhatsApp / mobile capture
- LLM summarisation and auto-tagging (the `ai` plan's `searchType` is defined but not yet differentiated in code)
