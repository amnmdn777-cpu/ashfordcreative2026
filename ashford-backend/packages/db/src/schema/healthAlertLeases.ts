import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Cross-replica lease used by `services/healthMonitor.ts` to make sure
 * exactly one API replica pages the owner per incident.
 *
 * Why a table (and not a Postgres advisory lock or a Redis lease):
 *   - Advisory locks vanish if Postgres itself is the failing dependency,
 *     which is the *common* case the in-process monitor exists to catch.
 *     The healthMonitor falls back to a randomized hold-down for that path
 *     (see `tryAcquireHealthAlertLease`); when Postgres is reachable we
 *     get clean dedupe, when it isn't we accept staggered duplicates.
 *   - We don't run Redis in this stack and the runbook explicitly rules
 *     out adding a new dependency just for paging dedupe.
 *
 * Rows are claimed with `INSERT ... ON CONFLICT (alert_key) DO UPDATE
 * ... WHERE expires_at < now()` so an expired lease (e.g. from a replica
 * that crashed mid-incident) gets handed off to the next replica that
 * tries. There's no background cleanup job — TTL + opportunistic takeover
 * keep the table small (one row per active incident, capped a few per day
 * in the worst case).
 */
export const healthAlertLeases = pgTable("health_alert_leases", {
  alertKey: varchar("alert_key", { length: 128 }).primaryKey(),
  replicaId: varchar("replica_id", { length: 128 }).notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type HealthAlertLease = typeof healthAlertLeases.$inferSelect;
