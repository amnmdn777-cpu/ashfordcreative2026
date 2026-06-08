-- LOT 1.3a — split prospect-driven cart writes from rep-prepared / QA
-- writes so the rep dashboard's hot-lead signal can't be spoofed by an
-- attacker who lifted a portal token. Two changes:
--
--   1. `portal_carts.source` (varchar, default 'prospect'): every cart
--      write now records whether it came from a real prospect session
--      cookie or from an authenticated rep previewing the portal.
--      Hot-lead aggregation filters to 'prospect'.
--
--   2. `portal_prospect_sessions`: server-side store for the
--      ash_prospect_<slug> cookie. Cookie value never round-trips
--      raw — we store SHA-256(token) and compare. ip + ua captured on
--      first mint so the rep timeline can show "first opened from <ip>
--      on <browser>" without needing a separate join.
--
-- KNOWN: pre-migration carts (incl. some R6 QA tamper artifacts that
-- were reverted at the data level but whose events remain) default to
-- source='prospect'. We can't retroactively distinguish them. Going
-- forward every write carries its true source.

ALTER TABLE "portal_carts"
  ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT 'prospect';

ALTER TABLE "portal_carts"
  ADD CONSTRAINT "portal_carts_source_check"
  CHECK ("source" IN ('prospect', 'rep'));

CREATE TABLE IF NOT EXISTS "portal_prospect_sessions" (
  "id" serial PRIMARY KEY,
  "portal_id" integer NOT NULL
    REFERENCES "prospect_portals"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "ip" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "portal_prospect_sessions_portal_idx"
  ON "portal_prospect_sessions" ("portal_id");

-- Expression index so getHotLeadsForRep's filter on
-- metadata->>'source' = 'prospect' stays cheap as portal_events grows
-- (LOT 2.7 still has un-deduped `opened` events firing on each reload,
-- ~7x for one portal in a day per the merged-doc repro). TODO: run
-- `SELECT count(*) FROM portal_events` to confirm whether a partial
-- index (WHERE metadata->>'source' = 'prospect') would be tighter.
CREATE INDEX IF NOT EXISTS "portal_events_source_idx"
  ON "portal_events" ((metadata->>'source'));
