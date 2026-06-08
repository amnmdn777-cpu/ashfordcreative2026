-- Task #226: per-rep Dialpad OAuth — encrypted token storage.
--
-- This migration intentionally only contains the new
-- `rep_dialpad_credentials` table. Other schema drift between
-- `0011_drip_cadence_events` and the current `src/schema/index.ts`
-- (additional columns on leads/sales_reps/etc., the new calls + funnel
-- tables, the portal_event_type enum values) was applied to live
-- environments via `pnpm --filter @workspace/db run push` in earlier
-- tasks and is not re-applied here. Re-issuing those statements would
-- conflict on existing objects.
--
-- The drizzle snapshot in `meta/0012_snapshot.json` does still cover
-- the full schema, so subsequent `drizzle-kit generate` runs will diff
-- correctly from this point forward.

CREATE TABLE IF NOT EXISTS "rep_dialpad_credentials" (
"id" serial PRIMARY KEY NOT NULL,
"sales_rep_id" integer NOT NULL,
"access_token_enc" text NOT NULL,
"refresh_token_enc" text,
"expires_at" timestamp with time zone NOT NULL,
"dialpad_user_id" varchar(64) NOT NULL,
"dialpad_email" varchar(200),
"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "rep_dialpad_credentials_sales_rep_id_unique" UNIQUE("sales_rep_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rep_dialpad_credentials" ADD CONSTRAINT "rep_dialpad_credentials_sales_rep_id_sales_reps_id_fk" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."sales_reps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rep_dialpad_user_idx" ON "rep_dialpad_credentials" USING btree ("dialpad_user_id");
