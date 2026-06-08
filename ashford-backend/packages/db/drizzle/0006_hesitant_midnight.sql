-- Round 7 launch-blocking comms fixes:
--   1. Bilingual outbound (EN/ES) selected per lead -> add `locale` to leads
--   2. URL shortener used by SMS bodies + email CTAs -> new `short_links` table
--
-- Older tables in this codebase were applied via `drizzle-kit push --force`
-- and never journaled, so this migration intentionally only ships the schema
-- deltas introduced in this PR.

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "locale" varchar(5) DEFAULT 'en' NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "short_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(16) NOT NULL,
  "target_url" text NOT NULL,
  "lead_id" integer,
  "purpose" varchar(32),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "click_count" integer DEFAULT 0 NOT NULL,
  "last_click_at" timestamp with time zone,
  CONSTRAINT "short_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "short_links"
    ADD CONSTRAINT "short_links_lead_id_leads_id_fk"
    FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "short_links_lead_idx"
  ON "short_links" USING btree ("lead_id");
