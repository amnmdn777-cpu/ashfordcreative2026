import { runHealthChecks } from "../routes/health";
import { notifyOwner } from "./notifications";
import { logger } from "../lib/logger";
import { Sentry, sentryEnabled } from "../lib/sentry";
import { env } from "../lib/env";
import {
  tryAcquireHealthAlertLease,
  releaseHealthAlertLease,
} from "./healthAlertLease";

/**
 * In-process self-monitor for `/api/healthz`.
 *
 * Why this exists
 * ---------------
 * `/api/healthz` returns 503 when Postgres or Stripe is unreachable, but
 * nothing was actually paging the on-call when those failures persisted.
 * This module closes that loop with zero external configuration: every
 * `HEALTH_MONITOR_INTERVAL_MS` it reruns the same check the load balancer
 * does, and after `HEALTH_MONITOR_FAILURE_THRESHOLD` consecutive failures
 * it pages the owner via the existing email + SMS fan-out and (if
 * configured) records a Sentry exception so Sentry alert rules can route
 * the same incident.
 *
 * Required companion: an external uptime check (currently a Replit
 * Scheduled Deployment running `scripts/src/healthWatchdog.ts`, see the
 * "External uptime check" subsection of the on-call runbook in
 * `replit.md`) hitting `/api/healthz` every minute. The external check
 * catches the case the in-process monitor cannot — the whole API
 * process being dead.
 *
 * Multi-replica dedupe
 * --------------------
 * Each replica runs this monitor independently. To stop N replicas from
 * each paging the same incident we use a Postgres-backed lease keyed by
 * `health.degraded:<sorted failed components>` (see
 * `services/healthAlertLease.ts`). The first replica to claim the lease
 * pages; the rest log "suppressed" and stay quiet. On recovery the
 * lease-holder pages `health.recovered`, deletes the lease, and the
 * cycle resets.
 *
 * The lease lives in Postgres, which is itself a monitored dependency.
 * If Postgres is the failing component the lease query throws — we
 * detect that and fall back to a *randomized hold-down* (each replica
 * sleeps a different small amount, then re-probes). If Postgres comes
 * back during the hold-down we retry the lease cleanly. If it stays
 * down, replicas page individually but staggered, which the runbook
 * explicitly accepts as the worst-case behavior. We do not silently
 * accept duplicate pages on the postgres-up path.
 */

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_THRESHOLD = 2;

/**
 * Lease TTL. Long enough that a sustained outage doesn't cause the same
 * incident to re-page when the lease expires mid-incident; short enough
 * that a winner that crashes hands off paging duty to another replica
 * within ~15 minutes. The recovered path explicitly releases the lease,
 * so the TTL only matters for crash/restart cases.
 */
const LEASE_TTL_MS = 15 * 60_000;

/**
 * Maximum sleep when Postgres itself is down and we can't use the lease.
 * Each replica picks a uniform random delay in [0, DB_DOWN_HOLDDOWN_MS).
 * Picking ~25s gives meaningful spread without blowing past one probe
 * interval — the next tick re-evaluates with fresh state.
 */
const DB_DOWN_HOLDDOWN_MS = 25_000;

/**
 * The recovered-lease TTL is intentionally much shorter than the
 * degraded-lease TTL: it only needs to survive long enough for every
 * replica that paged the same incident to converge through one or two
 * recovery ticks (~1–2 min). A short TTL means a *second* incident
 * with the same failed-component set, occurring shortly after recovery,
 * doesn't get its `health.recovered` page suppressed by the previous
 * incident's stale lease.
 *
 * We *also* explicitly release the recovered lease after sending. The
 * TTL is the safety net for the case where the release call can't reach
 * Postgres (e.g. db went down again immediately after recovery).
 */
const RECOVERED_LEASE_TTL_MS = 90_000;

const intervalMs = (() => {
  const raw = process.env.HEALTH_MONITOR_INTERVAL_MS;
  const n = raw ? Number(raw) : DEFAULT_INTERVAL_MS;
  return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_INTERVAL_MS;
})();

const failureThreshold = (() => {
  const raw = process.env.HEALTH_MONITOR_FAILURE_THRESHOLD;
  const n = raw ? Number(raw) : DEFAULT_THRESHOLD;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_THRESHOLD;
})();

let consecutiveFailures = 0;
let pagedAt: Date | null = null;
/**
 * Set to the lease key when *we* won the degraded lease (i.e. this
 * replica is the one that paged). Stays null when another replica won
 * and we suppressed our page; in that case we also won't try to send
 * `health.recovered` — only the original pager owns the recovery
 * announcement.
 *
 * In the db-down fallback path we may have paged without owning a
 * lease; we still set this so the recovery side knows to attempt a
 * post-hoc recovered-lease (which works once Postgres is back).
 */
let pagedAlertKey: string | null = null;
let pagedWithoutLease = false;
let running = false;
let timer: NodeJS.Timeout | null = null;

const replicaId =
  process.env.HOSTNAME ??
  process.env.REPLIT_DEPLOYMENT_ID ??
  `pid-${process.pid}`;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildAlertKey = (failed: string[]): string =>
  `health.degraded:${[...failed].sort().join(",")}`;

const buildRecoveredKey = (degradedKey: string): string =>
  degradedKey.replace(/^health\.degraded:/, "health.recovered:");

const dispatchDegradedNotifications = async (
  alertKey: string,
  failed: string[],
  checks: Record<string, string>,
  latencyMs: number,
  pagedWithoutLeaseLocal: boolean,
): Promise<void> => {
  const failedList = failed.join(", ");
  const detail = failed.map((k) => `${k}=${checks[k]}`).join(" | ");

  logger.error(
    {
      replicaId,
      consecutiveFailures,
      alertKey,
      pagedWithoutLease: pagedWithoutLeaseLocal,
      checks,
      failed,
    },
    "health-monitor: PAGING owner — sustained dependency failure",
  );

  try {
    await notifyOwner({
      type: "health.degraded",
      title: `API health DEGRADED on ${replicaId} (${failedList})`,
      body:
        `${failureThreshold} consecutive /healthz probes failed.\n` +
        `Failed components: ${failedList}\n` +
        `Detail: ${detail}\n` +
        (pagedWithoutLeaseLocal
          ? `Note: paged without cross-replica lease (db unreachable or lease table missing). ` +
            `You may receive one page per replica; treat them as the same incident.\n`
          : "") +
        `See the on-call runbook in replit.md.`,
    });
  } catch (err) {
    logger.error({ err }, "health-monitor: notifyOwner threw");
  }

  if (sentryEnabled()) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag("alert", "health.degraded");
        scope.setTag("replica", replicaId);
        scope.setLevel("error");
        scope.setContext("health", {
          checks,
          failed,
          consecutiveFailures,
          latencyMs,
          pagedWithoutLease: pagedWithoutLeaseLocal,
        });
        Sentry.captureException(
          new Error(
            `API health degraded: ${failedList} (replica ${replicaId})`,
          ),
        );
      });
    } catch (err) {
      logger.error({ err }, "health-monitor: Sentry capture threw");
    }
  }
};

const handleDegrade = async (
  failed: string[],
  checks: Record<string, string>,
  latencyMs: number,
): Promise<void> => {
  const alertKey = buildAlertKey(failed);

  // First attempt to claim the lease. If db is the failing component
  // this will return `db-down`; if the migration is missing we get
  // `schema-missing`; otherwise we get a clean ours/held-by-other.
  let lease = await tryAcquireHealthAlertLease({
    alertKey,
    replicaId,
    ttlMs: LEASE_TTL_MS,
  });

  if (lease.reason === "schema-missing") {
    // The lease table was never created on this deploy. The lease
    // helper already screamed about the misconfig at ERROR. Page
    // anyway (no dedupe possible) so the operator still hears about
    // the dependency failure. We do NOT set pagedAlertKey here, so
    // the recovery branch won't attempt a recovered-lease claim
    // that's also doomed to fail.
    pagedWithoutLease = true;
    pagedAt = new Date();
    await dispatchDegradedNotifications(
      alertKey,
      failed,
      checks,
      latencyMs,
      true,
    );
    return;
  }

  if (lease.reason === "db-down") {
    // Postgres is unreachable — we can't coordinate through it. Each
    // replica picks an independent random hold-down so that, in the
    // common case where the db blip recovers within ~25s, only the
    // earliest-out replica still sees a failure when it wakes up; it
    // then claims the (now-reachable) lease and the others see
    // held-by-other on their wake-up retry.
    const holdDownMs = Math.floor(Math.random() * DB_DOWN_HOLDDOWN_MS);
    logger.warn(
      { replicaId, alertKey, holdDownMs },
      "health-monitor: db unreachable for lease — applying randomized hold-down before paging",
    );
    await sleep(holdDownMs);

    // Re-probe — the dependency may have recovered while we slept.
    const recheck = await runHealthChecks();
    if (recheck.ok) {
      logger.info(
        { replicaId, holdDownMs },
        "health-monitor: dependency recovered during hold-down — abandoning page",
      );
      consecutiveFailures = 0;
      return;
    }

    lease = await tryAcquireHealthAlertLease({
      alertKey,
      replicaId,
      ttlMs: LEASE_TTL_MS,
    });

    if (lease.reason === "held-by-other") {
      logger.info(
        { replicaId, alertKey },
        "health-monitor: another replica claimed the lease during hold-down — suppressing duplicate page",
      );
      // We deliberately do NOT set pagedAlertKey here — the other
      // replica owns the recovered announcement.
      return;
    }

    if (lease.reason === "schema-missing") {
      // Postgres came back during the hold-down but the table is
      // missing — same deal as the first-attempt schema-missing path.
      pagedWithoutLease = true;
      pagedAt = new Date();
      await dispatchDegradedNotifications(
        alertKey,
        failed,
        checks,
        latencyMs,
        true,
      );
      return;
    }

    if (lease.reason === "db-down") {
      // Postgres is *still* down after the hold-down. We page anyway.
      // The runbook explicitly accepts staggered duplicates in this
      // worst-case path; the receiver's grouping window will collapse
      // most of them and the timestamps make the multi-page obvious.
      logger.warn(
        { replicaId, alertKey },
        "health-monitor: db still unreachable after hold-down — paging without lease (multi-replica duplicates possible)",
      );
      pagedWithoutLease = true;
    }
  } else if (lease.reason === "held-by-other") {
    logger.info(
      { replicaId, alertKey },
      "health-monitor: another replica owns this incident — suppressing duplicate page",
    );
    return;
  }

  pagedAt = new Date();
  // Only set pagedAlertKey when we actually own (or paged-without-lease
  // through the db-down path, where the recovery branch will best-effort
  // a recovered-lease once the db comes back).
  pagedAlertKey = alertKey;

  await dispatchDegradedNotifications(
    alertKey,
    failed,
    checks,
    latencyMs,
    pagedWithoutLease,
  );
};

const handleRecovery = async (
  checks: Record<string, string>,
  latencyMs: number,
): Promise<void> => {
  if (!pagedAt) return;
  const downForMs = Date.now() - pagedAt.getTime();
  const minutes = Math.max(1, Math.round(downForMs / 60_000));
  const degradedKey = pagedAlertKey;

  // Recovery dedupe: if we paged with a lease, claim a short-TTL
  // recovered-lease so a peer that *also* paged-without-lease (db-down
  // path) doesn't double-announce. If multiple replicas paged sans-lease,
  // the first one to reach this branch wins the recovered claim and the
  // others suppress.
  let recoveredKey: string | null = null;
  if (degradedKey) {
    recoveredKey = buildRecoveredKey(degradedKey);
    const recoveredLease = await tryAcquireHealthAlertLease({
      alertKey: recoveredKey,
      replicaId,
      ttlMs: RECOVERED_LEASE_TTL_MS,
    });
    if (recoveredLease.reason === "held-by-other") {
      // A peer beat us to it. Stay quiet and reset local state.
      logger.info(
        { replicaId, recoveredKey },
        "health-monitor: recovered already announced by another replica — suppressing duplicate recovered page",
      );
      pagedAt = null;
      pagedAlertKey = null;
      pagedWithoutLease = false;
      consecutiveFailures = 0;
      return;
    }
    if (
      recoveredLease.reason === "db-down" ||
      recoveredLease.reason === "schema-missing"
    ) {
      // Postgres is flaky on the recovered path itself, or the lease
      // table is missing. We can't dedupe; send recovered anyway. The
      // schema-missing case has already been logged at ERROR by the
      // helper; the db-down case is unexpected during recovery (we just
      // saw an OK probe) but we proceed rather than swallow the page.
      logger.warn(
        { replicaId, recoveredKey, reason: recoveredLease.reason },
        "health-monitor: recovered-lease unavailable — sending recovered page without dedupe",
      );
    }
  }

  logger.info(
    { replicaId, downForMs, checks, alertKey: degradedKey, latencyMs },
    "health-monitor: recovered",
  );

  try {
    await notifyOwner({
      type: "health.recovered",
      title: `API health recovered on ${replicaId}`,
      body: `All dependencies are reachable again after ~${minutes} min. Latency: ${latencyMs}ms.`,
    });
  } catch (err) {
    logger.error({ err }, "health-monitor: notifyOwner (recovered) threw");
  }

  // Free both leases so the next incident isn't blocked. Best effort —
  // TTL is the safety net. The recovered-lease release is what stops
  // a *second* incident with the same failed-component set, occurring
  // within the recovered TTL window, from having its recovered page
  // suppressed by this incident's stale lease.
  if (degradedKey) {
    await releaseHealthAlertLease({ alertKey: degradedKey, replicaId });
  }
  if (recoveredKey) {
    await releaseHealthAlertLease({ alertKey: recoveredKey, replicaId });
  }

  pagedAt = null;
  pagedAlertKey = null;
  pagedWithoutLease = false;
};

const tick = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const result = await runHealthChecks();

    if (result.ok) {
      await handleRecovery(result.checks as Record<string, string>, result.latencyMs);
      consecutiveFailures = 0;
      return;
    }

    consecutiveFailures += 1;
    logger.warn(
      {
        replicaId,
        consecutiveFailures,
        threshold: failureThreshold,
        checks: result.checks,
        failed: result.failed,
        latencyMs: result.latencyMs,
      },
      "health-monitor: probe failed",
    );

    // Re-attempt the lease/page on every failing tick at-or-past the
    // threshold *while we have not paged yet*. Once `pagedAt` is set
    // (either because we won the lease, or because we paged sans-lease
    // through the db-down fallback), this is a no-op until recovery.
    //
    // Why not gate on the exact threshold crossing? If the winning
    // replica dies mid-incident, its 15-min lease TTL expires; without
    // a retry here, every other replica would see `held-by-other` once
    // at the crossing, set pagedAt=null, and never try again — the
    // incident would silently lose its pager. Retrying each tick costs
    // one INSERT against the lease table per replica per minute, which
    // collapses to a single row of contention; the typical outcome is
    // a quick `held-by-other` response.
    if (consecutiveFailures >= failureThreshold && !pagedAt) {
      await handleDegrade(
        result.failed,
        result.checks as Record<string, string>,
        result.latencyMs,
      );
    }
  } catch (err) {
    // The probe itself shouldn't throw (runHealthChecks catches), but if
    // something upstream does, count it as a failure rather than crashing
    // the scheduler.
    consecutiveFailures += 1;
    logger.error(
      { err, consecutiveFailures, replicaId },
      "health-monitor: tick threw unexpectedly",
    );
  } finally {
    running = false;
  }
};

/**
 * Boots the health monitor. No-op when disabled or in tests so unit suites
 * don't have a stray interval keeping the process alive.
 *
 *   HEALTH_MONITOR_DISABLED=1            — off entirely
 *   HEALTH_MONITOR_INTERVAL_MS=60000     — probe cadence (min 5s)
 *   HEALTH_MONITOR_FAILURE_THRESHOLD=2   — pages after N consecutive failures
 *
 * Owner paging reuses `notifyOwner` (email via Resend + SMS via Twilio).
 * `health.degraded` and `health.recovered` are in the default
 * `OWNER_NOTIFICATION_TYPES` allow-list so no extra config is required to
 * route alerts; remove them from the env var to silence.
 */
export const startHealthMonitor = (): void => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.HEALTH_MONITOR_DISABLED === "1") {
    logger.info("health-monitor: disabled via HEALTH_MONITOR_DISABLED=1");
    return;
  }
  if (timer) return; // already armed

  // Cold-start stagger: don't probe immediately on boot — give Postgres
  // pools a moment to warm and Stripe DNS to resolve so the very first
  // tick isn't a flaky false positive that trips the threshold.
  const startupDelay = 15_000;
  timer = setTimeout(() => {
    void tick();
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
  }, startupDelay);

  // Operational drift guard: in-process monitoring can't detect total
  // process death (OOM, crash, deploy stuck). Operators must also wire
  // an external uptime checker against /api/healthz — see the runbook
  // in replit.md. Once configured, set EXTERNAL_HEALTH_MONITOR=<name>
  // (e.g. "replit-scheduled:health-watchdog") to acknowledge it; we log a
  // loud WARN in production until that env var is set so the gap is
  // visible in deploy logs and not silently forgotten.
  const externalMonitor = process.env.EXTERNAL_HEALTH_MONITOR;
  if (externalMonitor) {
    logger.info(
      { externalMonitor },
      "health-monitor: external uptime check acknowledged",
    );
  } else if (process.env.NODE_ENV === "production") {
    logger.warn(
      "health-monitor: EXTERNAL_HEALTH_MONITOR is not set — in-process monitoring cannot detect total process death. Configure an external uptime check against /api/healthz (see replit.md runbook) and set EXTERNAL_HEALTH_MONITOR=<tool>:<id> to silence this warning.",
    );
  }

  logger.info(
    {
      intervalMs,
      failureThreshold,
      replicaId,
      ownerEmail: Boolean(env.ownerNotificationEmail),
      ownerSms: Boolean(env.ownerNotificationSms),
      sentry: sentryEnabled(),
      externalMonitor: externalMonitor ?? null,
      leaseTtlMs: LEASE_TTL_MS,
      dbDownHolddownMs: DB_DOWN_HOLDDOWN_MS,
    },
    "health-monitor: armed",
  );
};

/** Test/diagnostic helpers — not used in normal runtime. */
export const __healthMonitorInternals = {
  getConsecutiveFailures: () => consecutiveFailures,
  isPaging: () => pagedAt !== null,
  getPagedAlertKey: () => pagedAlertKey,
  reset: () => {
    consecutiveFailures = 0;
    pagedAt = null;
    pagedAlertKey = null;
    pagedWithoutLease = false;
  },
};
