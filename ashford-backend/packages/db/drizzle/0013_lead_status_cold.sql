-- Add "cold" to lead_status enum. Reps use this state to park a lead
-- they don't want to lose track of but isn't ready to be worked right
-- now — distinct from "disqualified" (workflow-final) and "nurturing"
-- (actively worked). The lead remains claimed by the rep and the
-- stale-claim recycler ignores it.

DO $$ BEGIN
  ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'cold';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
