import { pgTable, serial, varchar, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const memoryTypeEnum = pgEnum('memory_type', ['url', 'note']);
export const planEnum = pgEnum('plan', ['free', 'pro', 'ai']);
export const subStatusEnum = pgEnum('sub_status', ['active', 'canceled', 'past_due']);

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

export type WaitlistRow = typeof waitlist.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
