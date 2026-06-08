-- [CLEANUP A.1] Add calendly_url + doxy_url to leads and subscriptions.
-- Practitioners table does not exist in this repo; therapist-facing URLs
-- live on the lead record (rep dashboard edits) and are mirrored to the
-- subscription on Stripe webhook activation.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "calendly_url" varchar(256);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "doxy_url" varchar(256);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "calendly_url" varchar(256);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "doxy_url" varchar(256);
