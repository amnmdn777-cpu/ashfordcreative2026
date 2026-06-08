-- 2026-05-14 audit fix #7: admin-level notifications for rep @-mentions
-- of the owner. Triggered server-side when a rep note body matches
-- /@Ashford\b/i; surfaced in the admin dashboard's hot-flags widget
-- and mirrored over email to the owner.

CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" varchar(64) NOT NULL,
  "lead_id" integer REFERENCES "leads"("id") ON DELETE SET NULL,
  "rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
  "body" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_notifications_unread_idx"
  ON "admin_notifications" ("read_at", "created_at" DESC);
