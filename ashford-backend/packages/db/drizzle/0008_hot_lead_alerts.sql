-- Hot-lead alerting (Task 93):
--   Track the most recent moment a "hot lead" rep notification fired for
--   each portal. Used both for in-service deduplication (30-min cooldown
--   so a surge of opens doesn't spam the rep) and for the rep-side
--   "🔥 Hot" badge on the lead detail page (visible for 60 minutes after
--   the trigger). Nullable: null means a hot trigger has never fired.

ALTER TABLE "prospect_portals"
  ADD COLUMN IF NOT EXISTS "last_hot_alert_at" timestamp with time zone;
