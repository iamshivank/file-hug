import { pgTable, serial, varchar, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const memoryTypeEnum = pgEnum('memory_type', ['url', 'note']);
export const planEnum = pgEnum('plan', ['free', 'pro', 'ai']);
export const subStatusEnum = pgEnum('sub_status', ['active', 'canceled', 'past_due']);
export const indexStatusEnum = pgEnum('index_status', ['pending', 'ready', 'failed']);

export const waitlist = pgTable('waitlist', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
  /** Why the last attempt failed; null once a run succeeds. */
  error: text('error'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WaitlistRow = typeof waitlist.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
export type MemoryIndexRow = typeof memoryIndex.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
