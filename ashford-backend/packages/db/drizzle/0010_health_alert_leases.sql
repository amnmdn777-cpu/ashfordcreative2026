-- Multi-replica owner-paging dedupe (Task 99):
--   When the API is scaled to N replicas, the in-process health monitor
--   would otherwise page the owner once per replica for the same incident.
--   This table backs a Postgres lease (`alert_key` PK + TTL on
--   `expires_at`) so the first replica to claim a key wins paging duty
--   and the rest suppress. See `services/healthAlertLease.ts` and
--   `services/healthMonitor.ts`.
--
--   When Postgres itself is the failing dependency the lease query throws;
--   the monitor explicitly falls back to a randomized hold-down for that
--   path (it does NOT use a Postgres advisory lock for the db-failure
--   case, by design). See the "Multi-replica dedupe" subsection of the
--   on-call runbook in replit.md.

CREATE TABLE IF NOT EXISTS "health_alert_leases" (
  "alert_key" varchar(128) PRIMARY KEY NOT NULL,
  "replica_id" varchar(128) NOT NULL,
  "acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
