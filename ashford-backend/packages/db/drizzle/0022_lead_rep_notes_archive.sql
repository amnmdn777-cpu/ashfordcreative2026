-- #230 protection layer — Candice incident, 2026-05-13.
--
-- Three defenses bolted onto lead_rep_notes:
--
-- 1. `lead_rep_notes_archive` table mirrors the shape of lead_rep_notes
--    + audit metadata (deleted_at, deleted_by_pg_user). Rows are NEVER
--    deleted from this table by the app — only the founder can vacuum
--    manually if it grows too large.
--
-- 2. BEFORE DELETE row trigger copies every dying row into the archive
--    table before letting the DELETE through. This catches:
--    - the admin wipe-rep-notes endpoint (was the original incident),
--    - any direct `DELETE FROM lead_rep_notes` via psql/Drizzle Studio,
--    - any future bug that ends up calling delete on this table.
--
-- 3. BEFORE TRUNCATE statement trigger raises an exception, blocking
--    TRUNCATE entirely. Row-level DELETE triggers do NOT fire on
--    TRUNCATE — without this guard, `TRUNCATE lead_rep_notes` would
--    silently bypass the archive. The exception message tells the
--    operator to use DELETE if they really need to clear the table.

CREATE TABLE IF NOT EXISTS "lead_rep_notes_archive" (
  "archive_id"           serial PRIMARY KEY,
  "original_id"          integer NOT NULL,
  "lead_id"              integer NOT NULL,
  "author_rep_id"        integer,
  "body"                 text NOT NULL,
  "created_at"           timestamp with time zone NOT NULL,
  "deleted_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_by_pg_user"   text NOT NULL DEFAULT current_user,
  "deleted_by_app_actor" jsonb
);

CREATE INDEX IF NOT EXISTS "lead_rep_notes_archive_lead_idx"
  ON "lead_rep_notes_archive" ("lead_id");
CREATE INDEX IF NOT EXISTS "lead_rep_notes_archive_author_idx"
  ON "lead_rep_notes_archive" ("author_rep_id");
CREATE INDEX IF NOT EXISTS "lead_rep_notes_archive_deleted_at_idx"
  ON "lead_rep_notes_archive" ("deleted_at");

-- BEFORE DELETE row trigger — copies the row about to die into the
-- archive table. The optional `deleted_by_app_actor` is read from a
-- session-local config var the app sets via SET LOCAL inside the
-- transaction (see services/leads.ts setDeletionActor helper). If the
-- caller doesn't set it (raw psql, Drizzle Studio, migration scripts),
-- the column stays NULL — but the row is still archived.
CREATE OR REPLACE FUNCTION archive_lead_rep_note()
RETURNS TRIGGER AS $$
DECLARE
  actor jsonb;
BEGIN
  BEGIN
    actor := current_setting('app.deletion_actor', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    actor := NULL;
  END;
  INSERT INTO lead_rep_notes_archive (
    original_id, lead_id, author_rep_id, body, created_at, deleted_by_app_actor
  ) VALUES (
    OLD.id, OLD.lead_id, OLD.author_rep_id, OLD.body, OLD.created_at, actor
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_rep_notes_archive_trigger ON lead_rep_notes;
CREATE TRIGGER lead_rep_notes_archive_trigger
BEFORE DELETE ON lead_rep_notes
FOR EACH ROW
EXECUTE FUNCTION archive_lead_rep_note();

-- BEFORE TRUNCATE block — TRUNCATE skips DELETE triggers, so we hard-
-- refuse it. If a future migration genuinely needs to truncate the
-- table, drop this trigger first, run the truncate, then recreate it.
CREATE OR REPLACE FUNCTION block_truncate_lead_rep_notes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE on lead_rep_notes is blocked (#230 protection). Use DELETE so the archive trigger captures the rows. Drop the trigger explicitly if you really must truncate.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_rep_notes_block_truncate ON lead_rep_notes;
CREATE TRIGGER lead_rep_notes_block_truncate
BEFORE TRUNCATE ON lead_rep_notes
FOR EACH STATEMENT
EXECUTE FUNCTION block_truncate_lead_rep_notes();
