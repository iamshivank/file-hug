# File Hug 🫂

**Never lose something you wanted to remember.**

Your AI-powered memory for everything you discover online. Save reels, articles, ChatGPT conversations, memes, links and ideas in one place. Search them later using natural language.

---

## Sprint 1 — Landing Page

This is the first sprint of File Hug: a beautiful SaaS landing page with waitlist functionality.

### Features

- ✅ Premium dark-themed landing page
- ✅ Animated hero section with memory cards
- ✅ Problem / Solution storytelling
- ✅ Features showcase
- ✅ How It Works guide
- ✅ Future Vision section
- ✅ Waitlist form with validation
- ✅ MongoDB email storage
- ✅ REST API with proper error handling
- ✅ Fully responsive (mobile-first)
- ✅ Smooth scroll animations
- ✅ Social proof counter — live member count shown above the form
- ✅ Waitlist position reveal — shows your position number after joining

---

## Sprint 2 — Memory App (`/app`)

First working version of the product. Accessible from the "Try the demo app →" link on the landing page.

### App Features

- ✅ Save any URL or note with a single textarea
- ✅ Auto-detection of content type (URL vs note)
- ✅ Platform & subtype tag detection (see below)
- ✅ Memory cards with platform badge, content preview, tags, and relative timestamp
- ✅ Demo mode — pre-seeded sample data, no DB writes (`NEXT_PUBLIC_IS_DEMO_MODE=true`)
- ✅ Production mode — full MongoDB persistence (`NEXT_PUBLIC_IS_DEMO_MODE=false`)

### Platform Tag Detection

When a URL is saved, the service automatically identifies the platform and content subtype, then stores them as tags. This works for:

| Platform | Detected subtypes |
| -------- | ----------------- |
| Instagram | `reel`, `post`, `video`, `story`, `profile` |
| YouTube | `video`, `shorts`, `playlist`, `channel` |
| Twitter / X | `tweet`, `profile` |
| TikTok | `video`, `profile` |
| Reddit | `post`, `community` |
| GitHub | `repo`, `profile` |
| Medium | `article` |
| Other URLs | hostname-derived tag (e.g. `chatgpt`) |

**Examples:**

| URL pasted | Tags stored | Title |
| ---------- | ----------- | ----- |
| `instagram.com/reel/ABC` | `['instagram', 'reel']` | Instagram Reel |
| `instagram.com/p/XYZ` | `['instagram', 'post']` | Instagram Post |
| `instagram.com/john_doe` | `['instagram', 'profile']` | Instagram Profile |
| `youtube.com/watch?v=…` | `['youtube', 'video']` | YouTube Video |
| `youtube.com/shorts/…` | `['youtube', 'shorts']` | YouTube Short |
| `x.com/user/status/…` | `['twitter', 'tweet']` | Tweet |
| `tiktok.com/@user/video/…` | `['tiktok', 'video']` | TikTok Video |

The form also shows a live label as you type (e.g. **"Instagram Reel detected"**, **"YouTube Short detected"**) before saving.

### Demo Mode

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/filehug
# true = demo mode (pre-loaded sample data, no DB writes)
# false = production mode (real MongoDB, persists data)
NEXT_PUBLIC_IS_DEMO_MODE=true
```

### Memories API

#### `GET /api/memories`

Returns all saved memories sorted by most recent.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "memories": [
      {
        "_id": "...",
        "content": "https://www.instagram.com/reel/ABC/",
        "type": "url",
        "title": "Instagram Reel",
        "tags": ["instagram", "reel"],
        "createdAt": "2026-06-06T10:00:00.000Z"
      }
    ]
  }
}
```

#### `POST /api/memories`

Save a new memory. Platform, subtype, and tags are auto-generated server-side.

**Request:**

```json
{ "content": "https://www.instagram.com/reel/ABC/" }
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "memory": {
      "_id": "...",
      "content": "https://www.instagram.com/reel/ABC/",
      "type": "url",
      "title": "Instagram Reel",
      "tags": ["instagram", "reel"],
      "createdAt": "2026-06-06T10:00:00.000Z"
    }
  }
}
```

**Error Response (400):**

```json
{ "success": false, "error": "Content is required." }
```

---

## Tech Stack

| Layer       | Technology              |
| ----------- | ----------------------- |
| Framework   | Next.js 15 (App Router) |
| Language    | TypeScript (strict)     |
| Styling     | TailwindCSS 4           |
| Icons       | Lucide React            |
| Database    | MongoDB (Mongoose)      |
| Deployment  | Vercel-ready            |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### Setup

```bash
# Clone or navigate to the project
cd file-hug

# Install dependencies
npm install

# Configure environment
# Edit .env.local with your MongoDB URI
# Default: mongodb://localhost:27017/filehug

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env.local` file in the root (already included):

```env
MONGODB_URI=mongodb://localhost:27017/filehug
```

For MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/filehug?retryWrites=true&w=majority
```

---

## Project Structure

```text
src/
├── app/
│   ├── layout.tsx          # Root layout with SEO
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Design system
│   └── api/
│       └── waitlist/
│           └── route.ts    # POST /api/waitlist
├── components/
│   └── landing/
│       ├── Hero.tsx
│       ├── Problem.tsx
│       ├── Solution.tsx
│       ├── Features.tsx
│       ├── HowItWorks.tsx
│       ├── Vision.tsx
│       ├── Waitlist.tsx
│       └── Footer.tsx
├── lib/
│   └── mongodb.ts          # Database connection
├── models/
│   └── Waitlist.ts         # Mongoose model
├── repositories/
│   └── waitlist.repository.ts
├── services/
│   └── waitlist.service.ts
├── types/
│   └── waitlist.types.ts
└── utils/
    └── cn.ts               # Classname utility
```

---

## API Reference

### `GET /api/waitlist`

Returns the current number of waitlist members. Used by the frontend to show social proof.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "count": 47 }
}
```

---

### `POST /api/waitlist`

Add a user to the waitlist.

**Request:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "message": "Successfully joined the waitlist!",
    "position": 48
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "This email is already on the waitlist."
}
```

---

## Deployment

This project is Vercel-ready. Connect your repository to Vercel and add `MONGODB_URI` as an environment variable.

```bash
npm run build
```

---

## License

Private — All rights reserved.
