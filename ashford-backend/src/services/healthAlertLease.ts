import { db, healthAlertLeases } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Cross-replica lease for owner-paging dedupe.
 *
 * The in-process health monitor runs on every API replica. Without
 * coordination, an outage that takes down a shared dependency (Postgres,
 * Stripe) would page the owner once per replica. This helper uses an
 * `INSERT ... ON CONFLICT (alert_key) DO UPDATE ... WHERE expires_at <
 * now() RETURNING replica_id` pattern so exactly one replica wins the
 * claim for a given `alertKey` and the others suppress their page.
 *
 * The lease has an explicit TTL so a winner that crashes mid-incident
 * doesn't permanently block the next page — the next replica that tries
 * after `expires_at` takes over.
 *
 * Important failure mode: if Postgres itself is the failing dependency,
 * the lease query will throw. Callers must handle the `db-down` outcome
 * (see `healthMonitor.ts` — it falls back to a randomized hold-down for
 * that path; we do not silently swallow the error here).
 */

export type LeaseAcquisitionResult =
  | { acquired: true; reason: "ours" }
  | {
      acquired: false;
      reason: "held-by-other" | "db-down" | "schema-missing";
      error?: unknown;
    };

/**
 * Postgres SQLSTATE for "undefined_table". If we ever see this it means
 * the migration didn't run on this deploy — distinguishing it from a
 * generic db-down lets us scream loudly in logs (so on-call notices the
 * misconfig) instead of silently dropping into the random-hold-down
 * fallback path forever.
 */
const PG_UNDEFINED_TABLE = "42P01";

const isUndefinedTableError = (err: unknown): boolean => {
  // Drizzle wraps pg errors so the SQLSTATE code lives on `err.cause`,
  // not on the outer object. Walk both layers.
  const checkCode = (e: unknown): boolean => {
    if (!e || typeof e !== "object") return false;
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" && code === PG_UNDEFINED_TABLE;
  };
  if (checkCode(err)) return true;
  const cause = (err as { cause?: unknown })?.cause;
  return checkCode(cause);
};

export const tryAcquireHealthAlertLease = async (opts: {
  alertKey: string;
  replicaId: string;
  ttlMs: number;
}): Promise<LeaseAcquisitionResult> => {
  const expiresAt = new Date(Date.now() + opts.ttlMs).toISOString();
  try {
    const result = await db.execute<{ replica_id: string }>(sql`
      INSERT INTO ${healthAlertLeases} AS l (alert_key, replica_id, acquired_at, expires_at)
      VALUES (${opts.alertKey}, ${opts.replicaId}, now(), ${expiresAt}::timestamptz)
      ON CONFLICT (alert_key) DO UPDATE
        SET replica_id = EXCLUDED.replica_id,
            acquired_at = EXCLUDED.acquired_at,
            expires_at = EXCLUDED.expires_at
        WHERE l.expires_at < now()
      RETURNING replica_id
    `);
    const rows = result.rows ?? [];
    if (rows.length === 0) {
      // Conflict + the existing lease has not yet expired → another
      // replica owns this incident.
      return { acquired: false, reason: "held-by-other" };
    }
    const winner = rows[0]?.replica_id;
    if (winner === opts.replicaId) {
      return { acquired: true, reason: "ours" };
    }
    // Shouldn't happen — RETURNING reflects the row we just wrote — but
    // be defensive: if some other replica somehow won the race, treat it
    // as held-by-other.
    return { acquired: false, reason: "held-by-other" };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      // The migration for this table has not been applied on this
      // deploy. This is *not* a db-down condition (Postgres answered) —
      // it's a misconfiguration the operator must fix. We surface it as
      // its own outcome so callers can log/escalate distinctly. We do
      // NOT cascade into the randomized hold-down path here, because the
      // problem won't fix itself by waiting.
      logger.error(
        { err, alertKey: opts.alertKey, replicaId: opts.replicaId },
        "health-alert-lease: health_alert_leases table is missing — migration 0010 has not been applied. Multi-replica dedupe is DISABLED until this is fixed; pages will fan out N×.",
      );
      return { acquired: false, reason: "schema-missing", error: err };
    }
    logger.warn(
      { err, alertKey: opts.alertKey, replicaId: opts.replicaId },
      "health-alert-lease: claim query failed (likely db is the failing dependency)",
    );
    return { acquired: false, reason: "db-down", error: err };
  }
};

/**
 * Best-effort release. If Postgres is unreachable we silently swallow the
 * error — the lease will expire on its own via TTL.
 */
export const releaseHealthAlertLease = async (opts: {
  alertKey: string;
  replicaId: string;
}): Promise<void> => {
  try {
    await db.execute(sql`
      DELETE FROM ${healthAlertLeases}
      WHERE alert_key = ${opts.alertKey}
        AND replica_id = ${opts.replicaId}
    `);
  } catch (err) {
    logger.warn(
      { err, alertKey: opts.alertKey, replicaId: opts.replicaId },
      "health-alert-lease: release failed (will expire via TTL)",
    );
  }
};
