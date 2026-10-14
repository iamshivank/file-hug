import { pgTable, varchar, text, timestamp, pgEnum, boolean, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const memoryTypeEnum = pgEnum('memory_type', ['url', 'note']);
export const planEnum = pgEnum('plan', ['free', 'pro', 'ai']);
export const subStatusEnum = pgEnum('sub_status', ['active', 'canceled', 'past_due']);
export const indexStatusEnum = pgEnum('index_status', ['pending', 'ready', 'failed']);

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  image: text('image'),
  googleId: varchar('google_id', { length: 255 }),
  // scrypt hash for email/password accounts; null for Google-only users.
  passwordHash: text('password_hash'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  plan: planEnum('plan').notNull().default('free'),
  status: subStatusEnum('status').notNull().default('active'),
  razorpayOrderId: varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 255 }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memories = pgTable('memories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  content: text('content').notNull(),
  type: memoryTypeEnum('type').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
  linkedMemoryIds: text('linked_memory_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * What we learned by actually opening a saved link.
 *
 * One row per link memory (`memory_id` is the primary key, so re-indexing
 * upserts). The intelligence service owns the writes: it fetches the URL, parses
 * its metadata, pulls a transcript where one exists, and stores the result here
 * so search has real content to match against instead of just a bare URL.
 *
 * Two columns are deliberately absent from this Drizzle definition and are added
 * by `services/intelligence/migrations/002_memory_index.sql` instead, because
 * drizzle-pg has no type for either:
 *   - `search_tsv tsvector` — generated, indexed for full-text search
 *   - `embedding vector(N)` — pgvector column for semantic search
 * `drizzle-kit push` does not know about them; answer "no" if it ever offers to
 * drop them (the same caveat already applies to `memories`).
 */
export const memoryIndex = pgTable('memory_index', {
  memoryId: text('memory_id')
    .primaryKey()
    .references(() => memories.id, { onDelete: 'cascade' }),
  // Denormalised from `memories` so every index query can scope by owner
  // without a join.
  userId: text('user_id'),
  /** The URL that was fetched — after redirects, this is the final one. */
  url: text('url').notNull(),
  status: indexStatusEnum('status').notNull().default('pending'),
  /** The page's own title (OpenGraph/`<title>`), not File Hug's platform label. */
  pageTitle: text('page_title'),
  description: text('description'),
  siteName: varchar('site_name', { length: 200 }),
  author: varchar('author', { length: 200 }),
  imageUrl: text('image_url'),
  faviconUrl: text('favicon_url'),
  /** Caption/transcript text when the platform exposes one (e.g. YouTube). */
  transcript: text('transcript'),
  keywords: text('keywords').array().notNull().default(sql`ARRAY[]::text[]`),
  /** Everything above, flattened — the text that FTS and the embedding derive from. */
  searchText: text('search_text'),
  embeddingModel: text('embedding_model'),
  /** Why the last attempt failed; null once a run succeeds. */
  error: text('error'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per signed-in browser/device. The session cookie carries this row's id
 * as `sid`; a token whose row is missing, revoked or expired is refused, which is
 * what lets a user sign out other devices. Demo sessions never get a row.
 */
export const sessions = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [index('sessions_user_id_idx').on(t.userId)]);

export const feedbackKindEnum = pgEnum('feedback_kind', ['bug', 'idea', 'praise', 'other']);
export const feedbackStatusEnum = pgEnum('feedback_status', [
  'new',
  'reviewing',
  'planned',
  'done',
  'wont_fix',
]);

/**
 * Feedback left from the landing page or the app. Anonymous is allowed.
 *
 * Everything needed to act on it is captured at submit time — who sent it (and
 * on which plan), where they were, and what they were using — so a bug report
 * can be reproduced without a follow-up. `status` is for triage.
 */
export const feedback = pgTable('feedback', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  kind: feedbackKindEnum('kind').notNull().default('other'),
  /** Optional 1–5 "how's File Hug working for you?" */
  rating: integer('rating'),
  message: text('message').notNull(),
  status: feedbackStatusEnum('status').notNull().default('new'),

  // Who — null user fields for anonymous visitors.
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName: varchar('user_name', { length: 200 }),
  /** Reply-to address: what they typed, else their account email. */
  email: varchar('email', { length: 255 }),
  plan: planEnum('plan'),
  isDemo: boolean('is_demo').notNull().default(false),

  // Where — `landing` or `app`, and the page they came from.
  source: varchar('source', { length: 32 }),
  pageUrl: text('page_url'),

  // What they were using.
  device: varchar('device', { length: 100 }),
  userAgent: text('user_agent'),
  viewport: varchar('viewport', { length: 32 }),
  locale: varchar('locale', { length: 35 }),
  timezone: varchar('timezone', { length: 64 }),
  theme: varchar('theme', { length: 16 }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MemoryRow = typeof memories.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type FeedbackRow = typeof feedback.$inferSelect;
export type MemoryIndexRow = typeof memoryIndex.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
