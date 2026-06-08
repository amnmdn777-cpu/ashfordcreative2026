// Sentry MUST be initialized before importing the Express app so its Node
// auto-instrumentation can patch http/express. See `lib/sentry.ts`.
import { initSentry } from "./lib/sentry";
initSentry();

// Boot sequence is async because we hydrate Stripe credentials from the
// Replit connector BEFORE any module that depends on `env.ts` is imported.
// `env.ts` reads `process.env.STRIPE_SECRET_KEY` at module-load time, and
// 12 downstream modules import a synchronous `stripe` singleton derived
// from it. By awaiting hydration first and then dynamic-importing `app`,
// we avoid refactoring every call site to async. See `lib/stripeBootstrap.ts`.
async function bootstrap(): Promise<void> {
  const { hydrateStripeFromConnector } = await import(
    "./lib/stripeBootstrap"
  );
  const hydration = await hydrateStripeFromConnector();

  const { default: app } = await import("./app");
  const { logger } = await import("./lib/logger");
  const { startReengagementScheduler } = await import(
    "./services/reengagement"
  );
  const { startHealthMonitor } = await import("./services/healthMonitor");
  const { runCorsBootCheck } = await import("./services/corsBootCheck");
  const { ensureDemoPortalSeeded } = await import(
    "./services/demoPortalSeed"
  );
  const { ensureTrainingRepsSeeded } = await import(
    "./services/trainingRepsSeed"
  );
  const { ensureSchemaIntegrity } = await import(
    "./services/ensureSchemaIntegrity"
  );
  const { startStripeCatalogSyncScheduler } = await import(
    "./services/stripeCatalogSync"
  );
  const { startLeadScoreBackfill } = await import(
    "./services/leadScoreBackfill"
  );
  const { warmBrowserOnStartup } = await import(
    "./services/templateScreenshot"
  );
  const { startHeroImageBackfill } = await import(
    "./services/heroImageBackfill"
  );

  if (hydration.hydrated) {
    logger.info(
      { source: "replit_connector" },
      "Stripe credentials hydrated from Replit connector",
    );
  } else if (hydration.reason && hydration.reason !== "already_set") {
    logger.warn(
      { reason: hydration.reason },
      "Stripe credentials NOT hydrated from connector — payment features will degrade unless STRIPE_SECRET_KEY is set manually",
    );
  }

  const rawPort = process.env["PORT"];
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  // Bind with retry-on-EADDRINUSE: when this artifact's workflow restarts
  // after a code change, the previous Node process can hold the port for
  // a couple of seconds while it shuts down. Without this loop the new
  // process crashes on boot and the API stays down (took the prospect
  // portal offline once already — see Task #148). We retry the bind a
  // handful of times with a short delay; any other listen error is fatal.
  const MAX_BIND_ATTEMPTS = 6;
  const RETRY_DELAY_MS = 1000;

  async function bindWithRetry(): Promise<ReturnType<typeof app.listen>> {
    for (let attempt = 1; attempt <= MAX_BIND_ATTEMPTS; attempt++) {
      try {
        return await new Promise<ReturnType<typeof app.listen>>(
          (resolve, reject) => {
            const s = app.listen(port);
            s.once("listening", () => resolve(s));
            s.once("error", (err: NodeJS.ErrnoException) => {
              s.close(() => {
                /* swallow close errors during error path */
              });
              reject(err);
            });
          },
        );
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EADDRINUSE" && attempt < MAX_BIND_ATTEMPTS) {
          logger.warn(
            { port, attempt, maxAttempts: MAX_BIND_ATTEMPTS },
            "Port busy (EADDRINUSE) — previous process likely still releasing the port; retrying",
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw err;
      }
    }
    throw new Error(
      `Failed to bind port ${port} after ${MAX_BIND_ATTEMPTS} attempts (EADDRINUSE)`,
    );
  }

  const server = await bindWithRetry();

  logger.info({ port }, "Server listening");

  // Boot-time CORS self-preflight — see services/corsBootCheck.ts. In
  // production, refuses to keep serving (process.exit(1)) if the cors
  // allow-list doesn't echo the expected frontend origins, which fails
  // the Replit startup health probe and rolls the deploy back. No-op
  // in development.
  runCorsBootCheck(server).catch((bootCheckErr) => {
    logger.error(
      { err: bootCheckErr },
      "cors-boot-check threw unexpectedly",
    );
    process.exit(1);
  });
  startReengagementScheduler();
  startHealthMonitor();
  // Pushes our local PLANS + ADDONS catalog to Stripe as Products +
  // Prices on a 30s boot stagger, then once every 24h. Multi-replica
  // safe via Postgres advisory lock. See services/stripeCatalogSync.ts.
  startStripeCatalogSyncScheduler();
  // Catch-up scoring for any lead whose `lead_score` is still NULL.
  // Runs once ~60s after boot, advisory-lock guarded so multi-replica
  // deploys don't duplicate the work. Steady state: SELECT returns 0
  // rows. Critical on production after publish since data backfill is
  // not part of Replit's Publish flow. See services/leadScoreBackfill.ts.
  startLeadScoreBackfill();
  // Pre-warm headless Chromium so the FIRST preview email send doesn't
  // pay the 600-1200ms puppeteer.launch() cold-start. Non-blocking — a
  // failed warm logs and falls back to lazy boot on the first capture.
  // See services/templateScreenshot.ts for context.
  void warmBrowserOnStartup();
  // One-shot cleanup (#224): nulls historical
  // `prospectPortals.customizations.heroPhotoUrl` rows whose host is not
  // the prospect's own currentWebsite (disallowed third-party / Places
  // / Yelp heroes accepted under the older hint-only heuristic). New
  // writes are correct by construction; this only fixes legacy data.
  // Advisory-lock guarded, runs ~45s after boot.
  startHeroImageBackfill();
  // 2026-05-14: Self-healing schema. Replit Republish can DROP tables
  // whose migration isn't in the Drizzle journal (see memory
  // feedback_ashford_drizzle_journal_drift). admin_notifications was
  // a victim. Recreate drift-prone tables on every boot. Idempotent
  // (CREATE TABLE IF NOT EXISTS). Awaited because downstream features
  // (@Ashford rep tag) depend on it being present.
  await ensureSchemaIntegrity();
  // Idempotent: creates the public /preview demo portal if missing.
  // Non-blocking; failures are logged but don't crash the server.
  void ensureDemoPortalSeeded();
  // Idempotent: creates Candice + Veronica training reps if missing.
  // Non-blocking; failures are logged but don't crash the server.
  void ensureTrainingRepsSeeded();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("api-server bootstrap failed:", err);
  process.exit(1);
});
