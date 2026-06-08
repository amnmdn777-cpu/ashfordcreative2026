-- Append-only rep-notes journal (#229 founder feedback 2026-05-11).
-- Replaces the single-textarea `leads.rep_notes` column with a
-- timestamped feed: each update is its own row, never edited or
-- deleted, so the rep can scroll back through every conversation,
-- follow-up, and detail in chronological order.

CREATE TABLE IF NOT EXISTS "lead_rep_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "author_rep_id" integer REFERENCES "sales_reps"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lead_rep_notes_lead_id_idx"
  ON "lead_rep_notes" ("lead_id");

-- Seed one entry per non-empty `leads.rep_notes` blob so nothing is
-- lost when the column goes away. Dated to `leads.updated_at` (best
-- proxy for "when the rep last touched these notes"). Author = the
-- claiming rep when one is still attached; NULL otherwise.
--
-- Spurious entries (rep_notes that are a byte-identical copy of the
-- imported Psychology Today profile in `leads.notes`) are filtered
-- out so the new feed doesn't start with stale import dumps — same
-- heuristic as the retired cleanupSpuriousRepNotes.ts script.
-- Guarded so the migration is idempotent: when re-run after `rep_notes`
-- has already been dropped (e.g. by the bootstrap script), the INSERT
-- below would otherwise error on the missing column.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'rep_notes'
  ) THEN
    INSERT INTO "lead_rep_notes" ("lead_id", "author_rep_id", "body", "created_at")
    SELECT
      l."id",
      l."claimed_by_rep_id",
      trim(l."rep_notes"),
      l."updated_at"
    FROM "leads" l
    WHERE
      l."rep_notes" IS NOT NULL
      AND length(trim(l."rep_notes")) > 0
      AND (
        l."notes" IS NULL
        OR trim(l."notes") <> trim(l."rep_notes")
      );
  END IF;
END $$;

ALTER TABLE "leads" DROP COLUMN IF EXISTS "rep_notes";
