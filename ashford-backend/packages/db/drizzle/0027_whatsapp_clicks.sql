-- 0027_whatsapp_clicks.sql
-- Append-only log of clicks on the site's floating WhatsApp button.
-- The button hands the visitor off to wa.me/<Candice's number>; the
-- server only records the click metadata (template, page, locale,
-- session id, optional lead_id, UA, IP). Message content never reaches
-- the server because Candice's WhatsApp stays a regular personal
-- account (no Business API integration).
--
-- Per project convention (see memory: "Ashford prod migrations are
-- manual"), this file must be applied to BOTH dev and prod by hand —
-- it is not added to the Drizzle journal so Replit Republish won't
-- diff-drop the columns later.

CREATE TABLE IF NOT EXISTS "whatsapp_clicks" (
  "id"            serial PRIMARY KEY,
  "session_id"    varchar(64),
  "template_key"  varchar(64),
  "page_path"     varchar(256),
  "referrer"      varchar(512),
  "locale"        varchar(8),
  "lead_id"       integer REFERENCES "leads"("id") ON DELETE SET NULL,
  "user_agent"    varchar(512),
  "ip_address"    varchar(64),
  "note"          text,
  "clicked_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "whatsapp_clicks_clicked_idx"  ON "whatsapp_clicks" ("clicked_at");
CREATE INDEX IF NOT EXISTS "whatsapp_clicks_session_idx"  ON "whatsapp_clicks" ("session_id");
CREATE INDEX IF NOT EXISTS "whatsapp_clicks_template_idx" ON "whatsapp_clicks" ("template_key");
CREATE INDEX IF NOT EXISTS "whatsapp_clicks_lead_idx"     ON "whatsapp_clicks" ("lead_id");
