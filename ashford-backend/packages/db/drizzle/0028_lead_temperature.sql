-- Rep-pickable temperature on every lead — disqualifier, cold,
-- lukewarm, hot. Different from `lead_status` (workflow state):
-- temperature is the rep's current read on conversion likelihood,
-- updated as conversations progress.
--
-- Migration policy: existing in-progress leads (status='claimed' or
-- 'nurturing') are seeded to 'hot' so Candice's current pipeline lands
-- in the right bucket day one. Cold/won/disqualified statuses leave the
-- temperature NULL because their workflow state already conveys it.

DO $$ BEGIN
  CREATE TYPE "lead_temperature" AS ENUM ('disqualifier', 'cold', 'lukewarm', 'hot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "temperature" "lead_temperature";

-- Backfill: every lead actively being worked is "hot" by default.
UPDATE "leads"
   SET "temperature" = 'hot'
 WHERE "temperature" IS NULL
   AND "status" IN ('claimed', 'nurturing');
