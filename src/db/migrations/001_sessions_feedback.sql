-- Sessions (active devices) and feedback.
--
-- Mirrors the `sessions` and `feedback` definitions in src/db/schema.ts exactly,
-- so a later `npm run db:push` sees nothing to change. Additive and idempotent:
-- safe to run any number of times. Apply with `npm run db:migrate`.

DO $$ BEGIN
  CREATE TYPE "public"."feedback_kind" AS ENUM('bug', 'idea', 'praise', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."feedback_status" AS ENUM('new', 'reviewing', 'planned', 'done', 'wont_fix');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "user_agent" text,
  "ip" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" "feedback_kind" DEFAULT 'other' NOT NULL,
  "rating" integer,
  "message" text NOT NULL,
  "status" "feedback_status" DEFAULT 'new' NOT NULL,
  "user_id" text,
  "user_name" varchar(200),
  "email" varchar(255),
  "plan" "plan",
  "is_demo" boolean DEFAULT false NOT NULL,
  "source" varchar(32),
  "page_url" text,
  "device" varchar(100),
  "user_agent" text,
  "viewport" varchar(32),
  "locale" varchar(35),
  "timezone" varchar(64),
  "theme" varchar(16),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
