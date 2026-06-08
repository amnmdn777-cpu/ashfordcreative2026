-- Round 8 portal trust:
--   1. Surface rep contact info (phone, email, avatar) in the prospect portal's
--      "Talk to a human" panel. All three columns are nullable so legacy rows
--      remain valid; the panel hides the corresponding tap-to-call /
--      tap-to-email button when the value is missing.
--   2. Extend the portal_event_type enum with two new trust-signal events
--      (`help_panel_open`, `faq_open`) so the rep timeline can surface when
--      a prospect is actively de-risking before reaching out.

ALTER TABLE "sales_reps"
  ADD COLUMN IF NOT EXISTS "phone" varchar(32);
--> statement-breakpoint

ALTER TABLE "sales_reps"
  ADD COLUMN IF NOT EXISTS "email" varchar(160);
--> statement-breakpoint

ALTER TABLE "sales_reps"
  ADD COLUMN IF NOT EXISTS "avatar_url" varchar(500);
--> statement-breakpoint

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'help_panel_open';
--> statement-breakpoint

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'faq_open';
