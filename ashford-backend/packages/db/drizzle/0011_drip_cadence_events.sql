-- Email v2 5-touch cold drip (Task 168):
--   Extend the `portal_event_type` enum so the reengagement sweep can
--   record one portal event per touch (J3/J7/J14/J30) plus a terminal
--   close marker. The legacy values (`reengagement_j3_email`,
--   `reengagement_j8_sms`, `reengagement_j15_rep_alert`) remain in place
--   so historical rows keep validating; the sweep maps the legacy SMS
--   events to the new email-only state machine in `listSentStages`.
--
--   IF NOT EXISTS guards make this safe to re-run during recovery and
--   safe against partial application across replicas.

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'reengagement_j7_email';
--> statement-breakpoint

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'reengagement_j14_email';
--> statement-breakpoint

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'reengagement_j30_email';
--> statement-breakpoint

ALTER TYPE "portal_event_type" ADD VALUE IF NOT EXISTS 'reengagement_sequence_closed';
