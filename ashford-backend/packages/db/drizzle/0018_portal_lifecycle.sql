-- LOT 1.4 — portal lifecycle gate. Disqualified / won / recycled
-- leads must not continue to expose their personalized preview to the
-- public token URL. Adds a state column + does the one-shot backfill
-- inline so any portal whose lead is already in a terminal status
-- flips to 'expired' the moment this migration runs.
--
-- 'draft' is reserved for a follow-up that tightens "rep-only until
-- invite sent"; shipping it as a prospect gate today would silently
-- break the seed/demo flows that create-and-load portals immediately.
-- Default is 'sent' so existing live portals keep working.

CREATE TYPE "portal_lifecycle" AS ENUM ('draft', 'sent', 'expired');

ALTER TABLE "prospect_portals"
  ADD COLUMN IF NOT EXISTS "lifecycle_state" "portal_lifecycle"
    NOT NULL DEFAULT 'sent';

-- One-shot backfill: any portal whose lead is in a terminal status
-- right now is flipped to 'expired' and its access token is
-- invalidated (access_token_expires_at = now()). Lead 531 (Gail,
-- disqualified) is the named acceptance criterion in the merged doc;
-- this UPDATE is what flips her portal to 410 the moment the
-- migration runs.
UPDATE "prospect_portals"
SET
  "lifecycle_state" = 'expired',
  "access_token_expires_at" = now(),
  "updated_at" = now()
FROM "leads"
WHERE "leads"."id" = "prospect_portals"."lead_id"
  AND "leads"."status" IN ('disqualified', 'won', 'recycled');

CREATE INDEX IF NOT EXISTS "prospect_portals_lifecycle_idx"
  ON "prospect_portals" ("lifecycle_state");
