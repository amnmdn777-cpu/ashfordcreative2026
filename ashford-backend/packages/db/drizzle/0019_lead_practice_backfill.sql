-- LOT 2.1 — title-case "The Rapy" / "And Counseling" backfill.
-- Adds an audit/rollback column that holds the corrupted pre-backfill
-- value for any lead touched by scripts/backfillLeadPractices.ts.
-- NULL for leads that were never re-titled.

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "practice_original" varchar(255);
