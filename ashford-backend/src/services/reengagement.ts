import {
  db,
  leads,
  prospectPortals,
  portalEvents,
  portalEventTypeEnum,
  salesReps,
} from "@workspace/db";
import { and, eq, inArray, isNull, lt, isNotNull, sql } from "drizzle-orm";
import { sendEmail } from "../integrations/resend";
import { notify } from "./notifications";
import { recordPortalEvent } from "./portals";
import { createShortLink } from "./shortLinks";
import { renderDripEmail, type DripTouch } from "./dripEmailRenderer";
import {
  buildPortalScreenshotUrl,
  capturePortalScreenshot,
} from "./templateScreenshot";
import { env } from "../lib/env";
import { TEXAS_TZ } from "../lib/texasTime";
import { logger } from "../lib/logger";

/**
 * Generic sender identity used when a lead is unclaimed (no assigned rep).
 * Drives the From-name alias, the email signature line, and the avatar
 * monogram in the renderer. Must NOT be a real personal name — those would
 * misrepresent who the prospect is hearing from.
 */
const GENERIC_SENDER_NAME = "Ashford Creative";
const GENERIC_SENDER_FIRST = "Ashford";

const DAY = 24 * 60 * 60 * 1000;
const J3_THRESHOLD = 3 * DAY;
const J7_THRESHOLD = 7 * DAY;
const J14_THRESHOLD = 14 * DAY;
const J30_THRESHOLD = 30 * DAY;

/**
 * Touch identifier kept in step with the canvas mockups (`day3`, `day7`,
 * `day14`, `day30`). Day 1 is sent at portal-invite time by `portalInvite.ts`
 * — this sweep only handles the four follow-up touches.
 */
type Stage = "j3_email" | "j7_email" | "j14_email" | "j30_email";

/**
 * Element type of the `portal_event_type` Postgres enum. Pulling it from
 * the schema keeps STAGE_EVENT (and the inArray() filter in
 * listSentStages) on the same literal-union Drizzle uses for the column,
 * so the query type-checks without any `as never` escape hatch.
 */
type PortalEventType = (typeof portalEventTypeEnum.enumValues)[number];

const STAGE_EVENT: Record<Stage, PortalEventType> = {
  j3_email: "reengagement_j3_email",
  j7_email: "reengagement_j7_email",
  j14_email: "reengagement_j14_email",
  j30_email: "reengagement_j30_email",
};

/** Friendly cadence used by logs and metric counters. */
const STAGE_TOUCH: Record<Stage, DripTouch> = {
  j3_email: "day3",
  j7_email: "day7",
  j14_email: "day14",
  j30_email: "day30",
};

/**
 * Cadence-ordered stage list. The sweep walks this in order and fires the
 * lowest-index unsent stage whose age threshold has been crossed — so a
 * portal that's already 35 days old with no prior events still fires J+3
 * first (not J+30), preserving the intended drip story even when leads are
 * back-filled or the scheduler was paused.
 */
const STAGE_ORDER: readonly { stage: Stage; thresholdMs: number }[] = [
  { stage: "j3_email", thresholdMs: J3_THRESHOLD },
  { stage: "j7_email", thresholdMs: J7_THRESHOLD },
  { stage: "j14_email", thresholdMs: J14_THRESHOLD },
  { stage: "j30_email", thresholdMs: J30_THRESHOLD },
];

const firstName = (full: string): string => {
  // Strip leading honorifics ("Dr.", "Dra.", "Mr.", "Ms.", "Mrs.",
  // "Mx.", "Prof.", "Rev.") — case-insensitive, optional trailing dot,
  // optional comma. This kept rendering "Dr. Dr." when the lead name
  // already started with "Dr." (founder feedback 2026-05-17: "What do
  // you mean Dr G?").
  const cleaned = full
    .trim()
    .replace(/^(?:dr|dra|mr|mrs|ms|mx|prof|rev)\.?\s+/i, "");
  // Split on whitespace AND commas so "Maya Alvarado, LCSW" → "Maya"
  // and "G. Carrera" → tokens=["G.","Carrera"].
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return full;
  // If the first token is a single letter — possibly followed by a dot
  // — it's almost certainly a middle/given initial like "G." or "J.M."
  // The intended first name lives in the NEXT token. Without this we
  // shipped "Dr. G" greetings for leads whose Psychology Today profile
  // is filed as "G. Carrera". Founder feedback 2026-05-17.
  const looksLikeInitial = (tok: string): boolean =>
    /^[A-Za-z]\.?$/.test(tok) || /^[A-Za-z](?:\.[A-Za-z])+\.?$/.test(tok);
  for (const tok of tokens) {
    if (looksLikeInitial(tok)) continue;
    return tok;
  }
  // All tokens are single-letter initials (e.g. "J. M.") — fall back
  // to the first one rather than returning the empty string, which
  // would render "Dr. ," in the drip email.
  return tokens[0]!;
};

/**
 * Returns the hour-of-day (0–23) for `now` in the prospect's local timezone
 * (`America/Chicago` — Texas, where ~all leads sit). Uses `formatToParts`
 * with `hour12: false` so we sidestep the "0" vs "24" ambiguity that
 * `format()` emits at midnight on some runtimes; `Number("24")` would
 * silently fall outside any sane window and freeze the cadence forever.
 */
const localHour = (now: Date, tz: string = TEXAS_TZ): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const h = Number(raw);
  // Some Intl impls (Node <22, older ICU) emit "24" for midnight. Normalize.
  if (h === 24) return 0;
  return h;
};

/**
 * Half-open membership test: hour ∈ [start, end). Exposed for unit tests
 * and the sweep gate. Open-rate research for healthcare-practice owners
 * shows a sharp lift when emails land before the morning's first
 * appointment block — gating the sweep on this window means a J+3 touch
 * that ages-in at 11pm waits until 8am the next morning instead of
 * shipping at midnight.
 */
export const isWithinSendWindow = (
  now: Date,
  startHour: number = env.reengagementSendWindow.startHour,
  endHour: number = env.reengagementSendWindow.endHour,
  tz: string = TEXAS_TZ,
): boolean => {
  const h = localHour(now, tz);
  return h >= startHour && h < endHour;
};

/**
 * Re-engagement sweep — runs the J+3 / J+7 / J+14 / J+30 touches of the cold-
 * prospect drip sequence. Each touch sends ONE email (no SMS — see Task #168
 * spec) using the per-touch HTML renderer in `dripEmailRenderer.ts`. After
 * J+30 fires, an additional `reengagement_sequence_closed` event is recorded
 * and the rep is notified that the draft has been retired.
 *
 * Idempotent: each stage is gated by its `reengagement_<stage>` portal event,
 * so a repeat sweep within the same day is a no-op.
 *
 * Dry-run: `REENGAGEMENT_DRY_RUN=1` makes the sweep PURE OBSERVATION — it
 * logs every would-fire decision but does NOT call `sendEmail`, does NOT
 * write portal events, and does NOT notify reps. Safe to run against any
 * environment, including production, without advancing or closing real
 * sequences. To validate cadence progression end-to-end, point the env at
 * a staging DB instead.
 */
export const runReengagementSweep = async (now: Date = new Date()): Promise<{
  scanned: number;
  j3Sent: number;
  j7Sent: number;
  j14Sent: number;
  j30Sent: number;
  sequenceClosed: number;
  deferredOutsideWindow: number;
  errors: number;
}> => {
  const startedAt = Date.now();
  const dryRun = process.env.REENGAGEMENT_DRY_RUN === "1";
  const { startHour, endHour } = env.reengagementSendWindow;
  const insideSendWindow = isWithinSendWindow(now, startHour, endHour);
  const candidates = await db
    .select({
      portalId: prospectPortals.id,
      slug: prospectPortals.slug,
      accessToken: prospectPortals.accessToken,
      leadId: prospectPortals.leadId,
      inviteSentAt: prospectPortals.inviteSentAt,
      lastOpenedAt: prospectPortals.lastOpenedAt,
      reservedAt: prospectPortals.reservedAt,
    })
    .from(prospectPortals)
    .where(
      and(
        isNotNull(prospectPortals.inviteSentAt),
        isNull(prospectPortals.lastOpenedAt),
        isNull(prospectPortals.reservedAt),
        // Only sweep portals invited at least 3 days ago.
        lt(prospectPortals.inviteSentAt, new Date(now.getTime() - J3_THRESHOLD)),
      ),
    );

  let j3Sent = 0;
  let j7Sent = 0;
  let j14Sent = 0;
  let j30Sent = 0;
  let sequenceClosed = 0;
  let deferredOutsideWindow = 0;
  let errors = 0;

  const counters: Record<Stage, number> = {
    j3_email: 0,
    j7_email: 0,
    j14_email: 0,
    j30_email: 0,
  };

  for (const c of candidates) {
    if (!c.inviteSentAt) continue;
    const ageMs = now.getTime() - c.inviteSentAt.getTime();
    try {
      const [lead] = await db.select().from(leads).where(eq(leads.id, c.leadId)).limit(1);
      if (!lead) continue;
      const sent = await listSentStages(c.portalId);

      // Terminal gate: only the explicit close event stops the portal
      // forever. Gating on `j30_email` would lock the lead into a
      // half-closed state if `closeSequence` failed transiently after
      // J30 sent — close would never retry on subsequent sweeps.
      if (sent.has("__closed__")) continue;

      // Retry path: J30 was emailed but the close signal didn't land
      // (transient DB or notify error). Re-attempt close without re-sending
      // any email. Live-only: dry-run skips here so it never writes events.
      if (sent.has("j30_email")) {
        if (dryRun) continue;
        await closeSequence(lead, c.slug);
        sequenceClosed++;
        continue;
      }

      // Walk the cadence oldest-first and fire the first stage that is both
      // unsent AND whose age threshold has been crossed. At most one touch
      // per portal per tick.
      const next = STAGE_ORDER.find(
        (s) => !sent.has(s.stage) && ageMs >= s.thresholdMs,
      );
      if (!next) continue;

      // Morning-window gate. Touches that come due outside the prospect's
      // local morning window (default 8am–11am Texas time) are deferred to
      // the next sweep tick — they will fire on the first hourly tick
      // after the window opens. The cadence/order is unchanged; only the
      // hour-of-day delivery shifts. Counter is logged so the team can see
      // how often the gate is firing.
      //
      // We deliberately gate AFTER the stage `find` (not before the
      // candidate query) so the deferred-counter reflects real touches
      // that would otherwise have shipped at a bad hour, not just every
      // candidate scanned.
      if (!insideSendWindow) {
        deferredOutsideWindow++;
        continue;
      }

      const fired = await runStage(
        lead,
        c.slug,
        c.accessToken,
        next.stage,
        dryRun,
      );
      if (!fired) continue;

      if (dryRun) {
        counters[next.stage]++;
        if (next.stage === "j30_email") sequenceClosed++;
        continue;
      }

      await recordPortalEvent(c.slug, {
        eventType: STAGE_EVENT[next.stage] as never,
        metadata: { ageDays: Math.floor(ageMs / DAY) },
      });
      counters[next.stage]++;

      if (next.stage === "j30_email") {
        // Wrap close in its own try so a close failure doesn't poison the
        // outer error counter for THIS lead — J30 already shipped, retry
        // happens on next sweep via the `sent.has("j30_email")` branch above.
        try {
          await closeSequence(lead, c.slug);
          sequenceClosed++;
        } catch (closeErr) {
          logger.warn(
            { err: closeErr, portalId: c.portalId, leadId: lead.id },
            "reengagement: J30 sent but close failed (will retry next sweep)",
          );
        }
      }
    } catch (err) {
      errors++;
      logger.warn({ err, portalId: c.portalId }, "reengagement: candidate failed");
    }
  }

  j3Sent = counters.j3_email;
  j7Sent = counters.j7_email;
  j14Sent = counters.j14_email;
  j30Sent = counters.j30_email;

  logger.info(
    {
      scanned: candidates.length,
      j3Sent,
      j7Sent,
      j14Sent,
      j30Sent,
      sequenceClosed,
      deferredOutsideWindow,
      insideSendWindow,
      sendWindow: `${startHour}-${endHour}`,
      errors,
      dryRun,
      ms: Date.now() - startedAt,
    },
    "reengagement sweep complete",
  );
  return {
    scanned: candidates.length,
    j3Sent,
    j7Sent,
    j14Sent,
    j30Sent,
    sequenceClosed,
    deferredOutsideWindow,
    errors,
  };
};

/**
 * Returns every stage that has been written to portal_events for this portal,
 * plus a synthetic `__closed__` marker when the sequence is terminal.
 *
 * Legacy event mapping (old SMS-based cadence):
 *   - `reengagement_j8_sms` → marks `j7_email` as done. The legacy J8 SMS
 *     sat between the new J7 and J14 touches; treating it as a J7 placeholder
 *     prevents duplicate J3/J7 emails to leads who already received the
 *     legacy SMS, while still letting the cadence advance to J14/J30.
 *   - `reengagement_j15_rep_alert` → marks the sequence as `__closed__`.
 *     The legacy J15 was a terminal rep handoff; once it fired, the
 *     automated cadence was considered finished. Re-entering those leads
 *     into the new email cadence would re-contact prospects who were
 *     already escalated to a human rep.
 */
const listSentStages = async (
  portalId: number,
): Promise<Set<Stage | "__closed__">> => {
  // `portalEvents.eventType` is a Postgres enum (`portal_event_type`), not
  // text — `LIKE 'reengagement_%'` raised `operator does not exist:
  // portal_event_type ~~ unknown` once an hour from the scheduler. Use an
  // explicit IN-list of the four canonical reengagement event types plus
  // the two retained legacy aliases (mapped below) so the query stays on
  // the indexed enum column without any text cast.
  const rows = await db
    .select({ eventType: portalEvents.eventType })
    .from(portalEvents)
    .where(
      and(
        eq(portalEvents.portalId, portalId),
        inArray(portalEvents.eventType, [
          STAGE_EVENT.j3_email,
          STAGE_EVENT.j7_email,
          STAGE_EVENT.j14_email,
          STAGE_EVENT.j30_email,
          "reengagement_sequence_closed",
          "reengagement_j8_sms",
          "reengagement_j15_rep_alert",
        ] satisfies PortalEventType[]),
      ),
    );
  const out = new Set<Stage | "__closed__">();
  for (const r of rows) {
    if (r.eventType === STAGE_EVENT.j3_email) out.add("j3_email");
    if (r.eventType === STAGE_EVENT.j7_email) out.add("j7_email");
    if (r.eventType === STAGE_EVENT.j14_email) out.add("j14_email");
    if (r.eventType === STAGE_EVENT.j30_email) out.add("j30_email");
    if (r.eventType === "reengagement_sequence_closed") out.add("__closed__");
    if (r.eventType === "reengagement_j8_sms") out.add("j7_email");
    if (r.eventType === "reengagement_j15_rep_alert") out.add("__closed__");
  }
  return out;
};

/**
 * Builds a portal URL with the access token. Public endpoints reject any
 * request lacking the token, so re-engagement messages must include it.
 */
const portalUrl = (slug: string, accessToken: string) =>
  `${env.publicBaseUrl}/preview/${slug}?t=${encodeURIComponent(accessToken)}`;

/**
 * Sends one drip touch using the per-touch HTML renderer. Returns true when
 * the email was dispatched (or would have been dispatched in dry-run mode),
 * false when the lead is missing an email address. Errors propagate to the
 * outer sweep loop so the per-portal `errors` counter ticks correctly.
 */
const runStage = async (
  lead: typeof leads.$inferSelect,
  slug: string,
  accessToken: string,
  stage: Stage,
  dryRun: boolean,
): Promise<boolean> => {
  if (!lead.email) return false;

  // Resolve sender identity first — cheap (one indexed lookup) and used
  // by both the dry-run log and the live send path.
  const rep = lead.claimedByRepId
    ? (await db
        .select()
        .from(salesReps)
        .where(eq(salesReps.id, lead.claimedByRepId))
        .limit(1))[0]
    : null;
  const repFullName = rep?.displayName ?? GENERIC_SENDER_NAME;
  const repFirst = rep?.displayName
    ? firstName(rep.displayName)
    : GENERIC_SENDER_FIRST;
  const locale: "en" | "es" = lead.locale === "es" ? "es" : "en";

  // Dry-run is pure observation: NO short-link creation, NO Chromium
  // capture, NO email send, NO portal events. We only need enough state
  // to log the would-send decision (what stage, which lead, which sender).
  if (dryRun) {
    logger.info(
      { stage, leadId: lead.id, slug, sender: repFullName, locale },
      "[dry-run] reengagement: would send email (no side effects)",
    );
    return true;
  }

  const longUrl = portalUrl(slug, accessToken);
  const { url: shortUrl } = await createShortLink(longUrl, {
    leadId: lead.id,
    purpose: `reengagement_${STAGE_TOUCH[stage]}`,
  });

  // Pre-flight portal-screenshot capture: when it succeeds we embed the
  // public URL in the email; when it fails we pass `undefined` to the
  // renderer and the email ships without a hero (graceful degradation),
  // never with a broken-image link. The capture warms the on-disk cache
  // so the recipient's mail client gets an immediate response on fetch.
  let heroImageUrl: string | undefined;
  try {
    await capturePortalScreenshot(slug, accessToken);
    heroImageUrl = buildPortalScreenshotUrl(slug, accessToken);
  } catch (err) {
    logger.warn(
      { err, slug, leadId: lead.id, stage },
      "reengagement: hero capture failed — sending without hero",
    );
  }

  const rendered = renderDripEmail({
    touch: STAGE_TOUCH[stage],
    leadFirstName: firstName(lead.name),
    practice: lead.practice,
    repFirstName: repFirst,
    repFullName,
    locale,
    ctaUrl: shortUrl,
    heroImageUrl,
  });

  const result = await sendEmail({
    to: lead.email,
    subject: rendered.subject,
    body: rendered.textBody,
    htmlOverride: rendered.htmlBody,
    leadId: lead.id,
    repId: lead.claimedByRepId ?? undefined,
    fromRepDisplayName: repFullName,
    locale,
  });

  // sendEmail catches Resend errors and persists a `failed` row WITHOUT
  // throwing. If we returned true here, the caller would record the stage
  // event and lock the cadence forward — the lead would silently skip a
  // touch and never be retried. Treat only `sent` and `dev_skipped` as
  // success; `failed` causes the sweep to leave this stage unrecorded so
  // the next tick re-attempts the same touch.
  if (result.status === "failed") {
    logger.warn(
      { leadId: lead.id, slug, stage, emailMessageId: result.id },
      "reengagement: send returned failed — stage event withheld for retry",
    );
    return false;
  }
  return true;
};

/**
 * Records the `reengagement_sequence_closed` event and pings the assigned
 * rep so they know the draft is being archived. Only invoked from the live
 * sweep path — the dry-run branch in the caller short-circuits before
 * reaching here, so this function never writes events or notifies in
 * dry-run mode.
 */
const closeSequence = async (
  lead: typeof leads.$inferSelect,
  slug: string,
): Promise<void> => {
  // Notify FIRST, then record the terminal event. If we wrote the close
  // event before notifying and notify failed, the next sweep would see
  // `__closed__` in the sent set and skip the lead — the rep alert would
  // be permanently lost. By notifying first, a notify failure throws,
  // the close event is NOT written, and the J30-already-sent retry path
  // re-attempts both on the next sweep.
  if (lead.claimedByRepId) {
    await notify({
      repId: lead.claimedByRepId,
      type: "lead.sequence_closed",
      title: `Sequence closed for ${firstName(lead.name)}, draft archived.`,
      body: `${lead.practice} (${lead.city}) — never opened the preview after 30 days. Move to nurture or remove from the queue.`,
      linkUrl: `/leads/${lead.id}`,
    });
  } else {
    logger.info(
      { leadId: lead.id, slug },
      "reengagement: sequence closing (no rep to notify)",
    );
  }
  await recordPortalEvent(slug, {
    eventType: "reengagement_sequence_closed" as never,
    metadata: { closedAt: new Date().toISOString() },
  });
};

/**
 * Boots the periodic sweep. Runs every hour with a 5-min cold-start stagger.
 *
 * Multi-replica safety: each tick acquires a Postgres advisory lock
 * (pg_try_advisory_lock) before running the sweep, releasing it after.
 * Replicas that fail to acquire the lock skip the tick — only one replica
 * actually sends comms per hour, so we cannot duplicate emails even when the
 * API is horizontally scaled.
 */
const REENGAGEMENT_ADVISORY_LOCK_KEY = 0x6173_6872; // ascii "ashr"
let running = false;
export const startReengagementScheduler = (): void => {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.REENGAGEMENT_DISABLED === "1") {
    logger.info("reengagement scheduler disabled via REENGAGEMENT_DISABLED=1");
    return;
  }
  const intervalMs = 60 * 60 * 1000; // hourly
  const tick = () => {
    if (running) {
      logger.warn("reengagement: previous sweep still running, skipping tick");
      return;
    }
    running = true;
    void runReengagementSweepWithLock()
      .catch((err) => logger.error({ err }, "reengagement scheduler: tick failed"))
      .finally(() => {
        running = false;
      });
  };
  setTimeout(() => {
    tick();
    setInterval(tick, intervalMs);
  }, 5 * 60 * 1000);
  logger.info(
    {
      dryRun: process.env.REENGAGEMENT_DRY_RUN === "1",
      sendWindow: `${env.reengagementSendWindow.startHour}-${env.reengagementSendWindow.endHour}`,
      sendWindowTz: TEXAS_TZ,
    },
    "reengagement scheduler armed (hourly, advisory-lock guarded, morning-window gated)",
  );
};

/**
 * Wraps the sweep in a Postgres advisory lock acquisition. If another replica
 * already holds the lock for this tick window, we skip and log — that replica
 * is the one delivering comms this hour. The lock is released in a finally
 * so a thrown sweep never strands the lock.
 */
const runReengagementSweepWithLock = async (): Promise<void> => {
  const lockResult = await db.execute(
    sql`select pg_try_advisory_lock(${REENGAGEMENT_ADVISORY_LOCK_KEY}) as acquired`,
  );
  const acquired = (lockResult as unknown as { rows: { acquired: boolean }[] })
    .rows?.[0]?.acquired;
  if (!acquired) {
    logger.info(
      "reengagement: advisory lock held by another replica — skipping tick",
    );
    return;
  }
  try {
    await runReengagementSweep();
  } finally {
    try {
      await db.execute(
        sql`select pg_advisory_unlock(${REENGAGEMENT_ADVISORY_LOCK_KEY})`,
      );
    } catch (err) {
      logger.warn({ err }, "reengagement: advisory unlock failed");
    }
  }
};
