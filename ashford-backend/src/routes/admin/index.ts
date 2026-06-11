import { Router, type IRouter } from "express";
import qcRouter from "./qc";
import portalRequestsRouter from "./portalRequests";
import { z } from "zod";
// 2026-05-21 — `clientOnboardings` table dropped (Sprint 2 streamline).
import { db, salesReps, leads, leadRepNotes, sales, subscriptions, contactRequests, customDevQuotes, adminAuditLog, emailMessages, funnelEvents, calls, callTranscripts, adminNotifications } from "@workspace/db";
import { TEMPLATES, PALETTES, CAPABILITIES, normalizeTemplateKey } from "@workspace/api-zod";
import { eq, sql, desc, isNotNull } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAdmin, requireAuth } from "../../middleware/requireAuth";
import { dateToIso } from "../../lib/serialize";
import { hashPassword } from "../../lib/password";
import { normalizePersonName } from "../../lib/normalizeName";
import { sendQuoteToProspect, setQuoteAmount, listAllQuotes } from "../../services/customDev";
import { QuoteCustomDevRequest } from "@workspace/api-zod";
import { getLeadTimeline, replyToAdminMention } from "../../services/leads";
import { backfillRecentCalls } from "../../services/dialpadCallSync";
import { writeAudit, snapshotKeys } from "../../services/auditLog";
import { reconcilePortalLifecycles } from "../../services/portals";
import {
  stripe,
  TAX_BEHAVIOR_EXCLUSIVE,
  TAX_CODE_SAAS_SETUP,
} from "../../integrations/stripe";
import { logger } from "../../lib/logger";
import { badRequest, notFound } from "../../lib/errors";
import { env, isProd } from "../../lib/env";
import { runEnrichmentForLead } from "../../integrations/enrichment/orchestrator";
import { ensurePortalForLead } from "../../services/portals";
import { buildLeadPortalView } from "../../services/leadPortalView";
import {
  isDialpadVoiceConfigured,
  isDialpadSmsConfigured,
  isDialpadSmsWebhookConfigured,
  isDialpadWebhookConfigured,
} from "../../integrations/dialpad";
import { checkDailyCostCap, dailyCostByRep } from "../../services/voiceCostCap";

const router: IRouter = Router();
router.use("/admin", requireAuth, requireAdmin);

/**
 * System-status probe surfaced to the admin UI to detect dangerous
 * misconfiguration without leaking secret values.
 *
 * `stripeWebhookConfigured` is `true` iff a `STRIPE_WEBHOOK_SECRET` is
 * present at request time. The admin app uses this together with `isProd`
 * to render a persistent red banner in production when the webhook is
 * not wired up — without that signal, a customer can pay and we silently
 * never trigger their onboarding (no record in DB, no welcome email).
 *
 * IMPORTANT: this endpoint MUST NOT return the secret value itself. We
 * only echo a boolean derived from `Boolean(env.stripeWebhookSecret)`.
 */
router.get(
  "/admin/system-status",
  asyncHandler(async (_req, res) => {
    // Voice readiness used to ride along on this endpoint (twilioVoice*
    // fields, then aliased to Dialpad after the 2026-04-28 migration).
    // Removed 2026-04-28 because the admin banner that consumed it was
    // shouting the wrong provider name at the founder. The voice readiness
    // signal still lives at /admin/diagnostics under voice.outboundReady,
    // which is correctly labeled "dialpad" and is what the dashboard
    // surfaces today.
    res.json({
      isProd,
      stripeWebhookConfigured: Boolean(env.stripeWebhookSecret),
      stripeConfigured: Boolean(stripe),
    });
  }),
);

/**
 * Operator-facing readiness probe for Comms (voice + SMS + email). Returns
 * env-presence booleans only — never the secret values themselves — so a
 * misconfigured production worker can be diagnosed at a glance from the
 * admin dashboard or via `curl`. Pairs with `/admin/system-status` which
 * focuses on Stripe; this endpoint focuses on the Dialpad/Resend providers.
 *
 * The `sms.missing` array enumerates which Dialpad env vars are missing
 * when `sms.outboundReady` is false, so the operator can see exactly what
 * to fix without grepping the code or having to read server logs.
 */
router.get(
  "/admin/diagnostics",
  asyncHandler(async (_req, res) => {
    const smsMissing: string[] = [];
    if (!env.dialpadApiKey) smsMissing.push("DIALPAD_API_KEY");
    if (!env.dialpadUserId) smsMissing.push("DIALPAD_USER_ID");
    if (!env.dialpadFromNumber) smsMissing.push("DIALPAD_FROM_NUMBER");

    const voiceMissing: string[] = [];
    if (!env.dialpadApiKey) voiceMissing.push("DIALPAD_API_KEY");
    if (!env.dialpadUserId) voiceMissing.push("DIALPAD_USER_ID");
    if (!env.dialpadFromNumber) voiceMissing.push("DIALPAD_FROM_NUMBER");

    res.json({
      isProd,
      voice: {
        provider: "dialpad",
        outboundReady: isDialpadVoiceConfigured(),
        webhookReady: isDialpadWebhookConfigured(),
        missing: voiceMissing,
      },
      sms: {
        provider: "dialpad",
        outboundReady: isDialpadSmsConfigured(),
        webhookReady: isDialpadSmsWebhookConfigured(),
        missing: smsMissing,
        // When true, outbound SMS sends will be persisted as `dev_skipped`
        // (no provider call). This is the most common silent failure
        // mode in production — a paid invite never reaches the lead.
        willSilentlySkip: !isDialpadSmsConfigured(),
      },
      email: {
        provider: "resend",
        outboundReady: Boolean(env.resendApiKey),
        missing: env.resendApiKey ? [] : ["RESEND_API_KEY"],
      },
      stripe: {
        configured: Boolean(stripe),
        webhookReady: Boolean(env.stripeWebhookSecret),
        // Mirror the shape of the voice/sms/email blocks so the admin
        // UI can render a single "missing creds" surface uniformly.
        // STRIPE_SECRET_KEY is sourced from the Replit Stripe connector
        // at boot, but a hard env var is still the supported override —
        // surface both states the same way.
        missing: [
          ...(stripe ? [] : ["STRIPE_SECRET_KEY"]),
          ...(env.stripeWebhookSecret ? [] : ["STRIPE_WEBHOOK_SECRET"]),
        ],
      },
    });
  }),
);

/**
 * Trailing-24h voice spend for the admin dashboard widget. Returns the
 * cap, current usage, and a per-rep breakdown so admins can see who's
 * driving the burn rate before the circuit-breaker trips.
 */
router.get(
  "/admin/voice-cost-today",
  asyncHandler(async (_req, res) => {
    const status = await checkDailyCostCap();
    const byRep = await dailyCostByRep();
    // Centralized cents→USD mapping so the admin UI never has to do its
    // own divide-by-100 (and so the wire contract is self-documenting).
    // The raw cents fields are also kept for any future internal callers.
    const spentUsd = status.usedCents / 100;
    const capUsd = status.capCents / 100;
    res.json({
      capUsd,
      spentUsd,
      remainingUsd: Math.max(0, capUsd - spentUsd),
      tripped: status.blocked,
      // Keep the cents-shaped fields for backwards compat / debugging.
      usedCents: status.usedCents,
      capCents: status.capCents,
      blocked: status.blocked,
      callCount: status.callCount,
      connectedMinutes: status.connectedMinutes,
      byRep: byRep.map((r) => ({
        repId: r.repId,
        repName: r.displayName,
        spentUsd: r.cents / 100,
        calls: r.calls,
        // Connected minutes (already rounded by the service) so the
        // admin "Voice today" widget can show "5 calls / 12 min" per rep
        // without re-deriving from raw seconds on the client.
        minutes: r.minutes,
      })),
    });
  }),
);

router.get(
  "/admin/dashboard",
  asyncHandler(async (_req, res) => {
    const startMonth = new Date();
    startMonth.setUTCDate(1);
    startMonth.setUTCHours(0, 0, 0, 0);
    const startPrevMonth = new Date(startMonth);
    startPrevMonth.setUTCMonth(startPrevMonth.getUTCMonth() - 1);

    const [salesThisMonth] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(sql`${sales.occurredAt} >= ${startMonth}`);

    const [activeSubs] = await db
      .select({
        count: sql<number>`count(*)::int`,
        mrr: sql<number>`coalesce(sum(${subscriptions.monthlyTotalCents}), 0)::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    const [openContacts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactRequests)
      .where(eq(contactRequests.status, "open"));

    const [openQuotes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customDevQuotes)
      .where(eq(customDevQuotes.status, "requested"));

    // Leads pool counts by status.
    const poolRows = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.status);
    const leadsPool: Record<string, number> = {
      available: 0,
      claimed: 0,
      nurturing: 0,
      won: 0,
      disqualified: 0,
      recycled: 0,
    };
    for (const r of poolRows) leadsPool[r.status] = r.count;

    // Churn this month: subs canceled in the current month.
    const [churnThisMonth] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(
        sql`${subscriptions.canceledAt} IS NOT NULL AND ${subscriptions.canceledAt} >= ${startMonth}`,
      );
    const [churnPrevMonth] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(
        sql`${subscriptions.canceledAt} IS NOT NULL AND ${subscriptions.canceledAt} >= ${startPrevMonth} AND ${subscriptions.canceledAt} < ${startMonth}`,
      );
    const activeAtMonthStart = (activeSubs?.count ?? 0) + (churnThisMonth?.count ?? 0);
    const churnRatePct =
      activeAtMonthStart > 0
        ? Math.round((1000 * (churnThisMonth?.count ?? 0)) / activeAtMonthStart) / 10
        : 0;

    // Top reps by sales this month.
    const topReps = await db
      .select({
        repId: sales.repId,
        username: salesReps.username,
        displayName: salesReps.displayName,
        salesCount: sql<number>`count(*)::int`,
        revenueCents: sql<number>`coalesce(sum(${sales.setupAmountCents} + ${sales.monthlyAmountCents}), 0)::int`,
      })
      .from(sales)
      .innerJoin(salesReps, eq(salesReps.id, sales.repId))
      .where(sql`${sales.occurredAt} >= ${startMonth}`)
      .groupBy(sales.repId, salesReps.username, salesReps.displayName)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const recentSales = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.occurredAt))
      .limit(20);

    res.json({
      salesThisMonth: salesThisMonth?.count ?? 0,
      activeSubscriptions: activeSubs?.count ?? 0,
      mrrCents: activeSubs?.mrr ?? 0,
      openContactRequests: openContacts?.count ?? 0,
      openCustomDevQuotes: openQuotes?.count ?? 0,
      leadsPool,
      churn: {
        thisMonth: churnThisMonth?.count ?? 0,
        previousMonth: churnPrevMonth?.count ?? 0,
        ratePct: churnRatePct,
      },
      topReps,
      recentSales: dateToIso(recentSales),
    });
  }),
);

router.get(
  "/admin/reps",
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(salesReps).orderBy(salesReps.id);
    res.json({
      reps: rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        role: r.role,
        promoCode: r.promoCode,
        hourlyRateCents: r.hourlyRateCents,
        isActive: r.isActive,
        // 2026-05-21 — `hasCompletedOnboarding` dropped (rep training gate killed).
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }),
);

const CreateRepRequest = z.object({
  username: z.string().min(2).max(64),
  displayName: z.string().min(2).max(128),
  password: z.string().min(8).max(128),
  role: z.enum(["rep", "admin"]).default("rep"),
  promoCode: z.string().min(2).max(12),
  hourlyRateCents: z.number().int().min(0).default(2500),
});

router.post(
  "/admin/reps",
  asyncHandler(async (req, res) => {
    const body = CreateRepRequest.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const [row] = await db
      .insert(salesReps)
      .values({
        username: body.username.toLowerCase(),
        displayName: body.displayName,
        passwordHash,
        role: body.role,
        promoCode: body.promoCode.toUpperCase(),
        hourlyRateCents: body.hourlyRateCents,
      })
      .returning();
    res.json({
      rep: {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        promoCode: row.promoCode,
      },
    });
  }),
);

router.get(
  "/admin/leads/import-template",
  (_req, res) => {
    res.type("text/csv").send(
      "name,practice,specialty,city,state,phone,email,current_website,locale\n" +
        "Jane Smith LCSW,Smith Counseling,LCSW,Austin,TX,5125550101,jane@example.com,janetherapy.com,en\n" +
        "Maria Lopez LMFT,Lopez Counseling,LMFT,Houston,TX,7135550199,maria@example.com,,es\n",
    );
  },
);

/**
 * One-shot maintenance endpoint: wipe every rep-note across every lead.
 * Founder kept this from the legacy single-textarea era so admins can
 * still reset the rep-notes feed when an import polluted it. With the
 * #229 journal model this truncates the `lead_rep_notes` table rather
 * than nulling a column.
 */
// LOT 1.6 — destructive admin actions require a server-side typed
// confirmation string, distinct per endpoint. The admin UI ships a
// button-disabled-until-match inline form (Leads.tsx), but THAT is
// UX only — a user with devtools can re-enable the button. The
// security boundary is here, in the zod.literal validation below.
// Distinct strings per endpoint also block the cross-pollination
// misclick (admin pastes "RESET" into the release form by accident).
const ReleaseConfirm = z.object({
  confirmation: z.literal("RELEASE", {
    errorMap: () => ({ message: "Type RELEASE to confirm." }),
  }),
});
const WipeNotesConfirm = z.object({
  confirmation: z.literal("RESET", {
    errorMap: () => ({ message: "Type RESET to confirm." }),
  }),
});

router.post(
  "/admin/leads/wipe-rep-notes",
  asyncHandler(async (req, res) => {
    const parsed = WipeNotesConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type RESET to confirm.", {
        code: "confirmation_required",
        expected: "RESET",
      });
    }
    // Snapshot the IDs being deleted into `before` so the audit row is
    // sufficient to reconstruct what was wiped (note bodies aren't
    // captured — they can be voluminous and the founder cares about
    // "which lead lost what" not the full prose). LOT 1.6 also wires
    // a double-confirm at both the UI and API layers.
    const beforeRows = await db
      .select({ id: leadRepNotes.id, leadId: leadRepNotes.leadId })
      .from(leadRepNotes);
    const deleted = await db.delete(leadRepNotes).returning({ id: leadRepNotes.id });
    await writeAudit(req, {
      action: "leads.wipe_rep_notes",
      targetType: "lead_rep_notes",
      targetId: null,
      before: { rows: beforeRows },
      after: { clearedCount: deleted.length },
    });
    res.json({ cleared: deleted.length });
  }),
);

/**
 * One-shot maintenance endpoint: release every currently-claimed lead back
 * to the pool. Founder fix #228 — after a "reset rep notes" sweep her own
 * My Leads list still contained dozens of stale claims. This endpoint
 * complements `wipe-rep-notes` by clearing the ownership side of the
 * relationship: status flips back to `available`, claim metadata is
 * nulled, and `last_activity_at` is reset so the lead score recalculator
 * treats them as fresh. Nurturing/won/disqualified rows are intentionally
 * left untouched — those are deliberate end-states the rep set.
 */
router.post(
  "/admin/leads/release-all-claims",
  asyncHandler(async (req, res) => {
    const parsed = ReleaseConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type RELEASE to confirm.", {
        code: "confirmation_required",
        expected: "RELEASE",
      });
    }
    // Snapshot (lead_id -> rep_id) BEFORE the update so the founder
    // has a manual-rollback path: the audit row carries every
    // (lead, rep) pair that was released. The confirmation gate
    // above and the UI inline-form together close the misclick
    // window the merged doc flagged.
    const beforeRows = await db
      .select({ id: leads.id, claimedByRepId: leads.claimedByRepId })
      .from(leads)
      .where(eq(leads.status, "claimed"));
    const result = await db
      .update(leads)
      .set({
        status: "available",
        claimedByRepId: null,
        claimedAt: null,
        claimExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(leads.status, "claimed"))
      .returning({ id: leads.id });
    await writeAudit(req, {
      action: "leads.release_all_claims",
      targetType: "leads",
      targetId: null,
      before: { claims: beforeRows },
      after: { releasedCount: result.length },
    });
    res.json({ released: result.length });
  }),
);

const ImportLeadsRequest = z.object({
  csv: z.string().min(20),
});

router.post(
  "/admin/leads/import",
  asyncHandler(async (req, res) => {
    const body = ImportLeadsRequest.parse(req.body);
    const lines = body.csv.trim().split(/\r?\n/);
    if (lines.length < 2) {
      res.json({ inserted: 0, errors: ["Empty CSV"] });
      return;
    }
    const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
    const required = ["name", "practice", "specialty", "city", "phone"];
    const missing = required.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      res.status(400).json({
        error: { code: "bad_csv", message: `Missing columns: ${missing.join(", ")}` },
      });
      return;
    }
    const idx = (k: string) => header.indexOf(k);
    let inserted = 0;
    let duplicates = 0;
    const errors: string[] = [];
    const normalizePhone = (p: string) => p.replace(/[^\d]/g, "");
    const normalizeEmail = (e: string | null) => (e ?? "").trim().toLowerCase();

    // Pre-load existing phone+email pairs once to dedupe efficiently.
    const existingRows = await db
      .select({ phone: leads.phone, email: leads.email })
      .from(leads);
    const existingKeys = new Set<string>();
    for (const r of existingRows) {
      existingKeys.add(`p:${normalizePhone(r.phone)}`);
      if (r.email) existingKeys.add(`e:${normalizeEmail(r.email)}`);
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const phone = cols[idx("phone")] ?? "";
      const email = idx("email") >= 0 ? cols[idx("email")] || null : null;
      const phoneKey = `p:${normalizePhone(phone)}`;
      const emailKey = email ? `e:${normalizeEmail(email)}` : null;
      if (existingKeys.has(phoneKey) || (emailKey && existingKeys.has(emailKey))) {
        duplicates++;
        continue;
      }
      try {
        const rawLocale =
          idx("locale") >= 0 ? (cols[idx("locale")] || "").trim().toLowerCase() : "";
        const locale = rawLocale === "es" ? "es" : "en";
        const [created] = await db
          .insert(leads)
          .values({
            // Run the doubled-token cleanup at write time so messy
            // CSVs ("Cynthia Los De Los Santos") land already clean
            // — sanitizeLeadForRep also runs it on read as a safety
            // net for legacy rows. See lib/normalizeName.ts.
            name: normalizePersonName(cols[idx("name")]),
            practice: cols[idx("practice")],
            specialty: cols[idx("specialty")],
            city: cols[idx("city")],
            state: idx("state") >= 0 ? cols[idx("state")] || "TX" : "TX",
            phone,
            email,
            locale,
            currentWebsite:
              idx("current_website") >= 0
                ? cols[idx("current_website")] || null
                : null,
          })
          .returning({ id: leads.id });
        existingKeys.add(phoneKey);
        if (emailKey) existingKeys.add(emailKey);
        inserted++;
        // Fire-and-forget: bootstrap a portal and run enrichment so the
        // lead is sales-ready by the time a rep opens it. Both branches are
        // soft-fail — they log on error but never block the import response
        // (which is the user's interactive feedback path).
        if (created?.id) {
          void ensurePortalForLead(created.id).catch((err) =>
            logger.warn(
              { err, leadId: created.id },
              "lead-import: portal bootstrap failed",
            ),
          );
          void runEnrichmentForLead(created.id, "auto").catch((err) =>
            logger.warn(
              { err, leadId: created.id },
              "lead-import: auto-enrichment failed",
            ),
          );
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    res.json({ inserted, duplicates, errors });
  }),
);

// PATCH /admin/reps/:id — disable/update a rep.
const PatchRepRequest = z.object({
  displayName: z.string().min(2).max(128).optional(),
  promoCode: z.string().min(2).max(12).optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["rep", "admin"]).optional(),
});

const REP_AUDIT_KEYS = [
  "displayName",
  "promoCode",
  "hourlyRateCents",
  "isActive",
  "role",
] as const;

router.patch(
  "/admin/reps/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const patch = PatchRepRequest.parse(req.body ?? {});
    const update: Partial<typeof salesReps.$inferInsert> = {};
    if (patch.displayName !== undefined) update.displayName = patch.displayName;
    if (patch.promoCode !== undefined)
      update.promoCode = patch.promoCode.toUpperCase();
    if (patch.hourlyRateCents !== undefined)
      update.hourlyRateCents = patch.hourlyRateCents;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;
    if (patch.role !== undefined) update.role = patch.role;
    if (Object.keys(update).length === 0) {
      throw badRequest("No fields to update.");
    }
    // Snapshot BEFORE the update so the audit row carries the exact
    // pre-state. Reading after the UPDATE would only ever record the
    // post-state and we'd lose the diff visibility for things like
    // role demotions or rate cuts.
    const [prev] = await db
      .select()
      .from(salesReps)
      .where(eq(salesReps.id, id))
      .limit(1);
    if (!prev) throw notFound("Rep not found");
    const [row] = await db
      .update(salesReps)
      .set(update)
      .where(eq(salesReps.id, id))
      .returning();
    if (!row) throw notFound("Rep not found");
    await writeAudit(req, {
      action: "rep.update",
      targetType: "sales_rep",
      targetId: row.id,
      before: snapshotKeys(prev, REP_AUDIT_KEYS),
      after: snapshotKeys(row, REP_AUDIT_KEYS),
    });
    res.json({
      rep: {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        role: row.role,
        promoCode: row.promoCode,
        hourlyRateCents: row.hourlyRateCents,
        isActive: row.isActive,
      },
    });
  }),
);

router.get(
  "/admin/contact-requests",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(contactRequests)
      .orderBy(desc(contactRequests.createdAt))
      .limit(200);
    res.json({ contactRequests: dateToIso(rows) });
  }),
);

// Spec contract paths: /admin/custom-dev/queue, PATCH /admin/custom-dev/:id, POST /admin/custom-dev/:id/send.
// Legacy aliases at /admin/custom-dev/quotes... preserved for in-flight clients.
router.get(
  "/admin/custom-dev/queue",
  asyncHandler(async (_req, res) => {
    const rows = await listAllQuotes();
    res.json({ quotes: dateToIso(rows) });
  }),
);
router.get(
  "/admin/custom-dev/quotes",
  asyncHandler(async (_req, res) => {
    const rows = await listAllQuotes();
    res.json({ quotes: dateToIso(rows) });
  }),
);

router.patch(
  "/admin/custom-dev/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = QuoteCustomDevRequest.parse(req.body);
    const row = await setQuoteAmount(id, body.quotedAmountCents, body.adminNote);
    res.json({ quote: dateToIso(row) });
  }),
);
router.post(
  "/admin/custom-dev/quotes/:id/quote",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = QuoteCustomDevRequest.parse(req.body);
    const row = await setQuoteAmount(id, body.quotedAmountCents, body.adminNote);
    res.json({ quote: dateToIso(row) });
  }),
);

router.post(
  "/admin/custom-dev/:id/send",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const result = await sendQuoteToProspect(id);
    res.json({
      quote: dateToIso(result.quote),
      sms: result.sms,
      email: result.email,
    });
  }),
);
router.post(
  "/admin/custom-dev/quotes/:id/send",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const result = await sendQuoteToProspect(id);
    res.json({
      quote: dateToIso(result.quote),
      sms: result.sms,
      email: result.email,
    });
  }),
);

router.get(
  "/admin/sales",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.occurredAt))
      .limit(500);
    res.json({ sales: dateToIso(rows) });
  }),
);

/**
 * Aggregated index of every lead that has at least one call recorded —
 * feeds the admin "Transcripts" page. Returns one row per lead with the
 * latest call timestamp, total call count, and whether any of those
 * calls have a transcript available yet. Drill-in goes through the
 * existing `/admin/leads/:id/timeline` endpoint, which already joins
 * transcripts + summaries + audio URLs.
 */
router.get(
  "/admin/calls/leads",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        leadId: calls.leadId,
        leadName: leads.name,
        practice: leads.practice,
        callCount: sql<number>`count(${calls.id})::int`,
        transcriptCount: sql<number>`count(${callTranscripts.id})::int`,
        lastCallAt: sql<Date | null>`max(coalesce(${calls.startedAt}, ${calls.createdAt}))`,
      })
      .from(calls)
      .innerJoin(leads, eq(leads.id, calls.leadId))
      .leftJoin(callTranscripts, eq(callTranscripts.callId, calls.id))
      .where(isNotNull(calls.leadId))
      .groupBy(calls.leadId, leads.name, leads.practice)
      .orderBy(desc(sql`max(coalesce(${calls.startedAt}, ${calls.createdAt}))`));
    res.json({
      leads: rows.map((r) => ({
        leadId: r.leadId!,
        leadName: r.leadName,
        practice: r.practice,
        callCount: r.callCount,
        transcriptCount: r.transcriptCount,
        // drizzle returns this sql<Date> aggregate as a raw string (the <Date>
        // is only a TS hint, not runtime parsing), so calling .toISOString()
        // directly threw a 500. Normalize through new Date() — works whether the
        // driver hands back a string or a Date.
        lastCallAt: r.lastCallAt ? new Date(r.lastCallAt).toISOString() : null,
      })),
    });
  }),
);

/**
 * Pull-mode backfill from DialPad — used when DialPad webhooks aren't
 * configured. Fetches the last `sinceDays` (default 30) days of calls
 * via the DialPad API, ingests them into `calls`/`call_transcripts`/
 * `call_summaries`, and matches each to a lead by phone number.
 *
 * Idempotent on `dialpad_call_id`, safe to invoke repeatedly.
 */
router.post(
  "/admin/calls/backfill",
  asyncHandler(async (req, res) => {
    const Body = z.object({
      sinceDays: z.number().int().min(1).max(365).optional(),
    });
    const { sinceDays = 30 } = Body.parse(req.body ?? {});
    const sinceMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const summary = await backfillRecentCalls({ sinceMs });
    res.json({ sinceDays, ...summary });
  }),
);

router.get(
  "/admin/leads/:id/timeline",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const t = await getLeadTimeline(id);
    res.json(dateToIso(t));
  }),
);

/**
 * Lightweight identity lookup for the admin LeadDetail page header.
 * Returns just the lead row — the heavier `leadTimeline` is overkill
 * when the page only needs name/practice/contact info to render the
 * page header above the Customer-portal panel.
 */
router.get(
  "/admin/leads/:id",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const [row] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    if (!row) throw notFound("Lead not found");
    res.json({ lead: dateToIso(row) });
  }),
);

// PHASE A.2 — therapist Calendly + Doxy URLs. Admins persist these
// from the LeadDetail page once the therapist shares them; the public-
// site BookingWidget + DoxyBridge thread them into the prospect preview.
const SetLeadBookingUrls = z.object({
  calendlyUrl: z
    .string()
    .max(256)
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  doxyUrl: z
    .string()
    .max(256)
    .nullable()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});
router.patch(
  "/admin/leads/:id/booking-urls",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = SetLeadBookingUrls.parse(req.body);
    const [updated] = await db
      .update(leads)
      .set({
        calendlyUrl: body.calendlyUrl,
        doxyUrl: body.doxyUrl,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning();
    if (!updated) throw notFound("Lead not found");
    res.json({ lead: dateToIso(updated) });
  }),
);

/**
 * Admin counterpart to `GET /dashboard/leads/:id/portal`. Returns the
 * exact same shape (factored via `buildLeadPortalView`) so the Customer-
 * portal panel can be reused 1:1 in the admin app. Authorization is
 * already enforced by the `requireAuth + requireAdmin` middleware
 * mounted on this router.
 */
router.get(
  "/admin/leads/:id/portal",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const [row] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    if (!row) throw notFound("Lead not found");
    res.json(await buildLeadPortalView(id));
  }),
);

const CancelSubRequest = z.object({
  reason: z.string().max(500).optional(),
});

router.post(
  "/admin/subscriptions/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = CancelSubRequest.parse(req.body ?? {});
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!sub) throw notFound("Subscription not found");
    // Spec: schedule cancellation at end-of-period via Stripe; do NOT mark
    // the local row as canceled here. The Stripe webhook
    // (customer.subscription.deleted) is the source of truth for the final
    // canceledAt timestamp, so MRR/churn reporting stays consistent.
    let scheduled = false;
    if (stripe && sub.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
          metadata: { cancel_reason: body.reason ?? "" },
        });
        scheduled = true;
      } catch (err) {
        logger.error({ err, subId: sub.stripeSubscriptionId }, "stripe cancel failed");
      }
    }
    await writeAudit(req, {
      action: "subscription.cancel_scheduled",
      targetType: "subscription",
      targetId: sub.id,
      before: { status: sub.status, canceledAt: sub.canceledAt },
      after: {
        cancelAtPeriodEnd: scheduled,
        reason: body.reason ?? null,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      },
    });
    res.json({
      subscription: dateToIso(sub),
      cancelAtPeriodEnd: scheduled,
    });
  }),
);

const TransferDomainRequest = z.object({
  customerEmail: z.string().email(),
});

const TRANSFER_FEE_CENTS = 19900;

router.post(
  "/admin/subscriptions/:id/transfer-domain",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = TransferDomainRequest.parse(req.body);
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!sub) throw notFound("Subscription not found");
    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, sub.saleId))
      .limit(1);
    if (!sale) {
      throw notFound("Sale not found");
    }
    // Legacy Plan B domain transfer flow. With the 2026-05 tier migration
    // all new tiers include domain handling, so this fee no longer applies.
    // The body of the route is gone in Phase 1A; the admin UI will be
    // re-pointed to the tier-aware domain handoff in Phase 1B.
    void sub;
    throw badRequest("Domain transfer is not available on tier-based subscriptions.");
  }),
);

// LOT 3.14 — Downgrade record. Capabilities lost on a downgrade are
// captured in the audit log so ops has a paper trail of what the
// customer no longer has access to.
const DowngradeTierRequest = z.object({
  tierKey: z.enum(["boutique", "boutique_pro", "boutique_concierge"]),
  capabilitiesLost: z.array(z.string()).optional(),
});
router.post(
  "/admin/subscriptions/:id/downgrade",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = DowngradeTierRequest.parse(req.body);
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!sub) throw notFound("Subscription not found");
    await writeAudit(req, {
      action: "subscription.downgrade_requested",
      targetType: "subscription",
      targetId: sub.id,
      before: { stripeSubscriptionId: sub.stripeSubscriptionId },
      after: {
        requestedTier: body.tierKey,
        capabilitiesLost: body.capabilitiesLost ?? [],
      },
    });
    res.json({ subscription: dateToIso(sub) });
  }),
);

// LOT 3.6 — Admin "Upgrade tier" action. Schedules a Stripe subscription
// price update (stub when stripe is not configured). The local plan_key
// is not flipped here; the Stripe webhook is the source of truth and
// will sync on customer.subscription.updated.
const UpgradeTierRequest = z.object({
  tierKey: z.enum(["boutique", "boutique_pro", "boutique_concierge"]),
});
router.post(
  "/admin/subscriptions/:id/upgrade",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const body = UpgradeTierRequest.parse(req.body);
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!sub) throw notFound("Subscription not found");
    // TODO(upgrade-flow): perform the actual Stripe subscription price
    // swap via stripe.subscriptions.update(...). Today we just record
    // intent on the audit log so ops can manually action the swap from
    // the Stripe dashboard.
    await writeAudit(req, {
      action: "subscription.upgrade_requested",
      targetType: "subscription",
      targetId: sub.id,
      before: { stripeSubscriptionId: sub.stripeSubscriptionId },
      after: { requestedTier: body.tierKey },
    });
    res.json({ subscription: dateToIso(sub) });
  }),
);

router.get(
  "/admin/subscriptions",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt))
      .limit(200);
    res.json({ subscriptions: dateToIso(rows) });
  }),
);

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else cur += c;
    } else {
      if (c === ",") {
        out.push(cur.trim());
        cur = "";
      } else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur.trim());
  return out;
};

// 2026-05-21 — Admin onboarding endpoints removed (Sprint 2 streamline).
// Stubbed as 410 Gone so any old bookmark / script gets a clean signal.
router.get(
  "/admin/onboarding",
  asyncHandler(async (_req, res) => {
    res.status(410).json({
      error: "Client onboarding flow removed 2026-05-21. Sites are built directly from sales-call notes.",
    });
  }),
);

router.get(
  "/admin/onboarding/:id/brief.md",
  asyncHandler(async (_req, res) => {
    res.status(410).type("text/markdown; charset=utf-8").send(
      "# Removed\n\nClient onboarding flow removed 2026-05-21.\n",
    );
  }),
);

/**
 * LOT 1.4 — manually trigger the portal-lifecycle reconciler. The
 * same function runs hourly from app.ts; this exposes it for the
 * admin UI (future: a "reconcile now" button) and, more immediately,
 * for the portal-lifecycle.spec.ts regression that locks down the
 * defensive net for the 'recycled' status (which nothing in the
 * codebase currently writes — without a callable surface, that
 * branch is untestable through HTTP). Returns the counts the cron
 * job logs internally.
 */
router.post(
  "/admin/portals/reconcile",
  asyncHandler(async (req, res) => {
    const result = await reconcilePortalLifecycles();
    await writeAudit(req, {
      action: "portal.reconcile",
      targetType: "portal",
      targetId: null,
      before: null,
      after: result,
    });
    res.json(result);
  }),
);

router.get(
  "/admin/audit",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        log: adminAuditLog,
        actor: salesReps,
      })
      .from(adminAuditLog)
      .leftJoin(salesReps, eq(salesReps.id, adminAuditLog.actorRepId))
      .orderBy(desc(adminAuditLog.occurredAt))
      .limit(200);
    // The new columns from migration 0016 (actor_role / before / after /
    // ip / user_agent) ride alongside the legacy `diff` field. Old rows
    // emit them as null; new rows fill them in. The admin UI keeps
    // rendering `diff` today — surfacing the structured fields is
    // post-LOT 1 work.
    res.json({
      entries: rows.map((r) => ({
        id: r.log.id,
        action: r.log.action,
        targetType: r.log.targetType,
        targetId: r.log.targetId,
        diff: r.log.diff,
        before: r.log.before ?? null,
        after: r.log.after ?? null,
        actorRole: r.log.actorRole ?? null,
        ip: r.log.ip ?? null,
        userAgent: r.log.userAgent ?? null,
        occurredAt: r.log.occurredAt.toISOString(),
        actor: r.actor
          ? { id: r.actor.id, displayName: r.actor.displayName, username: r.actor.username }
          : null,
      })),
    });
  }),
);

// Email deliverability — surfaces the most recent bounces, complaints, and
// delayed deliveries so the owner can spot reputation problems before customers
// complain. Populated by the Resend webhook at `/api/webhooks/resend`.
router.get(
  "/admin/email/deliverability",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: emailMessages.id,
        toAddr: emailMessages.toAddr,
        subject: emailMessages.subject,
        status: emailMessages.status,
        errorMessage: emailMessages.errorMessage,
        occurredAt: emailMessages.occurredAt,
        leadId: emailMessages.leadId,
      })
      .from(emailMessages)
      .where(eq(emailMessages.status, "failed"))
      .orderBy(desc(emailMessages.occurredAt))
      .limit(20);
    res.json({
      problems: rows.map((r) => ({
        id: r.id,
        toAddr: r.toAddr,
        subject: r.subject,
        status: r.status,
        errorMessage: r.errorMessage,
        occurredAt: r.occurredAt.toISOString(),
        leadId: r.leadId,
      })),
    });
  }),
);

/**
 * Self-serve template funnel report.
 *
 * Aggregates `funnel_events` rows from the public template flow into a
 * step-by-step conversion table for the admin dashboard. The wider story:
 *
 *   template_view → reserve_open → reserve_submit → checkout_start → won
 *
 * The "won" count joins funnel sessionId → leads.selfServeMeta.funnelSessionId
 * → sales (any lead row marked status="won") so the admin sees true
 * end-to-end conversion, not just funnel-internal drop-off.
 *
 * `?days=7` (default 14, max 90) trims the window. The endpoint is
 * intentionally read-only and admin-gated by the parent middleware.
 */
router.get(
  "/admin/self-serve-funnel",
  asyncHandler(async (req, res) => {
    const days = Math.min(
      90,
      Math.max(1, Number(req.query.days ?? 14) || 14),
    );
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const since = new Date(sinceMs);

    // Per-event counts and unique sessions for the trailing window.
    const eventRows = await db
      .select({
        event: funnelEvents.event,
        count: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${funnelEvents.sessionId})::int`,
      })
      .from(funnelEvents)
      .where(sql`${funnelEvents.createdAt} >= ${since}`)
      .groupBy(funnelEvents.event);

    // Top templates by view count + how many of those sessions reached
    // reserve_submit, surfaced as a per-template conversion table.
    const perTemplateRows = await db
      .select({
        slug: funnelEvents.slug,
        event: funnelEvents.event,
        sessions: sql<number>`count(distinct ${funnelEvents.sessionId})::int`,
      })
      .from(funnelEvents)
      .where(
        sql`${funnelEvents.createdAt} >= ${since} AND ${funnelEvents.slug} is not null`,
      )
      .groupBy(funnelEvents.slug, funnelEvents.event);

    // Per-session template attribution so we can credit a paid sale back to
    // the template the session actually viewed. A session typically views a
    // single template, but if multiple are viewed we credit each.
    const templateViewRows = await db
      .select({
        sessionId: funnelEvents.sessionId,
        slug: funnelEvents.slug,
      })
      .from(funnelEvents)
      .where(
        sql`${funnelEvents.createdAt} >= ${since} AND ${funnelEvents.event} = 'template_view' AND ${funnelEvents.slug} is not null`,
      );
    const templatesBySession = new Map<string, Set<string>>();
    for (const r of templateViewRows) {
      if (!r.slug) continue;
      let bucket = templatesBySession.get(r.sessionId);
      if (!bucket) {
        bucket = new Set<string>();
        templatesBySession.set(r.sessionId, bucket);
      }
      bucket.add(r.slug);
    }

    // Won leads attributable to a funnel session in the window. We anchor
    // on `lastActivityAt` (bumped by the Stripe webhook on every self-serve
    // checkout) rather than `createdAt`, so a returning customer whose
    // lead row predates the window is still counted on conversion. We
    // additionally cross-check against a sale row in the same window so
    // a lead that was already won outside the window doesn't double-count.
    const wonRows = await db
      .select({
        funnelSessionId: sql<string>`${leads.selfServeMeta}->>'funnelSessionId'`,
      })
      .from(leads)
      .innerJoin(sales, eq(sales.leadId, leads.id))
      .where(
        sql`${leads.source} = 'self_serve_template' AND ${leads.status} = 'won' AND ${sales.occurredAt} >= ${since} AND ${leads.selfServeMeta}->>'funnelSessionId' is not null`,
      );
    const wonSessionIds = new Set(
      wonRows.map((r) => r.funnelSessionId).filter(Boolean),
    );

    // Roll up per-event counts into a step-keyed dict for the UI.
    const stepCounts: Record<string, { count: number; sessions: number }> = {};
    for (const r of eventRows) {
      stepCounts[r.event] = { count: r.count, sessions: r.sessions };
    }

    // Per-template conversion: sessions that viewed → sessions that
    // submitted reserve. Sorted by views descending; capped at 20 rows
    // so a high-cardinality slug column doesn't bloat the response.
    const perTemplate: Record<
      string,
      { views: number; reserveSubmits: number }
    > = {};
    for (const r of perTemplateRows) {
      if (!r.slug) continue;
      const bucket = (perTemplate[r.slug] ??= { views: 0, reserveSubmits: 0 });
      if (r.event === "template_view") bucket.views = r.sessions;
      if (r.event === "reserve_submit") bucket.reserveSubmits = r.sessions;
    }
    // Paid conversion per template: count of won sessions whose
    // funnelSessionId viewed that template within the window.
    const wonByTemplate = new Map<string, number>();
    for (const sid of wonSessionIds) {
      const slugs = templatesBySession.get(sid);
      if (!slugs) continue;
      for (const slug of slugs) {
        wonByTemplate.set(slug, (wonByTemplate.get(slug) ?? 0) + 1);
      }
    }
    const perTemplateList = Object.entries(perTemplate)
      .map(([slug, v]) => {
        const wonCount = wonByTemplate.get(slug) ?? 0;
        return {
          slug,
          views: v.views,
          reserveSubmits: v.reserveSubmits,
          wonCount,
          conversionPct:
            v.views > 0
              ? Math.round((1000 * v.reserveSubmits) / v.views) / 10
              : 0,
          paidConversionPct:
            v.views > 0 ? Math.round((1000 * wonCount) / v.views) / 10 : 0,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // Per-addon conversion: how often each addon was toggled ON during the
    // window, and how many of those sessions ended up submitting reserve.
    // Pulled from `addon_toggle` (when payload.enabled === true) joined by
    // sessionId against sessions that subsequently emitted reserve_submit.
    // Capped to 30 rows so a misbehaving client adding bogus addon keys
    // can't bloat the response.
    const addonRows = await db
      .select({
        sessionId: funnelEvents.sessionId,
        event: funnelEvents.event,
        payload: funnelEvents.payload,
      })
      .from(funnelEvents)
      .where(
        sql`${funnelEvents.createdAt} >= ${since} AND ${funnelEvents.event} in ('addon_toggle','reserve_submit')`,
      );
    const sessionsByAddon = new Map<string, Set<string>>();
    const submittedSessions = new Set<string>();
    for (const r of addonRows) {
      if (r.event === "reserve_submit") {
        submittedSessions.add(r.sessionId);
        continue;
      }
      const p = (r.payload ?? {}) as Record<string, unknown>;
      if (p.enabled !== true) continue;
      const addon = typeof p.addon === "string" ? p.addon : null;
      if (!addon) continue;
      let bucket = sessionsByAddon.get(addon);
      if (!bucket) {
        bucket = new Set<string>();
        sessionsByAddon.set(addon, bucket);
      }
      bucket.add(r.sessionId);
    }
    const perAddonList = Array.from(sessionsByAddon.entries())
      .map(([addon, sessions]) => {
        const submits = Array.from(sessions).filter((s) =>
          submittedSessions.has(s),
        ).length;
        const wonCount = Array.from(sessions).filter((s) =>
          wonSessionIds.has(s),
        ).length;
        return {
          addon,
          enabledSessions: sessions.size,
          reserveSubmits: submits,
          wonCount,
          conversionPct:
            sessions.size > 0
              ? Math.round((1000 * submits) / sessions.size) / 10
              : 0,
          paidConversionPct:
            sessions.size > 0
              ? Math.round((1000 * wonCount) / sessions.size) / 10
              : 0,
        };
      })
      .sort((a, b) => b.enabledSessions - a.enabledSessions)
      .slice(0, 30);

    res.json({
      windowDays: days,
      since: since.toISOString(),
      steps: stepCounts,
      wonCount: wonSessionIds.size,
      perTemplate: perTemplateList,
      perAddon: perAddonList,
    });
  }),
);

// 2026-05-14 audit fix #7: admin-level notifications feed. Surfaces
// rep @-mentions of the owner so they can be triaged from the admin
// dashboard without scanning every rep's note timeline.
router.get(
  "/admin/notifications",
  asyncHandler(async (req, res) => {
    const onlyUnread = req.query.unread === "1";
    const rows = await db
      .select({
        id: adminNotifications.id,
        kind: adminNotifications.kind,
        leadId: adminNotifications.leadId,
        repId: adminNotifications.repId,
        body: adminNotifications.body,
        readAt: adminNotifications.readAt,
        createdAt: adminNotifications.createdAt,
      })
      .from(adminNotifications)
      .orderBy(desc(adminNotifications.createdAt))
      .limit(200);
    const filtered = onlyUnread ? rows.filter((r) => !r.readAt) : rows;
    res.json({ notifications: dateToIso(filtered) });
  }),
);

router.patch(
  "/admin/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    await db
      .update(adminNotifications)
      .set({ readAt: new Date() })
      .where(eq(adminNotifications.id, id));
    res.json({ ok: true });
  }),
);

// 2026-05-14: admin reply to a rep's @Ashford mention. The reply is
// appended to the lead's note timeline (visible to the claiming rep),
// fires an in-dashboard `ashford_reply` notification, and emails the
// rep. The originating admin mention is auto-marked as read.
const ReplyBody = z.object({
  body: z.string().trim().min(1).max(4000),
});
router.post(
  "/admin/notifications/:id/reply",
  asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().parse(req.params.id);
    const { body } = ReplyBody.parse(req.body);
    const [me] = await db
      .select({ id: salesReps.id, displayName: salesReps.displayName })
      .from(salesReps)
      .where(eq(salesReps.id, req.user!.id))
      .limit(1);
    const result = await replyToAdminMention({
      adminUserId: req.user!.id,
      adminDisplayName: me?.displayName ?? "Ashford",
      notificationId: id,
      body,
    });
    res.json({ ok: true, note: dateToIso(result) });
  }),
);

// 2026-05-21 — one-shot: force the curated 17 portals from the 2026-05-20
// Elite batch back onto the canonical Garden template. Founder caught that
// only 6/17 had landed on Garden after the field-lock work; the other 11
// were stuck on sunrise/polaroid/front_porch/hello_friend/constellation
// from the original auto-pick. Bypasses field-locks because the lock table
// itself was preventing the founder's manual flip.
const FixGardenConfirm = z.object({
  confirmation: z.literal("GARDEN", {
    errorMap: () => ({ message: "Type GARDEN to confirm." }),
  }),
});
const ELITE_2026_05_20_LEAD_IDS = [
  300, 469, 474, 476, 502, 504, 520, 521, 522,
  530, 538, 541, 545, 555, 566, 569, 573,
] as const;
router.post(
  "/admin/portals/force-garden-2026-05-20",
  asyncHandler(async (req, res) => {
    const parsed = FixGardenConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type GARDEN to confirm.", {
        code: "confirmation_required",
        expected: "GARDEN",
      });
    }
    const { prospectPortals } = await import("@workspace/db");
    const { inArray, ne, and } = await import("drizzle-orm");
    const before = await db
      .select({
        leadId: prospectPortals.leadId,
        template: prospectPortals.selectedTemplate,
      })
      .from(prospectPortals)
      .where(inArray(prospectPortals.leadId, [...ELITE_2026_05_20_LEAD_IDS]));
    const updated = await db
      .update(prospectPortals)
      .set({ selectedTemplate: "garden", updatedAt: new Date() })
      .where(
        and(
          inArray(prospectPortals.leadId, [...ELITE_2026_05_20_LEAD_IDS]),
          ne(prospectPortals.selectedTemplate, "garden"),
        ),
      )
      .returning({ leadId: prospectPortals.leadId });
    await writeAudit(req, {
      action: "portals.force_garden_2026_05_20",
      targetType: "prospect_portals",
      targetId: null,
      before: { rows: before },
      after: { updatedLeadIds: updated.map((u) => u.leadId) },
    });
    res.json({
      ok: true,
      requested: ELITE_2026_05_20_LEAD_IDS.length,
      updated: updated.length,
      updatedLeadIds: updated.map((u) => u.leadId),
    });
  }),
);

// 2026-05-21 — founder follow-up: same story, but for every prospect
// portal in the table (not just the 17 from the Elite batch). Garden is
// now the canonical default template; this one-shot wipes the residual
// auto-pick assignments left over from the old behavior.
const FixGardenAllConfirm = z.object({
  confirmation: z.literal("GARDEN-ALL", {
    errorMap: () => ({ message: "Type GARDEN-ALL to confirm." }),
  }),
});
router.post(
  "/admin/portals/force-garden-all",
  asyncHandler(async (req, res) => {
    const parsed = FixGardenAllConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type GARDEN-ALL to confirm.", {
        code: "confirmation_required",
        expected: "GARDEN-ALL",
      });
    }
    const { prospectPortals } = await import("@workspace/db");
    const { ne } = await import("drizzle-orm");
    const before = await db
      .select({
        leadId: prospectPortals.leadId,
        template: prospectPortals.selectedTemplate,
      })
      .from(prospectPortals)
      .where(ne(prospectPortals.selectedTemplate, "garden"));
    const updated = await db
      .update(prospectPortals)
      .set({ selectedTemplate: "garden", updatedAt: new Date() })
      .where(ne(prospectPortals.selectedTemplate, "garden"))
      .returning({ leadId: prospectPortals.leadId });
    await writeAudit(req, {
      action: "portals.force_garden_all",
      targetType: "prospect_portals",
      targetId: null,
      before: { rows: before },
      after: { updatedLeadIds: updated.map((u) => u.leadId) },
    });
    res.json({
      ok: true,
      scanned: before.length,
      updated: updated.length,
      updatedLeadIds: updated.map((u) => u.leadId),
    });
  }),
);

// 2026-05-21 — one-shot: hand-curate lead 573 (Cynthia De Los Santos,
// LMFT, Houston). Her practice_name was an raw Headway URL and her
// portal had an empty enrichment_snapshot so Garden rendered as a
// skeleton. Data sourced from her public Headway + Psychology Today
// profiles. Confirmation 'PERFECT-CYNTHIA'.
const PerfectCynthiaConfirm = z.object({
  confirmation: z.literal("PERFECT-CYNTHIA", {
    errorMap: () => ({ message: "Type PERFECT-CYNTHIA to confirm." }),
  }),
});
router.post(
  "/admin/portals/perfect-cynthia-573",
  asyncHandler(async (req, res) => {
    const parsed = PerfectCynthiaConfirm.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Type PERFECT-CYNTHIA to confirm.", {
        code: "confirmation_required",
        expected: "PERFECT-CYNTHIA",
      });
    }
    const { leads, prospectPortals } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const LEAD_ID = 573;

    const beforeLead = await db.select().from(leads).where(eq(leads.id, LEAD_ID)).limit(1);
    const beforePortal = await db.select().from(prospectPortals).where(eq(prospectPortals.leadId, LEAD_ID)).limit(1);

    await db
      .update(leads)
      .set({
        name: "Cynthia De Los Santos",
        practice: "Cynthia De Los Santos, LMFT",
        specialty: "Marriage & Family Therapy",
        phone: "(346) 409-7761",
        currentWebsite: "https://care.headway.co/providers/cynthia-de-los-santos",
        profileBlurb:
          "Marriage & Family Therapist (LMFT) in Houston with 20+ years of experience. Warm, family-systems approach for individuals, couples, and families. ASL fluent — serves the Deaf and hard-of-hearing community. Online sessions across Texas.",
        updatedAt: new Date(),
      })
      .where(eq(leads.id, LEAD_ID));

    const snapshot = {
      fetchedAt: new Date().toISOString(),
      tagline:
        "Family-systems therapy for individuals, couples, and families — Houston, online across Texas.",
      mission:
        "Hello and welcome. Life can be hard, and you do not have to cope alone. I'm a Licensed Marriage & Family Therapist with more than twenty years of experience supporting individuals, couples, and families through anxiety, depression, grief, and the relationships that shape who we become. My approach is rooted in family systems — we begin by understanding where you come from, then tailor a combination of therapeutic tools to fit your goals. I'm ASL-fluent and serve the Deaf and hard-of-hearing community, and I bring lived experience as a mother to a teen on the autism spectrum to my work with neurodivergent families. My promise is a safe, warm, and participatory space where you can be fully yourself while we walk this journey together.",
      hero: {
        image:
          "https://assets.headway.co/provider_photos/196578/49a01942-27a5-11f1-af85-0a58a9feac02-196578-1774372626977.jpeg",
      },
      team: [
        {
          name: "Cynthia De Los Santos",
          credentials: "MA, LMFT",
          photo:
            "https://assets.headway.co/provider_photos/196578/49a01942-27a5-11f1-af85-0a58a9feac02-196578-1774372626977.jpeg",
          bio:
            "Licensed Marriage & Family Therapist (Texas) with 20+ years of clinical experience. Master of Arts in Counseling, University of Houston-Clear Lake. Trained in family systems, with additional focus on anxiety, depression, grief, women's issues, and autism-spectrum families. ASL fluent.",
        },
      ],
      services: [
        { name: "Individual therapy", description: "One-on-one work for anxiety, depression, grief, and life transitions." },
        { name: "Couples therapy", description: "Improving communication, repairing connection, and navigating conflict together." },
        { name: "Family therapy", description: "Family-systems work for parents, teens, and families navigating change or neurodivergence." },
        { name: "Therapy in ASL", description: "Fluent ASL sessions for Deaf and hard-of-hearing clients across Texas." },
        { name: "Online sessions", description: "Secure video sessions available to anyone located in Texas." },
        { name: "Free 15-minute consultation", description: "A short call to see if we're the right fit before you commit." },
      ],
      specialties: [
        "Family issues",
        "Relationship issues",
        "Anxiety",
        "Depression",
        "Grief & loss",
        "Stress management",
        "Women's issues",
        "Autism-spectrum families",
        "Deaf & hard-of-hearing clients",
      ],
      modalities: [
        "Family Systems",
        "Cognitive Behavioral (CBT)",
        "Person-Centered",
        "Solution-Focused",
        "Online Therapy",
      ],
      populations: ["Individuals", "Couples", "Families", "College students", "Deaf & hard-of-hearing"],
      valueProps: [
        "20+ years of clinical experience",
        "ASL fluent — Deaf-affirming care",
        "Family-systems lens",
      ],
      fees: { individual: 135, couple: 135, sliding: false },
      insurance: [
        "Aetna",
        "Ascension",
        "Blue Cross Blue Shield of Texas",
        "Carelon Behavioral Health",
        "Cigna",
        "Quest Behavioral Health",
      ],
      reviews: [],
      photoUrls: [],
      waitlist: false,
    };

    await db
      .update(prospectPortals)
      .set({
        selectedTemplate: "garden",
        enrichmentSnapshot: snapshot,
        updatedAt: new Date(),
      })
      .where(eq(prospectPortals.leadId, LEAD_ID));

    const after = await db
      .select({ slug: prospectPortals.slug, token: prospectPortals.accessToken })
      .from(prospectPortals)
      .where(eq(prospectPortals.leadId, LEAD_ID))
      .limit(1);

    await writeAudit(req, {
      action: "portals.perfect_cynthia_573",
      targetType: "prospect_portals",
      targetId: String(LEAD_ID),
      before: { lead: beforeLead[0] ?? null, portal: beforePortal[0] ?? null },
      after: { selectedTemplate: "garden", snapshotKeys: Object.keys(snapshot) },
    });

    res.json({
      ok: true,
      leadId: LEAD_ID,
      slug: after[0]?.slug,
      previewUrl: after[0]
        ? `https://www.ashfordhealthcreative.com/preview/${after[0].slug}?t=${after[0].token}`
        : null,
    });
  }),
);

router.use(qcRouter);
router.use(portalRequestsRouter);

/**
 * 2026-05-22 — one-shot backup before the weekend-sprint contractor
 * touches anything. Returns every lead with its legacy `notes`
 * field + every row from `lead_rep_notes` (with the author's display
 * name + username so the contractor / future reader knows whose
 * thinking is whose). JSON only — the founder saves it locally as
 * the source-of-truth backup of Candice's rep journal.
 *
 * No auth narrowing beyond the parent admin gate. Safe to re-run.
 */
router.get(
  "/admin/notes-backup",
  asyncHandler(async (_req, res) => {
    const leadRows = await db
      .select({
        id: leads.id,
        name: leads.name,
        practice: leads.practice,
        specialty: leads.specialty,
        city: leads.city,
        state: leads.state,
        phone: leads.phone,
        email: leads.email,
        currentWebsite: leads.currentWebsite,
        legacyNotes: leads.notes,
        claimedByRepId: leads.claimedByRepId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .orderBy(leads.id);

    const noteRows = await db
      .select({
        id: leadRepNotes.id,
        leadId: leadRepNotes.leadId,
        authorRepId: leadRepNotes.authorRepId,
        body: leadRepNotes.body,
        originalBody: leadRepNotes.originalBody,
        createdAt: leadRepNotes.createdAt,
        editedAt: leadRepNotes.editedAt,
        authorDisplayName: salesReps.displayName,
        authorUsername: salesReps.username,
      })
      .from(leadRepNotes)
      .leftJoin(salesReps, eq(salesReps.id, leadRepNotes.authorRepId))
      .orderBy(leadRepNotes.leadId, leadRepNotes.createdAt);

    const notesByLead = new Map<number, typeof noteRows>();
    for (const n of noteRows) {
      const bucket = notesByLead.get(n.leadId) ?? [];
      bucket.push(n);
      notesByLead.set(n.leadId, bucket);
    }

    const out = leadRows.map((l) => ({
      id: l.id,
      name: l.name,
      practice: l.practice,
      specialty: l.specialty,
      city: l.city,
      state: l.state,
      phone: l.phone,
      email: l.email,
      currentWebsite: l.currentWebsite,
      claimedByRepId: l.claimedByRepId,
      createdAt: l.createdAt.toISOString(),
      legacyNotes: l.legacyNotes,
      repNotes: (notesByLead.get(l.id) ?? []).map((n) => ({
        id: n.id,
        author: {
          repId: n.authorRepId,
          displayName: n.authorDisplayName,
          username: n.authorUsername,
        },
        body: n.body,
        originalBody: n.originalBody,
        createdAt: n.createdAt.toISOString(),
        editedAt: n.editedAt ? n.editedAt.toISOString() : null,
      })),
    }));

    res.json({
      exportedAt: new Date().toISOString(),
      totalLeads: out.length,
      totalRepNotes: noteRows.length,
      leads: out,
    });
  }),
);

export default router;
