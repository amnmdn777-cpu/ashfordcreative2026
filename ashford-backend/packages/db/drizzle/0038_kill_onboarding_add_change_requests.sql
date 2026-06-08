-- 2026-05-21 — Streamline pass 2 (Sprint 1+2 re-applied on main).
--
-- Consolidates the Sprint 2 streamline decisions:
--   1. KILL client onboarding flow.
--   2. KILL rep training onboarding gate.
--   3. ADD change_requests (post-launch self-serve client → rep).
--
-- Note: numbered 0038 (not 0037) to avoid colliding with the existing
-- 0037_reset_test_invites.sql migration already on origin/main.
--
-- DROPs use IF EXISTS so re-running on a partially-rolled environment
-- is safe.

-- --- (1) Drop client onboarding -----------------------------------------

ALTER TABLE IF EXISTS "client_onboardings"
  DROP CONSTRAINT IF EXISTS "client_onboardings_sale_id_sales_id_fk";

DROP TABLE IF EXISTS "client_onboardings";
DROP TYPE  IF EXISTS "client_onboarding_status";

-- --- (2) Drop rep training onboarding -----------------------------------

ALTER TABLE IF EXISTS "onboarding_acknowledgments"
  DROP CONSTRAINT IF EXISTS "onboarding_acknowledgments_rep_id_sales_reps_id_fk";

DROP TABLE IF EXISTS "onboarding_acknowledgments";

ALTER TABLE "sales_reps"
  DROP COLUMN IF EXISTS "has_completed_onboarding";

-- --- (3) Create change_requests -----------------------------------------

CREATE TABLE IF NOT EXISTS "change_requests" (
  "id"            serial PRIMARY KEY,
  "lead_id"       integer NOT NULL,
  "portal_id"     integer,
  "body"          text NOT NULL,
  "status"        text NOT NULL DEFAULT 'open',
  "submitted_via" text NOT NULL DEFAULT 'portal',
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "resolved_at"   timestamptz,
  "resolved_by_rep_id" integer
);

CREATE INDEX IF NOT EXISTS "change_requests_lead_id_idx"
  ON "change_requests" ("lead_id");
CREATE INDEX IF NOT EXISTS "change_requests_status_idx"
  ON "change_requests" ("status");
CREATE INDEX IF NOT EXISTS "change_requests_created_at_idx"
  ON "change_requests" ("created_at" DESC);

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_lead_id_leads_id_fk"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_portal_id_prospect_portals_id_fk"
  FOREIGN KEY ("portal_id") REFERENCES "prospect_portals"("id") ON DELETE SET NULL;

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_resolved_by_rep_id_sales_reps_id_fk"
  FOREIGN KEY ("resolved_by_rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL;
