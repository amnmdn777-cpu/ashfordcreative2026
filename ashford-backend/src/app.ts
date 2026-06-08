import express, { type Express } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import adminRouter from "./routes/admin";
import adminCandidateQuizRouter from "./routes/admin/candidateQuiz";
import adminApprovalsRouter from "./routes/admin/approvals";
import adminMessagesRouter from "./routes/admin/messages";
import adminEditorialRouter from "./routes/admin/editorial";
import adminWhatsappRouter from "./routes/admin/whatsappClicks";
import adminPrepQueueRouter from "./routes/admin/prepQueue";
import adminApplyCurated20260520Router from "./routes/admin/applyCurated20260520";
import adminApplyCurated20260520ReviewsRouter from "./routes/admin/applyCurated20260520Reviews";
import adminMarkReady20260520BatchRouter from "./routes/admin/markReady20260520Batch";
import leadHealthRouter from "./routes/leadHealth";
import waitlistRouter from "./routes/waitlist";
import publicRouter from "./routes/public";
import shortLinksRouter from "./routes/public/shortLinks";
import portalTokenRouter from "./routes/public/portalToken";
import webhooksRouter from "./routes/webhooks";
import stripeWebhookRouter from "./routes/webhooks/stripe";
import resendWebhookRouter from "./routes/webhooks/resend";
import dialpadWebhookRouter from "./routes/webhooks/dialpad";
import textbeltWebhookRouter from "./routes/webhooks/textbelt";
import { logger } from "./lib/logger";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { recycleStaleClaims } from "./services/leads";

const app: Express = express();

app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — strict allow-list in production, permissive in development.
// Same-origin / non-browser callers (no `Origin` header) always pass; this
// keeps server-to-server, curl, and webhook callers working without listing
// them. See `lib/env.ts` for the `ALLOWED_ORIGINS` env var contract — and
// `docs/deploy.md` for the production hostnames that must be listed. The
// env module refuses to boot in production if the allow-list is empty, so
// `env.allowedOrigins` here is guaranteed to be either `null` (dev/permissive)
// or a non-empty `string[]`.
const corsOptions: cors.CorsOptions =
  env.allowedOrigins === null
    ? { origin: true, credentials: true }
    : {
        credentials: true,
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (env.allowedOrigins!.includes(origin)) return cb(null, true);
          logger.warn(
            { origin, allowed: env.allowedOrigins },
            "cors: rejected origin",
          );
          cb(new Error(`CORS: origin not allowed (${origin})`));
        },
      };
if (env.allowedOrigins !== null) {
  logger.info(
    { allowedOrigins: env.allowedOrigins },
    "cors: strict allow-list active",
  );
}
app.use(cors(corsOptions));
app.use(cookieParser());

// Stripe + Resend + DialPad + TextBelt webhooks need raw body — mount BEFORE
// express.json so it isn't consumed (each router applies its own express.raw/text on its
// specific path). DialPad's payload is a JWT in the body; Stripe + Resend
// (Svix) both verify HMAC over the raw bytes.
app.use("/api", stripeWebhookRouter);
app.use("/api", resendWebhookRouter);
app.use("/api", dialpadWebhookRouter);
app.use("/api", textbeltWebhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Short link redirect lives at the root path (`/s/:code`) so prospect-
// facing URLs are clean and brand-friendly. It is intentionally NOT under
// `/api`. Mounted before any other router so it can never be shadowed.
// We also keep a backwards-compatible alias at `/api/s/:code` so any
// previously-issued links (sent in past SMS/email) still resolve.
app.use(shortLinksRouter);
app.use("/api", shortLinksRouter);
app.use(portalTokenRouter);

app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", publicRouter);
app.use("/api", dashboardRouter);
app.use("/api", adminRouter);
app.use("/api", adminCandidateQuizRouter);
app.use("/api", adminApprovalsRouter);
app.use("/api", adminMessagesRouter);
app.use("/api", adminEditorialRouter);
app.use("/api", adminWhatsappRouter);
app.use("/api", adminPrepQueueRouter);
app.use("/api", adminApplyCurated20260520Router);
app.use("/api", adminApplyCurated20260520ReviewsRouter);
app.use("/api", adminMarkReady20260520BatchRouter);
app.use("/api/admin/lead-health", leadHealthRouter);
app.use("/api/waitlist", waitlistRouter);
app.use("/api", webhooksRouter);

// Sentry's Express error handler must be registered AFTER all controllers and
// BEFORE our own JSON error handler so it captures exceptions thrown inside
// route handlers. It is a no-op when Sentry was not initialized.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

// Recycle stale claims hourly (spec).
const RECYCLE_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  recycleStaleClaims().catch((err) =>
    logger.error({ err }, "recycleStaleClaims failed"),
  );
}, RECYCLE_INTERVAL_MS).unref();

// LOT 1.4 — portal lifecycle reconciler. Inline expire via
// updateLeadByRep handles the typical rep-disqualify path; this is
// the defensive net for: (a) lead.status mutated outside the helper
// (admin DB edits, future routes), (b) access tokens that aged past
// their expiry without a state update, (c) any 'recycled' leads
// (nothing currently transitions leads to 'recycled' but the hook
// is here so it'd be caught if a future path starts writing it).
// Hourly matches the recycle cadence; idempotency in
// expirePortalForLead makes overlapping runs safe.
import { reconcilePortalLifecycles } from "./services/portals";
const PORTAL_LIFECYCLE_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  reconcilePortalLifecycles()
    .then((r) => {
      if (r.byStatus > 0 || r.byTokenTimeout > 0) {
        logger.info(r, "portal lifecycle reconciler expired portals");
      }
    })
    .catch((err) =>
      logger.error({ err }, "reconcilePortalLifecycles failed"),
    );
}, PORTAL_LIFECYCLE_INTERVAL_MS).unref();

// Owner daily digest — checked every 5 minutes. Idempotent per UTC day; only
// sends once the configured hour has passed and only if OWNER_NOTIFICATION_EMAIL
// + a Resend key are set. See services/dailyDigest.ts.
import { sendDailyDigestIfDue } from "./services/dailyDigest";
import { sendFrontDeskScheduleDigestIfDue } from "./services/frontDeskScheduleDigest";
const DIGEST_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  sendDailyDigestIfDue().catch((err) =>
    logger.error({ err }, "sendDailyDigestIfDue failed"),
  );
  // LOT 3.B2 — daily_schedule_digest. frontDeskScheduleDigest gates on
  // env.frontDeskScheduleDigestHourUtc (default 7am UTC). The 5-minute
  // tick is the safety net — the helper is idempotent per recipient/day
  // via the inReplyToId sentinel so overlapping ticks never double-send.
  sendFrontDeskScheduleDigestIfDue().catch((err) =>
    logger.error({ err }, "sendFrontDeskScheduleDigestIfDue failed"),
  );
}, DIGEST_INTERVAL_MS).unref();

// LOT 3.B1 — google_business_presence sync stub. Hourly tick that
// runs the no-op syncAllGoogleBusiness so the cron is wired and
// observable from prod logs. TODO(gbp-sync): replace stub with real
// GBP API + Healthgrades pull.
import { syncAllGoogleBusiness } from "./services/googleBusinessSync";
const GBP_SYNC_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  syncAllGoogleBusiness().catch((err) =>
    logger.error({ err }, "syncAllGoogleBusiness failed"),
  );
}, GBP_SYNC_INTERVAL_MS).unref();

// #230 protection layer 2/3 — hourly external backup of lead_rep_notes.
// Dumps the table as CSV and emails it to OWNER_NOTIFICATION_EMAIL so the
// founder has a tamper-proof restore source even if the Neon project itself
// is destroyed (the 2026-05-13 root-cause scenario). See services/repNotesBackup.ts.
import { backupRepNotesNow } from "./services/repNotesBackup";
const REP_NOTES_BACKUP_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  backupRepNotesNow()
    .then((r) => {
      if (r.sent) logger.info(r, "repNotesBackup ran");
    })
    .catch((err) => logger.error({ err }, "backupRepNotesNow failed"));
}, REP_NOTES_BACKUP_INTERVAL_MS).unref();
// Kick once 30s after boot so the very first hour after a deploy is covered.
setTimeout(() => {
  backupRepNotesNow().catch((err) =>
    logger.error({ err }, "backupRepNotesNow (boot) failed"),
  );
}, 30_000).unref();

// CLEANUP C.1 — daily_schedule_digest. node-cron "0 7 * * 1-5" (7am Mon-Fri).
// Today the data source returns [] (see services/dailyScheduleDigest.ts for
// the TODO seam); the cron is wired live so it's observable from prod logs
// the moment a real calendar feed is plugged in.
import { startDailyScheduleDigest } from "./services/dailyScheduleDigest";
startDailyScheduleDigest();

export default app;
