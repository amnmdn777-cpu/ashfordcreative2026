-- 2026-05-22 — Sprint 1: portal request workflow.
--
-- New table that records when a sales rep (Candice) explicitly asks the
-- admin (founder) to hand-craft a prospect portal. Replaces the old
-- auto-on-lead-open creation flow.
--
-- Idempotent (IF NOT EXISTS / DO-block enum check) so re-running on a
-- partially-rolled environment is safe. Also re-created on every boot
-- by `ensureSchemaIntegrity` to survive Replit Republish journal drift
-- (see memory feedback_ashford_drizzle_journal_drift).

-- --- (1) Enum -----------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_request_status') THEN
    CREATE TYPE "portal_request_status" AS ENUM ('pending', 'handled');
  END IF;
END $$;

-- --- (2) Table ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "portal_requests" (
  "id"                   serial PRIMARY KEY,
  "lead_id"              integer NOT NULL,
  "requested_by_rep_id"  integer NOT NULL,
  "message"              text,
  "status"               "portal_request_status" NOT NULL DEFAULT 'pending',
  "handled_by_rep_id"    integer,
  "handled_at"           timestamptz,
  "created_at"           timestamptz NOT NULL DEFAULT now()
);

-- --- (3) Foreign keys ---------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_requests_lead_id_leads_id_fk'
  ) THEN
    ALTER TABLE "portal_requests"
      ADD CONSTRAINT "portal_requests_lead_id_leads_id_fk"
      FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_requests_requested_by_rep_id_sales_reps_id_fk'
  ) THEN
    ALTER TABLE "portal_requests"
      ADD CONSTRAINT "portal_requests_requested_by_rep_id_sales_reps_id_fk"
      FOREIGN KEY ("requested_by_rep_id") REFERENCES "sales_reps"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portal_requests_handled_by_rep_id_sales_reps_id_fk'
  ) THEN
    ALTER TABLE "portal_requests"
      ADD CONSTRAINT "portal_requests_handled_by_rep_id_sales_reps_id_fk"
      FOREIGN KEY ("handled_by_rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- --- (4) Indexes --------------------------------------------------------

CREATE INDEX IF NOT EXISTS "portal_requests_status_idx"
  ON "portal_requests" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "portal_requests_lead_idx"
  ON "portal_requests" ("lead_id");

CREATE INDEX IF NOT EXISTS "portal_requests_rep_idx"
  ON "portal_requests" ("requested_by_rep_id", "created_at" DESC);
