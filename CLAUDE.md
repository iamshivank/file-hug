@AGENTS.md

# File Hug

## Product Overview

File Hug is a SaaS application that acts as an AI-powered memory for everything users discover online. Users save reels, articles, ChatGPT conversations, memes, links, and ideas in one place, then search them later using natural language.

**Tagline:** Never lose something you wanted to remember.

**Alternative Tagline:** Your AI-powered memory for everything you discover online.

---

## Current State (Sprint 1 — Landing Page)

Sprint 1 is a **landing page only** release. There is:

- ✅ Landing page with 8 sections
- ✅ Waitlist form (name + email)
- ✅ MongoDB email storage via API
- ❌ No authentication
- ❌ No dashboard
- ❌ No AI features
- ❌ No payments
- ❌ No Chrome extension
- ❌ No WhatsApp integration

---

## Tech Stack

| Layer        | Technology                         |
| ------------ | ---------------------------------- |
| Framework    | Next.js 16.2.7 (App Router)       |
| Language     | TypeScript (strict)                |
| Styling      | TailwindCSS 4 + custom CSS tokens |
| Icons        | Lucide React                       |
| Database     | MongoDB via Mongoose 9             |
| Utilities    | clsx, tailwind-merge, class-variance-authority |
| Deployment   | Vercel-ready                       |

---

## Project Structure

```
file-hug/
├── .env.local                          # MONGODB_URI
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
│
└── src/
    ├── app/
    │   ├── layout.tsx                  # Root layout — Inter font, SEO metadata (title, OG, Twitter)
    │   ├── page.tsx                    # Landing page — assembles all 8 sections
    │   ├── globals.css                 # Design system — tokens, animations, utilities
    │   └── api/
    │       └── waitlist/
    │           └── route.ts            # POST /api/waitlist — validates & stores waitlist entries
    │
    ├── components/
    │   └── landing/
    │       ├── Hero.tsx                # Headline, gradient text, floating memory cards, dual CTAs
    │       ├── Problem.tsx             # 4 pain-point cards (lost reels, forgotten links, etc.)
    │       ├── Solution.tsx            # 3 pillars (Save/Find/Remember) + vertical timeline
    │       ├── Features.tsx            # 4 feature cards with gradient icons
    │       ├── HowItWorks.tsx          # 4-step numbered guide with connecting gradient line
    │       ├── Vision.tsx              # Natural language query examples
    │       ├── Waitlist.tsx            # Form with loading/success/error states
    │       └── Footer.tsx              # Logo, nav links, copyright
    │
    ├── lib/
    │   └── mongodb.ts                  # Mongoose singleton connection (HMR-safe global cache)
    │
    ├── models/
    │   └── Waitlist.ts                 # Mongoose schema — name, email (unique), createdAt
    │
    ├── repositories/
    │   └── waitlist.repository.ts      # Data access — create, findByEmail, count
    │
    ├── services/
    │   └── waitlist.service.ts         # Business logic — validation, duplicate check
    │
    ├── types/
    │   └── waitlist.types.ts           # WaitlistEntry, WaitlistFormData, ApiResponse<T>
    │
    ├── constants/
    │   └── index.ts                    # APP_NAME, APP_TAGLINE
    │
    ├── hooks/
    │   └── index.ts                    # Placeholder — custom hooks go here
    │
    └── utils/
        └── cn.ts                       # cn() — clsx + tailwind-merge utility
```

---

## Architecture

### Backend Pattern (Clean Architecture)

```
API Route → Service → Repository → Model → MongoDB
```

- **Types** (`types/`): Shared interfaces — no logic.
- **Models** (`models/`): Mongoose schemas and document interfaces.
- **Repositories** (`repositories/`): Data access layer — direct DB operations only.
- **Services** (`services/`): Business logic — validation, duplicate checks, error handling.
- **API Routes** (`app/api/`): HTTP layer — request parsing, response formatting, status codes.

### Frontend Pattern

- All landing page sections are in `components/landing/`.
- Client components use `'use client'` directive.
- Scroll animations use `IntersectionObserver` (no external animation library).
- The main `page.tsx` is a server component that composes all sections.

---

## API Reference

### `POST /api/waitlist`

Adds a user to the waitlist.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Responses:**

| Status | Body | Condition |
| ------ | ---- | --------- |
| 201 | `{ "success": true, "data": { "message": "Successfully joined the waitlist!" } }` | New entry created |
| 400 | `{ "success": false, "error": "..." }` | Validation failure or duplicate email |
| 500 | `{ "success": false, "error": "Internal server error..." }` | Unexpected error |

**Validations:**
- Name is required, max 100 characters.
- Email is required, must match `/^\S+@\S+\.\S+$/`.
- Duplicate email returns 400 (checked at app level + MongoDB unique index).

---

## MongoDB Schema

### Waitlist Collection

| Field     | Type   | Constraints                         |
| --------- | ------ | ----------------------------------- |
| `_id`     | ObjectId | Auto-generated                    |
| `name`    | String | Required, trimmed, max 100 chars    |
| `email`   | String | Required, trimmed, lowercase, unique, regex validated |
| `createdAt` | Date | Auto-generated via timestamps     |

**Indexes:** `{ email: 1 }` (unique)

---

## Design System

The design lives in `globals.css` and follows a **premium dark theme** aesthetic.

### Color Palette

| Token             | Value                           | Usage                    |
| ----------------- | ------------------------------- | ------------------------ |
| `--background`    | `#030014`                       | Page background          |
| `--foreground`    | `#e8e4f0`                       | Primary text             |
| `--primary`       | `#8b5cf6` (violet)              | Buttons, accents, links  |
| `--accent`        | `#06b6d4` (cyan)                | Secondary accent         |
| `--success`       | `#10b981` (emerald)             | Success states           |
| `--muted`         | `#6b7280`                       | Subdued text             |

### CSS Utility Classes

- `.glass` / `.glass-strong` — Glassmorphism cards with backdrop blur
- `.gradient-text` — Violet → cyan → emerald gradient on text
- `.gradient-border` — Animated gradient border via `::before` pseudo-element
- `.bg-grid` / `.bg-dots` — Subtle background patterns
- `.glow-orb` — Ambient blurred light orbs
- `.section-padding` — Responsive section padding (6rem → 10rem)

### Animations (via `@theme inline`)

- `float` / `float-delayed` / `float-slow` — Vertical floating (memory cards)
- `pulse-glow` — Opacity + scale pulsing
- `slide-up` — Entrance from below
- `fade-in` — Simple opacity entrance
- `shimmer` — Background shimmer sweep
- `gradient-shift` — Moving gradient background

---

## Environment Variables

| Variable      | Required | Default                              | Description         |
| ------------- | -------- | ------------------------------------ | ------------------- |
| `MONGODB_URI` | Yes      | `mongodb://localhost:27017/filehug`  | MongoDB connection string |

---

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build (Turbopack)
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Conventions

1. **File naming:** Components use PascalCase (`Hero.tsx`). Utilities, libs, and services use camelCase (`mongodb.ts`).
2. **Imports:** Use `@/` path alias (maps to `src/`).
3. **Client components:** Must have `'use client'` at top. All landing sections are client components (for animations).
4. **Server components:** `layout.tsx` and `page.tsx` are server components.
5. **No inline styles:** All styling through Tailwind classes or CSS custom properties in `globals.css`.
6. **Form state:** Uses React `useState` with explicit status types (`'idle' | 'loading' | 'success' | 'error'`).
7. **Error handling:** Services return `{ success, data?, error? }` — never throw to the API layer.

---

## Future Sprints (Not Yet Implemented)

These features are planned but **do not exist in code yet**:

- Sprint 2: Authentication (likely NextAuth/Clerk)
- Sprint 3: Dashboard with memory cards
- Sprint 4: Chrome extension for saving
- Sprint 5: AI-powered search and tagging
- Sprint 6: WhatsApp integration
- Sprint 7: Payments
