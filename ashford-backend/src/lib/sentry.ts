import * as Sentry from "@sentry/node";
import { logger } from "./logger";

const dsn = process.env.SENTRY_DSN;
const release = process.env.SENTRY_RELEASE ?? process.env.REPLIT_DEPLOYMENT_ID;
const environment =
  process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

let initialized = false;

/**
 * Initialize Sentry for the API server. No-op when `SENTRY_DSN` is not set so
 * local development continues to work without exception tracking. Must be
 * called BEFORE any other application module is imported because Sentry's
 * Node integration patches `http`, `express`, etc. via auto-instrumentation.
 */
export const initSentry = (): void => {
  if (initialized) return;
  if (!dsn) {
    logger.info(
      "Sentry not initialized (SENTRY_DSN not set) — exception tracking disabled.",
    );
    return;
  }
  Sentry.init({
    dsn,
    release,
    environment,
    // Tracing disabled — we only want exceptions, not performance spans. The
    // default integrations (OnUncaughtException, OnUnhandledRejection,
    // RequestData via httpIntegration, LinkedErrors, etc.) remain enabled so
    // crashes outside the Express error path still reach Sentry and so route
    // handler exceptions carry request context. The OpenTelemetry packages
    // these pull in transitively are bundled into our esbuild output (see
    // build.mjs — `@opentelemetry/*` is intentionally NOT externalized).
    tracesSampleRate: 0,
    sendDefaultPii: false,
    registerEsmLoaderHooks: false,
  });
  initialized = true;
  logger.info({ environment, release }, "Sentry initialized");
};

export const sentryEnabled = (): boolean => initialized;

export { Sentry };
