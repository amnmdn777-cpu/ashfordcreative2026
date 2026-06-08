-- [CLEANUP D.1] Editorial pipeline tables.
--
-- `article_schedule` — 14 article reminders per Concierge lead, seeded on
-- Stripe webhook activation. Editor sees pending rows in admin UI.
--
-- `editorial_posts` — the human-written article the editor types, linked
-- back to the schedule row that prompted it. Practitioners table does not
-- exist; everything anchors on leads.id.

DO $$ BEGIN
  CREATE TYPE "article_schedule_status" AS ENUM ('pending', 'written', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "editorial_post_status" AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "article_schedule" (
  "id" serial PRIMARY KEY,
  "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "due_date" date NOT NULL,
  "topic_hint" varchar(256),
  "status" "article_schedule_status" NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "article_schedule_lead_idx" ON "article_schedule" ("lead_id");
CREATE INDEX IF NOT EXISTS "article_schedule_due_idx" ON "article_schedule" ("due_date");

CREATE TABLE IF NOT EXISTS "editorial_posts" (
  "id" serial PRIMARY KEY,
  "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "schedule_id" integer REFERENCES "article_schedule"("id") ON DELETE SET NULL,
  "status" "editorial_post_status" NOT NULL DEFAULT 'draft',
  "title" varchar(256) NOT NULL,
  "slug" varchar(160) NOT NULL,
  "body_en" text NOT NULL DEFAULT '',
  "body_es" text NOT NULL DEFAULT '',
  "meta_description" varchar(320),
  "topic_brief" text,
  "due_date" date,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "editorial_posts_lead_idx" ON "editorial_posts" ("lead_id");
CREATE INDEX IF NOT EXISTS "editorial_posts_status_idx" ON "editorial_posts" ("status");
CREATE INDEX IF NOT EXISTS "editorial_posts_slug_idx" ON "editorial_posts" ("slug");
