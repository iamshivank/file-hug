import { pgTable, serial, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const memoryTypeEnum = pgEnum('memory_type', ['url', 'note']);

export const waitlist = pgTable('waitlist', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memories = pgTable('memories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  type: memoryTypeEnum('type').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
  linkedMemoryIds: text('linked_memory_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WaitlistRow = typeof waitlist.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
