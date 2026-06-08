-- Feature B (founder 2026-05-19): Preview Quality Check badge.
-- Adds rep-side validation state on every lead + an audit trail table
-- + a field-level lock list so validated leads survive re-enrichment.

DO $$ BEGIN
  CREATE TYPE "qc_status" AS ENUM ('none', 'validated', 'stale');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "qc_source" AS ENUM ('manual', 'script');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "qc_event_type" AS ENUM (
    'validated', 'invalidated', 'reset',
    'field_locked', 'field_unlocked', 'blocked_no_photo'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "qc_status" "qc_status" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "qc_validated_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "qc_validated_by" TEXT,
  ADD COLUMN IF NOT EXISTS "qc_cycles_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qc_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "qc_source" "qc_source",
  ADD COLUMN IF NOT EXISTS "qc_accepted_without_photo" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "lead_qc_events" (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES "leads"(id) ON DELETE CASCADE,
  event_type "qc_event_type" NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_qc_events_lead
  ON "lead_qc_events" (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS "lead_field_locks" (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES "leads"(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT NOT NULL,
  UNIQUE (lead_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_lead_field_locks_lead
  ON "lead_field_locks" (lead_id);
