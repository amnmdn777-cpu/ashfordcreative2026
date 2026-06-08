import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { stripe } from "../integrations/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Per-component timeout. The overall response budget is well under 1s; any
 * single check that hangs gets killed and counted as a failure so a load
 * balancer in front of us can route around an unhealthy instance instead
 * of blocking on a single dead dependency.
 */
const CHECK_TIMEOUT_MS = 800;

const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout after ${ms}ms`)),
        ms,
      ).unref(),
    ),
  ]);

export type ComponentStatus = "ok" | "skipped" | string;

export type HealthCheckResult = {
  ok: boolean;
  checks: {
    db: ComponentStatus;
    stripe: ComponentStatus;
    resend: ComponentStatus;
    textbelt: ComponentStatus;
    dialpad: ComponentStatus;
    improvmx: ComponentStatus;
  };
  failed: string[];
  latencyMs: number;
  time: string;
};

// Cheap config-presence probe for an outbound integration. Hitting these APIs
// on every healthz would (a) burn quota, (b) couple our up-state to theirs,
// and (c) blow the response budget. The probe instead asserts the credentials
// are configured; if the env var is missing the component reports "skipped"
// so non-prod environments stay green.
const configProbe = (
  name: string,
  envValue: string | undefined,
): Promise<"ok" | "skipped" | string> => {
  if (!envValue || !envValue.trim()) return Promise.resolve("skipped");
  return Promise.resolve("ok");
};

/**
 * Runs the per-dependency probes used by both `/api/healthz` and the in-process
 * health monitor (`services/healthMonitor.ts`). Exporting the same logic keeps
 * the monitor and the load-balancer probe in lock-step — what one sees as
 * "down", the other does too.
 *
 * Components:
 *   - `db`: `SELECT 1` against the primary connection pool. Required.
 *   - `stripe`: `accounts.retrieve()` — a cheap, authenticated call. Only
 *     required when `STRIPE_SECRET_KEY` is configured; otherwise reported
 *     as `skipped` and does not affect the overall status.
 */
export const runHealthChecks = async (): Promise<HealthCheckResult> => {
  const startedAt = Date.now();

  const dbPromise = withTimeout(
    db.execute(sql`SELECT 1`).then(() => "ok" as const),
    CHECK_TIMEOUT_MS,
    "db",
  );
  const stripePromise: Promise<"ok" | "skipped"> = stripe
    ? withTimeout(
        stripe.accounts.retrieve().then(() => "ok" as const),
        CHECK_TIMEOUT_MS,
        "stripe",
      )
    : Promise.resolve("skipped" as const);

  const resendPromise = configProbe("resend", process.env.RESEND_API_KEY);
  const textbeltPromise = configProbe("textbelt", process.env.TEXTBELT_API_KEY);
  const dialpadPromise = configProbe("dialpad", process.env.DIALPAD_API_KEY);
  const improvmxPromise = configProbe("improvmx", process.env.IMPROVMX_API_KEY);

  const [dbR, stripeR, resendR, textbeltR, dialpadR, improvmxR] =
    await Promise.allSettled([
      dbPromise,
      stripePromise,
      resendPromise,
      textbeltPromise,
      dialpadPromise,
      improvmxPromise,
    ]);

  const settled = (
    r: PromiseSettledResult<ComponentStatus>,
  ): ComponentStatus =>
    r.status === "fulfilled"
      ? r.value
      : (r.reason as Error)?.message ?? "failed";

  const checks = {
    db: settled(dbR),
    stripe: settled(stripeR),
    resend: settled(resendR),
    textbelt: settled(textbeltR),
    dialpad: settled(dialpadR),
    improvmx: settled(improvmxR),
  };

  const failed = Object.entries(checks)
    .filter(([, v]) => v !== "ok" && v !== "skipped")
    .map(([k]) => k);

  return {
    ok: failed.length === 0,
    checks,
    failed,
    latencyMs: Date.now() - startedAt,
    time: new Date().toISOString(),
  };
};

/**
 * Liveness + readiness probe used by the load balancer / external uptime
 * checks. Returns 200 only when every required component answers within
 * CHECK_TIMEOUT_MS, otherwise 503 so upstream traffic stops arriving at this
 * instance. See `runHealthChecks` above for component semantics.
 */
router.get("/healthz", async (_req, res) => {
  const result = await runHealthChecks();

  if (!result.ok) {
    logger.warn(
      {
        checks: result.checks,
        failedComponents: result.failed,
        latencyMs: result.latencyMs,
      },
      "healthz: one or more components failed",
    );
  }

  res.status(result.ok ? 200 : 503).json({
    status: result.ok ? "ok" : "degraded",
    time: result.time,
    checks: result.checks,
    failed: result.failed,
    latencyMs: result.latencyMs,
  });
});

export default router;
