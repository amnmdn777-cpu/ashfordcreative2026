-- #232 rep -> dev team uploads channel (2026-05-15). A rep submits
-- scripts (free-text), prices (structured), images + files for a lead
-- so the dev/admin team can build out the customization. Admin views
-- all submissions, can comment, tag another rep, mark processed/rejected.
--
-- Files are stored on the api-server's local filesystem under
-- UPLOAD_DIR/rep-lead-uploads/<uploadId>/<storedName>; only metadata
-- (original filename, mime, size, stored name) lives in the DB column
-- as a jsonb array.

CREATE TYPE "rep_lead_upload_status" AS ENUM (
  'pending',
  'processed',
  'rejected'
);

CREATE TABLE IF NOT EXISTS "rep_lead_uploads" (
  "id" serial PRIMARY KEY,
  "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "author_rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
  "scripts" text,
  "prices" jsonb,
  "files" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" "rep_lead_upload_status" NOT NULL DEFAULT 'pending',
  "admin_comment" text,
  "tagged_rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rep_lead_uploads_lead_id_idx"
  ON "rep_lead_uploads"("lead_id");

CREATE INDEX IF NOT EXISTS "rep_lead_uploads_status_idx"
  ON "rep_lead_uploads"("status");

CREATE INDEX IF NOT EXISTS "rep_lead_uploads_author_idx"
  ON "rep_lead_uploads"("author_rep_id");
