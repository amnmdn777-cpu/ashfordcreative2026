import type { Server } from "http";
import { logger } from "../lib/logger";
import { env, isProd } from "../lib/env";

/**
 * Boot-time CORS self-preflight.
 *
 * Why this exists
 * ---------------
 * The API refuses to boot in production without `ALLOWED_ORIGINS`, but a
 * *typo* in that env var (missing scheme, stray trailing slash, frontend
 * left off the list) boots fine and only manifests as the affected
 * frontend silently failing every cross-origin request. Hours can pass
 * before a human notices.
 *
 * To catch this on every deploy with no external CI infra, we run the
 * same OPTIONS preflight a real browser would send — once per expected
 * origin, against ourselves on `localhost:${PORT}` — immediately after
 * the server starts listening. If any preflight comes back without the
 * exact `Access-Control-Allow-Origin` echo and `Access-Control-Allow-
 * Credentials: true`, we log loudly and exit 1. Replit's startup health
 * probe at `/api/healthz` then fails and the deploy is rolled back
 * automatically.
 *
 * The "expected" list is `EXPECTED_FRONTEND_ORIGINS` (independent
 * source-of-truth). It is REQUIRED in production by env validation so
 * the check is always populated from a different source than the
 * `ALLOWED_ORIGINS` it's verifying — testing the list against itself
 * would never detect operator typos in hostnames.
 *
 * Skipped in development unless `EXPECTED_FRONTEND_ORIGINS` is
 * explicitly set (the dev cors policy is permissive). When set in dev
 * the check still runs, which is useful for testing the check itself
 * locally.
 *
 * The companion standalone script at `scripts/src/corsSmokeTest.ts` runs
 * the same logic from outside the process, useful for periodic drift
 * detection or a manual / CI sanity check after deploys.
 */

const PROBE_LABEL = "cors-boot-check";
const PER_REQUEST_TIMEOUT_MS = 5_000;

type Mismatch = {
  origin: string;
  reasons: string[];
  status: number | null;
};

const preflight = async (
  url: string,
  origin: string,
): Promise<Mismatch | null> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "OPTIONS",
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
        "User-Agent": `${PROBE_LABEL}/1.0`,
      },
    });
    const reasons: string[] = [];
    if (res.status < 200 || res.status >= 300) {
      reasons.push(`expected 2xx preflight, got ${res.status}`);
    }
    const allowOrigin = res.headers.get("access-control-allow-origin");
    if (allowOrigin === null) {
      reasons.push("missing Access-Control-Allow-Origin header");
    } else if (allowOrigin === "*") {
      reasons.push(
        "Access-Control-Allow-Origin is '*' (must echo the specific origin when credentials are allowed)",
      );
    } else if (allowOrigin !== origin) {
      reasons.push(
        `Access-Control-Allow-Origin echoed ${JSON.stringify(allowOrigin)}, expected ${JSON.stringify(origin)}`,
      );
    }
    const allowCreds = res.headers.get("access-control-allow-credentials");
    if (allowCreds === null) {
      reasons.push("missing Access-Control-Allow-Credentials header");
    } else if (allowCreds.toLowerCase() !== "true") {
      reasons.push(
        `Access-Control-Allow-Credentials is ${JSON.stringify(allowCreds)}, expected "true"`,
      );
    }
    if (reasons.length === 0) return null;
    return { origin, reasons, status: res.status };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? `network timeout after ${PER_REQUEST_TIMEOUT_MS}ms`
          : `network error: ${err.message}`
        : `network error: ${String(err)}`;
    return { origin, reasons: [reason], status: null };
  } finally {
    clearTimeout(t);
  }
};

const fail = (msg: string, details: Record<string, unknown>): never => {
  logger.error(details, `[${PROBE_LABEL}] ${msg}`);
  // Exit non-zero so the Replit startup health probe at `/api/healthz`
  // fails and the deployment is rolled back. This is the whole point of
  // the boot self-check: a bad cors config must not be allowed to serve
  // production traffic.
  process.exit(1);
};

/**
 * Run the boot-time CORS self-preflight.
 *
 * @param server - the listening http.Server (only used to read its bound
 *                 port — we always probe `127.0.0.1` regardless of what
 *                 the public hostname is).
 *
 * Behavior:
 *  - Dev with `EXPECTED_FRONTEND_ORIGINS` unset: no-op.
 *  - Otherwise (prod always, or dev with the var set):
 *      - Sanity: every entry in `EXPECTED_FRONTEND_ORIGINS` must be
 *        present in `ALLOWED_ORIGINS` (set comparison). If any is
 *        missing we exit 1 BEFORE issuing any HTTP requests.
 *      - Issue one OPTIONS preflight per expected origin against
 *        `localhost:${PORT}/api/healthz` in parallel. Any preflight
 *        that doesn't echo the exact origin or include
 *        `Access-Control-Allow-Credentials: true` exits 1.
 *
 * Exiting 1 in production fails the Replit startup health probe and
 * rolls the deploy back automatically.
 */
export const runCorsBootCheck = async (server: Server): Promise<void> => {
  const expected = env.expectedFrontendOrigins;
  if (expected === null || expected.length === 0) {
    // Dev-only path: var is unset and we're not in prod (env validation
    // would have thrown at import time otherwise). Nothing to check.
    return;
  }

  if (env.allowedOrigins === null || env.allowedOrigins.length === 0) {
    if (isProd) {
      // Should be unreachable — env validation throws when
      // ALLOWED_ORIGINS is empty in prod — but be defensive rather than
      // skip silently.
      fail(
        "ALLOWED_ORIGINS empty at boot self-check time; refusing to serve",
        {},
      );
    }
    // Dev with EXPECTED set but ALLOWED unset (permissive cors). The
    // self-preflight would still pass because permissive cors echoes
    // every origin, but we don't get to verify the real allow-list
    // logic. Log and continue.
    logger.warn(
      { expected },
      `[${PROBE_LABEL}] running in dev with EXPECTED_FRONTEND_ORIGINS set but ALLOWED_ORIGINS empty — cors policy is permissive so the self-check is mostly a no-op`,
    );
  } else {
    // Set-comparison sanity check first — cheap and catches the most
    // common typo case (missing scheme, trailing slash, frontend left
    // off the list) without making any HTTP request at all.
    const allowSet = new Set(env.allowedOrigins);
    const missing = expected.filter((o) => !allowSet.has(o));
    if (missing.length > 0) {
      fail(
        "EXPECTED_FRONTEND_ORIGINS contains origins not present in ALLOWED_ORIGINS — fix the env on the API deployment (see docs/deploy.md) and redeploy",
        {
          missing,
          allowedOrigins: env.allowedOrigins,
          expectedFrontendOrigins: expected,
        },
      );
    }
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    // AF_UNIX or not yet listening — we should have been called from
    // inside the listen callback, so this is a programmer error.
    fail("server has no inet address; cannot self-preflight", { address });
  }
  const port = (address as { port: number }).port;
  // 127.0.0.1 sidesteps any IPv6/dual-stack flakiness and bypasses the
  // public hostname (which doesn't matter — cors checks the Origin
  // header, not the request host).
  const url = `http://127.0.0.1:${port}/api/healthz`;

  logger.info(
    { url, expectedOriginCount: expected.length },
    `[${PROBE_LABEL}] preflighting self for each expected frontend origin`,
  );

  const mismatches = (
    await Promise.all(expected.map((o) => preflight(url, o)))
  ).filter((x): x is Mismatch => x !== null);

  if (mismatches.length === 0) {
    logger.info(
      { count: expected.length },
      `[${PROBE_LABEL}] OK — all expected frontend origins accepted with credentials`,
    );
    return;
  }

  fail(
    `${mismatches.length}/${expected.length} expected frontend origin(s) failed CORS preflight — refusing to serve traffic. Fix ALLOWED_ORIGINS / EXPECTED_FRONTEND_ORIGINS on the API deployment (see docs/deploy.md) and redeploy.`,
    {
      mismatches: mismatches.map((m) => ({
        origin: m.origin,
        status: m.status,
        reasons: m.reasons,
      })),
      allowedOrigins: env.allowedOrigins,
      expectedFrontendOrigins: env.expectedFrontendOrigins,
    },
  );
};
