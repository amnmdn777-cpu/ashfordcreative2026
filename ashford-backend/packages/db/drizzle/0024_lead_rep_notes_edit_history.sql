-- #231 rep-note edits (2026-05-14). Allow a rep to edit their own
-- note in-place while preserving the very first body for audit. The
-- panel was append-only until now; this opens an edit path but keeps
-- the original text behind a "modified" tag in the UI.
--
-- Columns:
--   - original_body: snapshot of the body at first edit (set once,
--     never overwritten on subsequent edits). NULL = never edited.
--   - edited_at: timestamp of the latest edit. NULL = never edited.
--
-- Ownership is enforced in the API (only the author rep can edit;
-- admins cannot — keeps the audit trail clean). The archive table
-- from migration 0022 still captures DELETEs untouched.

ALTER TABLE "lead_rep_notes"
  ADD COLUMN IF NOT EXISTS "original_body" text;

ALTER TABLE "lead_rep_notes"
  ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
