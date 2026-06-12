import {
  db,
  prospectPortals,
  portalEvents,
  portalCarts,
  addonCatalog,
  addonInterestSignals,
  enrichmentRuns,
  leadEnrichment,
  leads,
  salesReps,
  type ProspectPortal,
} from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import {
  isAnyEnrichmentSourceConfigured,
  runEnrichmentForLead,
  runEnrichmentForLeadTargeted,
} from "../integrations/enrichment/orchestrator";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/**
 * Default lifetime for a portal access token. Reps can regenerate at any
 * time from the lead detail page; the new token gets the same window.
 */
export const PORTAL_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hot-lead detection thresholds (Task 93). All values are intentionally
// hard-coded constants: tweaking them is a code change, not a config knob,
// so the rules stay auditable and product-owned. Tune by editing here.
// ---------------------------------------------------------------------------

/** Number of opens within HOT_BURST_WINDOW_MS that counts as a "hot burst". */
export const HOT_BURST_OPEN_COUNT = 3;
/** Window over which HOT_BURST_OPEN_COUNT opens trigger a hot alert. */
export const HOT_BURST_WINDOW_MS = 60 * 60 * 1000; // 60 min
/**
 * Gap between two consecutive opens that counts as a "revisit" trigger.
 * (Prospect came back the next day or later — they're back on the fence.)
 */
export const HOT_REVISIT_GAP_MS = 24 * 60 * 60 * 1000; // 24 h
/** Cooldown between two hot-fire notifications for the same portal. */
export const HOT_DEDUPE_COOLDOWN_MS = 30 * 60 * 1000; // 30 min
/**
 * How long the lead detail page renders the "🔥 Hot" badge after a trigger.
 * Kept in lockstep with the rep-facing copy so the badge feels like a live
 * "act now" signal, not stale history.
 */
export const HOT_BADGE_TTL_MS = 60 * 60 * 1000; // 60 min
import type {
  PortalCustomizations,
  PortalEnrichment,
  PortalPublicResponse,
  PortalEventRequest,
  PortalCartRequest,
  PreviewContent,
  PreviewWebsitePage,
} from "@workspace/api-zod";
import { normalizeTemplateKey } from "@workspace/api-zod";
import { inArray, notInArray } from "drizzle-orm";
import type { Request } from "express";
import { notFound, badRequest, HttpError } from "../lib/errors";
import { writeAudit, writeAuditExplicit } from "./auditLog";
import { resolvePortalRepActor } from "./portalAuth";
import { logger } from "../lib/logger";
import { env } from "../lib/env";

/**
 * OG-image signature strategy.
 *
 * The full portal access token is private — it grants read+mutation across
 * every public endpoint. We cannot embed it in `<meta og:image>` because
 * shared invite links surface that meta tag to anyone (link previews,
 * scrapers, archived pages).
 *
 * Instead, OG-image requests are authorised by a separate, narrowly-scoped
 * signature derived as `HMAC-SHA256(sessionSecret, "og:" + slug)`. This
 * signature is:
 *   - deterministic (so crawlers like iMessage/Slack can fetch a stable URL),
 *   - image-only (the OG endpoint accepts it; nothing else does),
 *   - not reversible to the full access token,
 *   - rotated automatically if SESSION_SECRET ever changes.
 */
const OG_SIG_LEN = 16; // bytes -> 22 chars base64url
export const computeOgSignature = (slug: string): string => {
  const mac = createHmac("sha256", env.sessionSecret).update(`og:${slug}`).digest();
  return mac.subarray(0, OG_SIG_LEN).toString("base64url");
};
import { getLockedFieldSet } from "./fieldLocks";
export const verifyOgSignature = (
  slug: string,
  provided: string | undefined,
): boolean => {
  if (!provided) return false;
  const expected = computeOgSignature(slug);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/**
 * Generates a URL-safe access token. The slug is human-readable (and
 * therefore guessable); this nonce gates the portal so slug enumeration
 * alone cannot read or mutate state.
 */
const generateAccessToken = (): string =>
  randomBytes(24).toString("base64url"); // 32 chars

/**
 * Constant-time access-token comparison. Returns true iff `provided` matches
 * `expected`. Empty strings never match (legacy rows with no token are
 * effectively rejected — a backfill below repairs them on first read).
 */
export const verifyPortalAccess = (
  expected: string,
  provided: string | undefined,
): boolean => {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/**
 * Structured 401 for an expired portal token. Extends `HttpError` so the
 * shared `errorHandler` middleware serialises it as `{ error: { code:
 * "portal_token_expired", ... } }` with a 401 status — the SPA distinguishes
 * this from "wrong token" (403) and renders the "ask your rep for a new link"
 * screen instead of a generic forbidden page.
 */
export class PortalTokenExpiredError extends HttpError {
  constructor(
    message = "This portal link has expired. Ask your rep to send a new one.",
  ) {
    super(401, "portal_token_expired", message);
  }
}

/**
 * LOT 1.4 — emitted when a portal whose lifecycle is 'expired' is hit
 * on the public path. Distinct from PortalTokenExpiredError: that's a
 * "your specific link aged out, ask for a new one" (401, recoverable);
 * this is a "the preview is no longer active period" (410, terminal).
 * Message is localized to the lead's locale at throw time and follows
 * CLAUDE.md voice rules (short, no CTA, no marketing-speak).
 */
export class PortalExpiredError extends HttpError {
  constructor(locale: "en" | "es" = "en") {
    super(
      410,
      "portal_expired",
      locale === "es"
        ? "Esta vista previa ya no está activa."
        : "This preview is no longer active.",
    );
  }
}

/**
 * Asserts the request carries a valid, unexpired access token for the slug.
 * Throws a forbidden error for missing/wrong tokens; throws a structured
 * 401 (`portal_token_expired`) when the token matches but has aged out.
 * Centralised so all public endpoints share the same gate.
 */
// LOT 1.5 — fixed-length sentinel used when the slug doesn't exist so
// the timing-safe compare against `providedToken` still runs. Matches
// the 32-char access-token length so timingSafeEqual doesn't short-
// circuit on a length mismatch. This is the cheap mitigation: it
// equalizes the compare cost between "slug missing" and "slug found,
// token wrong" but it does NOT pad the DB-lookup variance — a future
// pass can tighten this with pinned-latency padding if the threat
// model warrants it.
const ABSENT_PORTAL_TOKEN_SENTINEL =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 32 chars, never matches a real token

// LOT 1.5 — single uniform mismatch response. Byte-equal across:
//   - slug not found
//   - slug found but provided token doesn't match
//   - slug found but no token provided
// Same status, same code, same message, same JSON shape. Without
// this the wrong-slug response was a 404 with code='not_found' and
// the wrong-token response was a 403 with code='portal_forbidden';
// trivially distinguishable -> trivial slug enumeration.
const PORTAL_FORBIDDEN_MESSAGE =
  "Invalid or missing portal access token";
const throwPortalForbidden = (): never => {
  throw new HttpError(403, "portal_forbidden", PORTAL_FORBIDDEN_MESSAGE);
};

/**
 * LOT 1.5 — best-effort audit on denied portal access. Rate-limited
 * upstream at the route level (30/min/IP), so DB write rate is
 * bounded by the same mechanism that bounds the abuse. Across many
 * attacker IPs the audit table genuinely SHOULD grow — that's the
 * brute-force signal we want.
 *
 * The slug is recorded verbatim in target_id. KNOWN: a future admin
 * UI surface for these rows (carryover from LOT 1.2 — "surface
 * before/after/actorRole/ip in Audit.tsx") MUST escape the value
 * when rendering. An attacker can submit `<script>` or `';DROP TABLE`
 * style payloads as slugs; they land in admin_audit_log.target_id
 * unchanged. Today's Audit.tsx renders via JSON.stringify and React
 * text nodes (both safe), but a switch to dangerouslySetInnerHTML
 * during the LOT 1.2 UI follow-up would open a stored XSS.
 */
const auditAccessDenied = async (
  req: Request | undefined,
  slug: string,
  reason: "unknown_slug" | "bad_token" | "expired",
): Promise<void> => {
  try {
    await writeAuditExplicit({
      action: "portal.access.denied",
      actor: null,
      targetType: "portal",
      // Truncate aggressively so a megabyte-long slug payload doesn't
      // try to land in target_id (varchar(64) on the audit table).
      targetId: slug.length > 64 ? slug.slice(0, 64) : slug,
      before: null,
      after: {
        reason,
        ip: req?.ip ?? null,
        userAgent: req?.get("user-agent") ?? null,
      },
      ip: req?.ip ?? null,
      userAgent: req?.get("user-agent") ?? null,
    });
  } catch (err) {
    logger.warn(
      { err, slug, reason },
      "audit portal.access.denied failed — denial proceeded uninstrumented",
    );
  }
};

export const requirePortalAccess = async (
  slug: string,
  providedToken: string | undefined,
  req?: Request,
) => {
  // LOT 1.5 — ALWAYS do the DB lookup before deciding what to throw.
  // Without this, a missing slug short-circuits before any compare
  // happens and an attacker can distinguish unknown-slug (fast)
  // from wrong-token (slow). We don't equalize the DB-lookup
  // variance itself (cheap mitigation, not bcrypt-grade constant
  // time) but we do equalize the compare step via a fixed-length
  // sentinel below.
  const portal = await getPortalBySlug(slug);
  const expectedToken = portal?.accessToken
    ? portal.accessToken
    : ABSENT_PORTAL_TOKEN_SENTINEL;
  const compareOk = verifyPortalAccess(expectedToken, providedToken);
  if (!portal) {
    // Always do the compare even when there's no real token, then
    // throw the SAME error as the wrong-token path. Audit the
    // attempt — the resulting trail is the brute-force signal.
    await auditAccessDenied(req, slug, "unknown_slug");
    return throwPortalForbidden();
  }
  // Self-heal legacy rows that predate the access-token column. We
  // do this AFTER the compare above so the timing of the "real"
  // path doesn't blow up when a backfill is triggered.
  if (!portal.accessToken) {
    const token = generateAccessToken();
    const expiresAt = new Date(Date.now() + PORTAL_TOKEN_TTL_MS);
    await db
      .update(prospectPortals)
      .set({
        accessToken: token,
        accessTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(prospectPortals.id, portal.id));
    portal.accessToken = token;
    portal.accessTokenExpiresAt = expiresAt;
    logger.info({ portalId: portal.id }, "portal: backfilled access token");
    // A freshly-backfilled token can never match the providedToken
    // (the prospect doesn't have it yet) — fall through to the
    // uniform deny below.
  }
  // LOT 1.4 — lifecycle gate. Distinct 410 signal is the documented
  // contract; an attacker who already knows a slug existed can
  // observe expired vs forbidden, but that's a separate threat
  // (post-discovery) and the merged-doc UX explicitly asks for the
  // friendly fallback. See 1.4b commit body.
  if (portal.lifecycleState === "expired") {
    if (req) {
      const rep = await resolvePortalRepActor(req, portal.leadId);
      if (rep) {
        // Bypass: rep with ownership/admin gets the full portal so
        // record-keeping (post-mortem on a lost deal, archival view
        // on a disqualified lead) stays reachable. No DB mutation —
        // the lifecycle state stays 'expired'.
        return portal;
      }
    }
    // Resolve locale from the lead row so the 410 message lands in
    // the prospect's language. Default EN if anything goes wrong.
    let locale: "en" | "es" = "en";
    try {
      const [lead] = await db
        .select({ locale: leads.locale })
        .from(leads)
        .where(eq(leads.id, portal.leadId))
        .limit(1);
      if (lead?.locale === "es") locale = "es";
    } catch {
      // swallow — locale fallback to EN is fine
    }
    await auditAccessDenied(req, slug, "expired");
    throw new PortalExpiredError(locale);
  }
  if (!compareOk) {
    await auditAccessDenied(req, slug, "bad_token");
    return throwPortalForbidden();
  }
  if (
    portal.accessTokenExpiresAt &&
    portal.accessTokenExpiresAt.getTime() <= Date.now()
  ) {
    throw new PortalTokenExpiredError();
  }
  return portal;
};

/**
 * Mints a fresh access token for the given portal and resets the expiry
 * window. Used by the rep "Regenerate link" action when a prospect's old
 * link is lost / leaked / aged out. Returns the new portal row.
 */
export const regeneratePortalAccessToken = async (
  portalId: number,
): Promise<ProspectPortal> => {
  const token = generateAccessToken();
  const expiresAt = new Date(Date.now() + PORTAL_TOKEN_TTL_MS);
  const [row] = await db
    .update(prospectPortals)
    .set({
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(prospectPortals.id, portalId))
    .returning();
  if (!row) throw notFound("Portal not found");
  return row;
};

/**
 * LOT 1.4 — terminate the public lifecycle of a portal.
 *
 * Idempotent: the first call flips lifecycle_state to 'expired',
 * stamps access_token_expires_at = now() (invalidates the token), and
 * writes a `portal.expire` audit row. Subsequent calls early-return
 * before doing any DB work or writing duplicate audit rows. This is
 * the load-bearing safety property — the hourly reconciler and the
 * inline rep-disqualify path can both race; whichever wins first does
 * the work, the rest is a no-op.
 *
 * Called from:
 *   - updateLeadByRep when the new status is in {disqualified, won}
 *     (inline, has a Request -> writeAudit)
 *   - recycleStaleClaims when claimed leads age out to 'recycled'
 *     (cron, no Request -> writeAuditExplicit)
 *   - the hourly portal-lifecycle reconciler registered in app.ts
 *     (cron, no Request -> writeAuditExplicit; reason='cron_reconcile'
 *     or 'token_timeout' depending on which gate caught it)
 *
 * NOTE on the trigger set: 'cold' is NOT a trigger. Cold means "rep
 * parked the lead for later follow-up" — killing the preview would
 * block legitimate re-engagement, which is exactly opposite to what
 * cold means. nurturing/claimed obviously also stay live. Only the
 * three terminal statuses fire the gate.
 */
export type PortalExpireReason =
  | "disqualified"
  | "won"
  | "recycled"
  | "cron_reconcile"
  | "token_timeout";

export const expirePortalForLead = async (
  leadId: number,
  reason: PortalExpireReason,
  req?: Request,
): Promise<{ expired: boolean; portalId: number | null }> => {
  const [portal] = await db
    .select()
    .from(prospectPortals)
    .where(eq(prospectPortals.leadId, leadId))
    .limit(1);
  if (!portal) return { expired: false, portalId: null };
  if (portal.lifecycleState === "expired") {
    // Idempotent no-op: don't bump timestamps, don't write a duplicate
    // audit row. First transition wins.
    return { expired: false, portalId: portal.id };
  }
  const now = new Date();
  const before = {
    lifecycleState: portal.lifecycleState,
    accessTokenExpiresAt: portal.accessTokenExpiresAt,
  };
  await db
    .update(prospectPortals)
    .set({
      lifecycleState: "expired",
      accessTokenExpiresAt: now,
      updatedAt: now,
    })
    .where(eq(prospectPortals.id, portal.id));
  const after = {
    lifecycleState: "expired" as const,
    accessTokenExpiresAt: now.toISOString(),
    reason,
  };
  const audit = {
    action: "portal.expire",
    targetType: "portal" as const,
    targetId: portal.id,
    before,
    after,
  };
  if (req) {
    await writeAudit(req, audit);
  } else {
    await writeAuditExplicit({
      ...audit,
      actor: null,
      ip: null,
      userAgent: null,
    });
  }
  return { expired: true, portalId: portal.id };
};

/**
 * LOT 1.4 — hourly reconciler. Catches three classes of drift the
 * inline expire path can't:
 *   1. lead.status was mutated outside updateLeadByRep (admin DB edits,
 *      future routes that forget the hook).
 *   2. The access token aged past its expiry without anyone calling
 *      expire (legacy rows with the 90-day TTL).
 *   3. A race where the inline path was on a different node and the
 *      audit row got lost.
 *
 * Constant-cost: both queries hit indexed columns
 * (prospect_portals_lifecycle_idx + leads.status). Runs are cheap
 * even with thousands of portals; sleep is unconditional setInterval
 * in app.ts.
 */
export const reconcilePortalLifecycles = async (): Promise<{
  byStatus: number;
  byTokenTimeout: number;
}> => {
  // (1) Lead is terminal but portal isn't expired yet.
  const stale = await db
    .select({ leadId: prospectPortals.leadId, status: leads.status })
    .from(prospectPortals)
    .innerJoin(leads, eq(leads.id, prospectPortals.leadId))
    .where(
      and(
        sql`${prospectPortals.lifecycleState} <> 'expired'`,
        inArray(leads.status, ["disqualified", "won", "recycled"]),
      ),
    );
  let byStatus = 0;
  for (const row of stale) {
    const reason: PortalExpireReason =
      row.status === "disqualified"
        ? "disqualified"
        : row.status === "won"
          ? "won"
          : "recycled";
    const result = await expirePortalForLead(row.leadId, reason);
    if (result.expired) byStatus++;
  }
  // (2) Token has aged out but lifecycle state hasn't been flipped.
  const aged = await db
    .select({ leadId: prospectPortals.leadId })
    .from(prospectPortals)
    .where(
      and(
        sql`${prospectPortals.lifecycleState} <> 'expired'`,
        sql`${prospectPortals.accessTokenExpiresAt} < now()`,
      ),
    );
  let byTokenTimeout = 0;
  for (const row of aged) {
    const result = await expirePortalForLead(row.leadId, "token_timeout");
    if (result.expired) byTokenTimeout++;
  }
  return { byStatus, byTokenTimeout };
};

/**
 * Slug generation: human-readable, URL-safe, deterministic-ish. We try
 * `<first-last>-<city>` first; on collision append `-2`, `-3`, etc. The
 * uniqueness gate is the unique index on `prospect_portals.slug`.
 */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);

const buildBaseSlug = (lead: { name: string; city: string }): string => {
  const name = slugify(lead.name);
  const city = slugify(lead.city);
  const base = [name, city].filter(Boolean).join("-").slice(0, 80);
  return base || `prospect-${Date.now().toString(36)}`;
};

/**
 * Best-effort unique slug — try base, then base-2, base-3, ... up to 50.
 * After 50 attempts (extremely unlikely) we fall back to a random suffix.
 */
const allocateUniqueSlug = async (base: string): Promise<string> => {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db
      .select({ id: prospectPortals.id })
      .from(prospectPortals)
      .where(eq(prospectPortals.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Idempotent: returns the existing portal if one already exists for the lead.
 * Otherwise allocates a slug and inserts. Backfill-friendly.
 */
export const ensurePortalForLead = async (
  leadId: number,
): Promise<ProspectPortal> => {
  const [existing] = await db
    .select()
    .from(prospectPortals)
    .where(eq(prospectPortals.leadId, leadId))
    .limit(1);
  if (existing) return existing;

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");

  const baseSlug = buildBaseSlug(lead);
  const slug = await allocateUniqueSlug(baseSlug);

  // We may race with another request creating a portal for the same lead.
  // The unique index on leadId ensures only one wins; on conflict we re-read.
  try {
    const [row] = await db
      .insert(prospectPortals)
      .values({
        leadId,
        slug,
        accessToken: generateAccessToken(),
        accessTokenExpiresAt: new Date(Date.now() + PORTAL_TOKEN_TTL_MS),
        selectedTemplate: defaultTemplateForSpecialty(lead.specialty),
        customizations: {},
      })
      .returning();
    return row;
  } catch (err) {
    logger.warn(
      { err, leadId, slug },
      "ensurePortalForLead: insert race — re-reading",
    );
    const [row] = await db
      .select()
      .from(prospectPortals)
      .where(eq(prospectPortals.leadId, leadId))
      .limit(1);
    if (!row) throw err;
    return row;
  }
};

/**
 * Full preview reset (founder fix #228). The rep clicks "Prepare preview"
 * expecting a clean slate, but the existing portal row carries forward
 * her last edits (template, palette, hero photo, copy overrides) and
 * stale enrichment rows. This wipes everything that drives the prospect
 * portal's appearance:
 *   - portal customizations → empty
 *   - selected template → specialty default
 *   - access token → fresh nonce + fresh 90-day expiry
 *   - enrichmentSnapshot → null
 *   - lead.selfServeMeta → null (so palette/template fallback chooses
 *     the specialty default rather than the prospect's prior pick)
 *   - lead_enrichment rows → all deleted (so the next enrichment run
 *     refetches from scratch rather than reusing the cached payload)
 * The caller is responsible for kicking off `runEnrichmentForLead` after
 * this returns; we keep the side effects scoped here so route handlers
 * stay thin and unit tests don't have to stub the whole pipeline.
 */
export const resetPortalCompletely = async (
  leadId: number,
): Promise<ProspectPortal> => {
  const portal = await ensurePortalForLead(leadId);
  const [lead] = await db
    .select({ specialty: leads.specialty })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");

  // Freshness guard. The full destructive reset (rotating the access
  // token, wiping customizations, dropping cached enrichment) is only
  // safe BEFORE the prospect has been invited — once the invite email has
  // gone out, the prospect holds a link with the old token and the rep
  // (and the prospect, via the WYSIWYG editor) may have invested in
  // customizations we should not silently destroy. After invite, we keep
  // the side effects to clearing the cached enrichment so the caller's
  // re-enrichment run produces a fresh snapshot, and we leave the token,
  // template and customizations intact. The route will still re-run
  // enrichment, so the rep gets refreshed signals without breaking the
  // prospect's link or losing portal edits.
  if (portal.inviteSentAt) {
    await db.delete(leadEnrichment).where(eq(leadEnrichment.leadId, leadId));
    return portal;
  }

  const token = generateAccessToken();
  const expiresAt = new Date(Date.now() + PORTAL_TOKEN_TTL_MS);
  const [updated] = await db
    .update(prospectPortals)
    .set({
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      selectedTemplate: defaultTemplateForSpecialty(lead.specialty),
      customizations: {},
      enrichmentSnapshot: null,
      updatedAt: new Date(),
    })
    .where(eq(prospectPortals.id, portal.id))
    .returning();
  if (!updated) throw notFound("Portal not found");

  await db
    .update(leads)
    .set({ selfServeMeta: null, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await db.delete(leadEnrichment).where(eq(leadEnrichment.leadId, leadId));

  return updated;
};

/**
 * Specialty-aware default template pick. Catalog is now 6 templates
 * (manifesto / framework / navy_editorial retired). Trauma → polaroid
 * (warm, personal); Couples /
 * relational → atrium (architectural premium read for relationship
 * work); Child/family → garden; Executive → constellation (premium
 * dark mode); Perinatal/anxiety → sunrise; everything else → atrium.
 */
const defaultTemplateForSpecialty = (specialty: string): string => {
  const s = specialty.toLowerCase();
  if (/(trauma|emdr|ptsd)/.test(s)) return "polaroid";
  if (/(couples|family|relationship)/.test(s)) return "front_porch";
  if (/(child|teen|adolescent|family clinic)/.test(s)) return "garden";
  if (/(executive|coaching|leadership|premium)/.test(s)) return "constellation";
  if (/(perinatal|postpartum|anxiety|grief)/.test(s)) return "sunrise";
  return "garden";
};

export const getPortalBySlug = async (slug: string) => {
  const [row] = await db
    .select()
    .from(prospectPortals)
    .where(eq(prospectPortals.slug, slug))
    .limit(1);
  return row ?? null;
};

/**
 * Phase 1B-c: the addon catalog is empty under the tier-pricing model.
 * Tiers don't compose addons — every capability is bundled into a tier
 * price — so no purchasable addon rows are ever served to the portal
 * cart UI. The DB column + reconciler are retained so legacy
 * `addon_catalog` rows can be soft-retired (active=false) without
 * dropping the table; the rep dashboard's historical "Quoted addons"
 * read of older cart rows still resolves slug → label via the row data
 * itself, not this catalog.
 *
 * The ProspectPortal cart UI is rewritten to consume TIERS in 1B-c-2;
 * this stub returns no purchasable rows to that surface in the interim.
 */
const ACTIVE_ADDON_DEFAULTS: Array<{
  slug: string;
  name: string;
  shortDescription: string;
  monthlyCents: number;
  originalMonthlyCents: number | null;
  perPatientCents: number | null;
  setupCents: number;
  bundleSlug: string | null;
}> = [];

/**
 * Returns the active addon catalog. On the first call within a process,
 * we reconcile the DB rows against `ACTIVE_ADDON_DEFAULTS` (derived from
 * `ADDONS` in pricing.ts) so that:
 *   - Newly added catalog entries appear in the portal automatically.
 *   - Renamed labels / re-priced add-ons propagate without manual migration.
 *   - Retired slugs are flipped to `active=false` (preserved for analytics
 *     and old carts, but no longer offered to new prospects).
 *
 * The guard is intentionally process-local: catalog edits ship via deploys,
 * so re-reconciling on every request would burn DB writes for no benefit.
 * Each pod reconciles exactly once on its first portal hit.
 */
let addonCatalogReconciled = false;
const reconcileAddonCatalog = async () => {
  if (addonCatalogReconciled) return;
  const slugs = ACTIVE_ADDON_DEFAULTS.map((a) => a.slug);
  // Upsert the active set: insert new, update name/desc/price/setup on conflict.
  if (ACTIVE_ADDON_DEFAULTS.length === 0) {
    addonCatalogReconciled = true;
    return;
  }
  await db
    .insert(addonCatalog)
    .values(
      ACTIVE_ADDON_DEFAULTS.map((a) => ({ ...a, active: true })),
    )
    .onConflictDoUpdate({
      target: addonCatalog.slug,
      set: {
        name: sql`excluded.name`,
        shortDescription: sql`excluded.short_description`,
        monthlyCents: sql`excluded.monthly_cents`,
        originalMonthlyCents: sql`excluded.original_monthly_cents`,
        perPatientCents: sql`excluded.per_patient_cents`,
        setupCents: sql`excluded.setup_cents`,
        bundleSlug: sql`excluded.bundle_slug`,
        active: sql`true`,
      },
    });
  // Soft-retire any DB row not in the current catalog (legacy slugs).
  if (slugs.length > 0) {
    await db
      .update(addonCatalog)
      .set({ active: false })
      .where(notInArray(addonCatalog.slug, slugs));
  }
  addonCatalogReconciled = true;
};

export const getAddonCatalog = async () => {
  await reconcileAddonCatalog();
  return db
    .select()
    .from(addonCatalog)
    .where(eq(addonCatalog.active, true));
};

/**
 * Builds a normalized {@link PortalEnrichment} from the latest Google Places
 * `lead_enrichment` row for this lead. Returns `null` if no enrichment row
 * exists yet (orchestrator hasn't run, or has run but soft-failed). The
 * portal renderer falls back to SAMPLE defaults in that case.
 *
 * Photo URLs are intentionally proxied through our own
 * `/api/public/portals/:slug/photos/:idx` endpoint so the prospect's browser
 * never sees our `GOOGLE_PLACES_API_KEY`.
 *
 * Hours come from `opening_hours.weekday_text` (already locale-formatted
 * strings like "Monday: 9:00 AM – 5:00 PM"); we split on the first colon to
 * separate `day` from `open` so the existing template `{day, open}` shape
 * works without a parser.
 */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Tracked preview-readiness fields. Completeness is computed as the count of
 * these that have a non-empty value, divided by `TRACKED_FIELDS.length`. The
 * UI renders this as "Enrichment completeness X/N".
 */
const TRACKED_FIELDS = [
  "placeId",
  "formattedAddress",
  "formattedPhone",
  "website",
  "hero",
  "rating",
  "services",
  "team",
  "hours",
  "reviews",
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

const buildPortalEnrichment = async (
  slug: string,
  leadId: number,
): Promise<PortalEnrichment | null> => {
  const rows = await db
    .select()
    .from(leadEnrichment)
    .where(eq(leadEnrichment.leadId, leadId))
    .orderBy(desc(leadEnrichment.fetchedAt));
  if (rows.length === 0) return null;

  const bySource = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!bySource.has(r.sourceKey)) bySource.set(r.sourceKey, r);
  }

  const places = bySource.get("google_places");
  const yelp = bySource.get("yelp_fusion");
  const websiteMeta = bySource.get("website_meta");
  const npi = bySource.get("npi_registry");
  const pt = bySource.get("psychology_today");
  const headway = bySource.get("headway");
  const healthgrades = bySource.get("healthgrades");

  let placeId: string | null = null;
  let formattedAddress: string | null = null;
  let formattedPhone: string | null = null;
  let website: string | null = null;
  let hero: string | null = null;
  let rating: number | null = null;
  let totalReviews: number | null = null;
  let photoUrls: string[] = [];
  let services: string[] = [];
  type TeamEntry = {
    name: string;
    credentials: string | null;
    bio: string | null;
    photo: string | null;
  };
  let team: TeamEntry[] = [];
  const reviews: Array<{
    author: string;
    rating: number;
    text: string;
    relativeTime: string | null;
    source: string;
  }> = [];
  let hours: Array<{ day: string; open: string }> = [];
  const fieldSources: Record<string, string> = {};
  const setField = (field: TrackedField, source: string) => {
    if (!fieldSources[field]) fieldSources[field] = source;
  };

  try {
    // Google Places — primary source for the practice profile.
    if (places && isRecord(places.payload)) {
      const p = places.payload;
      if (typeof p.placeId === "string") {
        placeId = p.placeId;
        setField("placeId", "google_places");
      }
      if (typeof p.formatted_address === "string") {
        formattedAddress = p.formatted_address;
        setField("formattedAddress", "google_places");
      }
      if (typeof p.formatted_phone_number === "string") {
        formattedPhone = p.formatted_phone_number;
        setField("formattedPhone", "google_places");
      }
      if (typeof p.website === "string") {
        website = p.website;
        setField("website", "google_places");
      }
      if (typeof p.rating === "number") {
        rating = p.rating;
        setField("rating", "google_places");
      }
      if (typeof p.user_ratings_total === "number") {
        totalReviews = p.user_ratings_total;
      }
      const photos = Array.isArray(p.photos) ? p.photos : [];
      photoUrls = photos
        .slice(0, 6)
        .map((_, idx) => `/api/public/portals/${slug}/photos/${idx}`);
      if (photoUrls.length > 0) {
        hero = photoUrls[0];
        setField("hero", "google_places");
      }
      const reviewsRaw = Array.isArray(p.reviews) ? p.reviews : [];
      for (const r of reviewsRaw) {
        if (!isRecord(r)) continue;
        const text = typeof r.text === "string" ? r.text.trim() : "";
        const author = typeof r.author_name === "string" ? r.author_name : null;
        const ratingNum =
          typeof r.rating === "number"
            ? Math.max(1, Math.min(5, Math.round(r.rating)))
            : null;
        if (!text || !author || ratingNum == null) continue;
        reviews.push({
          author,
          rating: ratingNum,
          text,
          relativeTime:
            typeof r.relative_time_description === "string"
              ? r.relative_time_description
              : null,
          source: "Google",
        });
      }
      if (reviews.length > 0) setField("reviews", "google_places");
      const oh = p.opening_hours;
      if (isRecord(oh) && Array.isArray(oh.weekday_text)) {
        hours = oh.weekday_text
          .filter((s): s is string => typeof s === "string")
          .map((line) => {
            const idx = line.indexOf(":");
            if (idx === -1) return { day: line, open: "" };
            return {
              day: line.slice(0, idx).trim(),
              open: line.slice(idx + 1).trim(),
            };
          });
        if (hours.length > 0) setField("hours", "google_places");
      }
    }

    // Yelp — augment + fallback. Reviews/photos/hours endpoints surface
    // through `details` and `reviews`.
    if (yelp && isRecord(yelp.payload)) {
      const yp = yelp.payload;
      const biz = isRecord(yp.business) ? yp.business : null;
      const details = isRecord(yp.details) ? yp.details : null;
      const yelpReviews = Array.isArray(yp.reviews) ? yp.reviews : [];

      if (biz) {
        if (rating == null && typeof biz.rating === "number") {
          rating = biz.rating;
          setField("rating", "yelp_fusion");
        }
        if (totalReviews == null && typeof biz.review_count === "number") {
          totalReviews = biz.review_count;
        }
        if (!formattedPhone && typeof biz.display_phone === "string") {
          formattedPhone = biz.display_phone;
          setField("formattedPhone", "yelp_fusion");
        }
        if (!formattedAddress && isRecord(biz.location)) {
          const da = biz.location.display_address;
          if (Array.isArray(da)) {
            const joined = da
              .filter((s): s is string => typeof s === "string")
              .join(", ");
            if (joined) {
              formattedAddress = joined;
              setField("formattedAddress", "yelp_fusion");
            }
          }
        }
        if (!website && typeof biz.url === "string") {
          website = biz.url;
          setField("website", "yelp_fusion");
        }
      }

      // Yelp photos[] — direct CDN URLs, safe to expose.
      if (details && Array.isArray(details.photos)) {
        const yelpPhotos = details.photos.filter(
          (p): p is string => typeof p === "string",
        );
        if (photoUrls.length === 0 && yelpPhotos.length > 0) {
          photoUrls = yelpPhotos.slice(0, 6);
        }
        if (!hero && yelpPhotos.length > 0) {
          hero = yelpPhotos[0];
          setField("hero", "yelp_fusion");
        }
      }

      // Yelp hours[].open[] — { day, start, end }. Convert into the
      // {day, open} portal shape if Google didn't already provide hours.
      if (hours.length === 0 && details && Array.isArray(details.hours)) {
        const dayLabels = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
        const fmtTime = (t: string): string => {
          if (t.length !== 4) return t;
          const h = Number(t.slice(0, 2));
          const m = t.slice(2);
          const period = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 === 0 ? 12 : h % 12;
          return `${h12}:${m} ${period}`;
        };
        const open = isRecord(details.hours[0])
          ? details.hours[0].open
          : null;
        if (Array.isArray(open)) {
          const grouped = new Map<number, string[]>();
          for (const slot of open) {
            if (!isRecord(slot)) continue;
            const day = typeof slot.day === "number" ? slot.day : null;
            const start = typeof slot.start === "string" ? slot.start : null;
            const end = typeof slot.end === "string" ? slot.end : null;
            if (day == null || !start || !end) continue;
            const arr = grouped.get(day) ?? [];
            arr.push(`${fmtTime(start)} – ${fmtTime(end)}`);
            grouped.set(day, arr);
          }
          if (grouped.size > 0) {
            hours = Array.from(grouped.entries())
              .sort(([a], [b]) => a - b)
              .map(([day, slots]) => ({
                day: dayLabels[day] ?? `Day ${day}`,
                open: slots.join(", "),
              }));
            setField("hours", "yelp_fusion");
          }
        }
      }

      // Yelp reviews — append after Google, capped overall at 6.
      for (const r of yelpReviews) {
        if (!isRecord(r)) continue;
        const text = typeof r.text === "string" ? r.text.trim() : "";
        const ratingNum =
          typeof r.rating === "number"
            ? Math.max(1, Math.min(5, Math.round(r.rating)))
            : null;
        const author =
          isRecord(r.user) && typeof r.user.name === "string"
            ? r.user.name
            : null;
        if (!text || !author || ratingNum == null) continue;
        reviews.push({
          author,
          rating: ratingNum,
          text,
          relativeTime:
            typeof r.time_created === "string"
              ? new Date(r.time_created).toLocaleDateString()
              : null,
          source: "Yelp",
        });
      }
      if (reviews.length > 0 && !fieldSources.reviews) {
        setField("reviews", "yelp_fusion");
      }
    }

    // Website meta scrape — hero, services, team, address fallbacks.
    if (websiteMeta && isRecord(websiteMeta.payload)) {
      const wp = websiteMeta.payload;
      if (!website && typeof wp.targetUrl === "string") {
        website = wp.targetUrl;
        setField("website", "website_meta");
      }
      if (!hero && typeof wp.hero === "string") {
        hero = wp.hero;
        setField("hero", "website_meta");
      }
      if (!hero && isRecord(wp.og) && typeof wp.og.image === "string") {
        hero = wp.og.image;
        setField("hero", "website_meta");
      }
      if (services.length === 0 && Array.isArray(wp.services)) {
        services = wp.services.filter(
          (s): s is string => typeof s === "string",
        );
        if (services.length > 0) setField("services", "website_meta");
      }
      if (team.length === 0) {
        // Prefer structured entries (name + bio + credentials) when the
        // scraper found per-card markup; fall back to plain names otherwise
        // so we still register the team field.
        const ts = Array.isArray(wp.teamStructured) ? wp.teamStructured : [];
        const structured: TeamEntry[] = [];
        for (const entry of ts) {
          if (!isRecord(entry) || typeof entry.name !== "string") continue;
          structured.push({
            name: entry.name,
            credentials:
              typeof entry.credentials === "string" ? entry.credentials : null,
            bio: typeof entry.bio === "string" ? entry.bio : null,
            photo: typeof entry.photo === "string" ? entry.photo : null,
          });
        }
        if (structured.length > 0) {
          team = structured;
          setField("team", "website_meta");
        } else if (Array.isArray(wp.team)) {
          const names = wp.team.filter(
            (s): s is string => typeof s === "string",
          );
          if (names.length > 0) {
            team = names.map((name) => ({
              name,
              credentials: null,
              bio: null,
              photo: null,
            }));
            setField("team", "website_meta");
          }
        }
      }
      if (!formattedAddress && typeof wp.streetAddress === "string") {
        formattedAddress = wp.streetAddress;
        setField("formattedAddress", "website_meta");
      }
    }

    // NPI Registry — address + phone fallback when Google/Yelp didn't match.
    if (npi && isRecord(npi.payload)) {
      const np = npi.payload;
      const addrs = Array.isArray(np.addresses) ? np.addresses : [];
      const primary =
        addrs.find(
          (a) => isRecord(a) && a.address_purpose === "LOCATION",
        ) ?? addrs[0];
      if (
        !formattedAddress &&
        isRecord(primary) &&
        typeof primary.address_1 === "string"
      ) {
        const parts = [
          primary.address_1,
          typeof primary.city === "string" ? primary.city : null,
          typeof primary.state === "string" ? primary.state : null,
        ].filter((s): s is string => typeof s === "string");
        if (parts.length) {
          formattedAddress = parts.join(", ");
          setField("formattedAddress", "npi_registry");
        }
      }
      if (
        !formattedPhone &&
        isRecord(primary) &&
        typeof primary.telephone_number === "string"
      ) {
        formattedPhone = primary.telephone_number;
        setField("formattedPhone", "npi_registry");
      }
    }

    // Psychology Today — `specialties` is a strong proxy for services when
    // the practice site didn't expose a Services section. PT also gives us
    // the lead practitioner's bio + headshot, which we promote to position 0
    // of `team` (or replace a thin website-only entry of the same name).
    if (pt && isRecord(pt.payload)) {
      const pp = pt.payload;
      const profile = isRecord(pp.profile) ? pp.profile : null;
      if (
        services.length === 0 &&
        profile &&
        Array.isArray(profile.specialties)
      ) {
        services = profile.specialties
          .filter((s): s is string => typeof s === "string")
          .slice(0, 8);
        if (services.length > 0) setField("services", "psychology_today");
      }
      const ptTeam = Array.isArray(pp.teamStructured) ? pp.teamStructured : [];
      const ptEntry = ptTeam.find(
        (e): e is Record<string, unknown> =>
          isRecord(e) && typeof e.name === "string",
      );
      if (ptEntry) {
        const lead: TeamEntry = {
          name: ptEntry.name as string,
          credentials:
            typeof ptEntry.credentials === "string"
              ? ptEntry.credentials
              : null,
          bio: typeof ptEntry.bio === "string" ? ptEntry.bio : null,
          photo: typeof ptEntry.photo === "string" ? ptEntry.photo : null,
        };
        if (team.length === 0) {
          team = [lead];
          setField("team", "psychology_today");
        } else {
          // Replace any existing entry with the same name; otherwise pin to
          // position 0 so the lead practitioner's enriched bio is rendered
          // first in the preview.
          const idx = team.findIndex(
            (t) => t.name.toLowerCase() === lead.name.toLowerCase(),
          );
          if (idx >= 0) {
            team[idx] = { ...team[idx], ...lead };
          } else {
            team = [lead, ...team];
          }
          // PT is higher quality than website scrape; mark it as the source
          // for team if we now have any bio/photo content.
          if (lead.bio || lead.photo) {
            fieldSources.team = "psychology_today";
          }
        }
      }
    }

    // Headway profile, when matched. The source persists the typed
    // HeadwayProfile shape directly under `payload`; we only need a
    // structural sanity check before exposing it. We also use Headway as a
    // fallback for `services` (its `specialties[]` is high quality) and as
    // a tertiary `team` enrichment when it carries a bio + photo.
    //
    // IMPORTANT: This block runs BEFORE `filledFields` is computed so the
    // completeness metric reflects the final merged state — including any
    // services/team that Headway contributed.
    let headwayProfile:
      | (Record<string, unknown> & { profileUrl: string })
      | null = null;
    if (headway && isRecord(headway.payload)) {
      const hp = headway.payload;
      if (typeof hp.profileUrl === "string") {
        headwayProfile = hp as Record<string, unknown> & {
          profileUrl: string;
        };
        const hpSpecialties = Array.isArray(hp.specialties)
          ? hp.specialties.filter((s): s is string => typeof s === "string")
          : [];
        if (services.length === 0 && hpSpecialties.length > 0) {
          services = hpSpecialties.slice(0, 8);
          setField("services", "headway");
        }
        const hpName =
          typeof hp.name === "string" && hp.name ? (hp.name as string) : null;
        const hpBio = typeof hp.bio === "string" ? (hp.bio as string) : null;
        const hpPhoto =
          typeof hp.photoUrl === "string" ? (hp.photoUrl as string) : null;
        if (
          team.length === 0 &&
          (hpName || hpBio || hpPhoto)
        ) {
          team = [
            {
              name: hpName ?? "",
              credentials: null,
              bio: hpBio,
              photo: hpPhoto,
            },
          ];
          if (hpName) setField("team", "headway");
        } else if (team.length > 0 && hpPhoto) {
          // Existing team comes from PT / website scrape but is missing
          // a headshot — Headway tends to have the cleanest provider
          // photo, so fill in the gap on the matching member instead of
          // leaving an empty avatar. Match by case-insensitive name when
          // possible; otherwise default to position 0 (the lead).
          const target =
            (hpName &&
              team.find(
                (m) =>
                  m.name.trim().toLowerCase() ===
                  (hpName as string).trim().toLowerCase(),
              )) ||
            team[0];
          if (target && !target.photo) {
            target.photo = hpPhoto;
            // Don't overwrite the team source label — only this member's
            // photo came from Headway, the names/bios still belong to the
            // earlier source. Reps can still see Headway in the data
            // sources panel via headwayProfile below.
          }
        }
      }
    }

    // Healthgrades — tertiary fallback for the lead practitioner's bio +
    // photo, primarily useful for psychiatrists (MD/DO) who aren't on
    // Headway / Psychology Today. We only fill `team` if no earlier source
    // already did, so we never overwrite a higher-quality match. Specialties
    // also feed into `services` when nothing else surfaced any.
    if (healthgrades && isRecord(healthgrades.payload)) {
      const hg = healthgrades.payload;
      const hgName = typeof hg.name === "string" ? hg.name : null;
      const hgBio = typeof hg.bio === "string" ? hg.bio : null;
      const hgPhoto = typeof hg.photoUrl === "string" ? hg.photoUrl : null;
      const hgSpecialties = Array.isArray(hg.specialties)
        ? hg.specialties.filter((s): s is string => typeof s === "string")
        : [];
      if (services.length === 0 && hgSpecialties.length > 0) {
        services = hgSpecialties.slice(0, 8);
        setField("services", "healthgrades");
      }
      if (team.length === 0 && (hgName || hgBio || hgPhoto)) {
        team = [
          {
            name: hgName ?? "",
            credentials: null,
            bio: hgBio,
            photo: hgPhoto,
          },
        ];
        if (hgName) setField("team", "healthgrades");
      }
    }

    const filledFields = TRACKED_FIELDS.filter((f) => {
      switch (f) {
        case "placeId":
          return !!placeId;
        case "formattedAddress":
          return !!formattedAddress;
        case "formattedPhone":
          return !!formattedPhone;
        case "website":
          return !!website;
        case "hero":
          return !!hero;
        case "rating":
          return rating != null;
        case "services":
          return services.length > 0;
        case "team":
          return team.length > 0;
        case "hours":
          return hours.length > 0;
        case "reviews":
          return reviews.length > 0;
      }
    }).length;

    const fetchedAt =
      (
        places ??
        yelp ??
        websiteMeta ??
        npi ??
        pt ??
        headway ??
        healthgrades ??
        rows[0]
      ).fetchedAt;
    return {
      placeId,
      formattedAddress,
      formattedPhone,
      website,
      rating,
      totalReviews,
      photoUrls,
      hero,
      services,
      team,
      reviews: reviews.slice(0, 6),
      hours,
      fetchedAt: fetchedAt.toISOString(),
      fieldsCompleteness: {
        filled: filledFields,
        total: TRACKED_FIELDS.length,
      },
      fieldSources,
      headway: headwayProfile as PortalEnrichment["headway"],
    };
  } catch (err) {
    logger.warn(
      { err, leadId, slug },
      "buildPortalEnrichment: malformed payload, returning null",
    );
    return null;
  }
};

/**
 * Public accessor for the field-level enrichment view. Wraps
 * `buildPortalEnrichment` so the dashboard route can echo
 * `fieldsCompleteness` and `fieldSources` to the rep without re-implementing
 * the merge logic.
 */
export const getPortalEnrichmentForLead = async (
  leadId: number,
): Promise<PortalEnrichment | null> => {
  const portal = await ensurePortalForLead(leadId);
  return buildPortalEnrichment(portal.slug, leadId);
};

/**
 * Inspects the field-attribution map and returns the source keys that, if
 * (re-)run, are most likely to fill the remaining critical preview gaps.
 *
 * Critical fields = the ones the prospect actually sees first: hero image,
 * address/phone, services, reviews. Hours and team are nice-to-have.
 */
const sourcesForMissingCriticalFields = (
  enrichment: PortalEnrichment,
): string[] => {
  const present = new Set(Object.keys(enrichment.fieldSources));
  const targets = new Set<string>();
  if (!present.has("hero")) {
    targets.add("website_meta");
    targets.add("yelp_fusion");
    targets.add("google_places");
  }
  if (!present.has("services")) {
    targets.add("website_meta");
    targets.add("psychology_today");
  }
  if (!present.has("reviews")) {
    targets.add("google_places");
    targets.add("yelp_fusion");
  }
  if (!present.has("formattedAddress") || !present.has("formattedPhone")) {
    targets.add("google_places");
    targets.add("yelp_fusion");
    targets.add("npi_registry");
  }
  return Array.from(targets);
};

/**
 * How long after an enrichment_run finishes for a lead before we'll auto-
 * trigger another one from a portal page-load. Prevents thundering-herd /
 * runaway upstream spend when a lead has no resolvable Google place (every
 * page hit would otherwise re-spawn a run that produces no rows).
 */
const AUTO_ENRICH_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

export const shouldAutoEnrichLead = async (leadId: number): Promise<boolean> => {
  const [latest] = await db
    .select({ finishedAt: enrichmentRuns.finishedAt })
    .from(enrichmentRuns)
    .where(eq(enrichmentRuns.leadId, leadId))
    .orderBy(desc(enrichmentRuns.startedAt))
    .limit(1);
  if (!latest) return true;
  // In-flight (no finishedAt yet) → don't pile on; a parallel page-load
  // already kicked off a run.
  if (!latest.finishedAt) return false;
  return Date.now() - latest.finishedAt.getTime() > AUTO_ENRICH_COOLDOWN_MS;
};

/**
 * Returns the raw photo_reference string for a given Places photo index, or
 * `null` if the lead has no enrichment / the index is out of range. Used by
 * the public photo-proxy route to resolve `/photos/:idx` to a Places URL.
 */
export const getPortalPhotoReference = async (
  leadId: number,
  idx: number,
): Promise<string | null> => {
  if (!Number.isFinite(idx) || idx < 0 || idx > 9) return null;
  const [row] = await db
    .select()
    .from(leadEnrichment)
    .where(
      and(
        eq(leadEnrichment.leadId, leadId),
        eq(leadEnrichment.sourceKey, "google_places"),
      ),
    )
    .orderBy(desc(leadEnrichment.fetchedAt))
    .limit(1);
  if (!row) return null;
  const p = row.payload as Record<string, unknown>;
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const photo = photos[idx] as Record<string, unknown> | undefined;
  if (!photo || typeof photo.photo_reference !== "string") return null;
  return photo.photo_reference;
};

export const buildPortalPublicResponse = async (
  portal: ProspectPortal,
): Promise<PortalPublicResponse> => {
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, portal.leadId))
    .limit(1);
  if (!lead) throw notFound("Lead not found");
  const rep = lead.claimedByRepId
    ? (
        await db
          .select()
          .from(salesReps)
          .where(eq(salesReps.id, lead.claimedByRepId))
          .limit(1)
      )[0] ?? null
    : null;
  const addons = await getAddonCatalog();
  const activeSlugs = new Set(addons.map((a) => a.slug));

  const tk =
    normalizeTemplateKey(portal.selectedTemplate) ?? "garden";

  const latestCart = await getLatestCart(portal.id);
  // Filter retired slugs out of the persisted cart before echoing it to
  // the client. Old carts may reference add-ons that have been retired
  // since the prospect's last visit; surfacing them would over-count the
  // toolbar's "+N add-ons" badge and inflate analytics on reserve.
  const cart = latestCart
    ? {
        templateKey:
          normalizeTemplateKey(latestCart.templateKey) ?? tk,
        addonSlugs: (latestCart.addonSlugs ?? []).filter((s) =>
          activeSlugs.has(s),
        ),
      }
    : null;

  const enrichment = await buildPortalEnrichment(portal.slug, portal.leadId);
  // Build the rich preview content (real practice name, services with
  // descriptions, AI-rewritten mission, hero image, team with bios, crawled
  // pages with rewrites). Lazy-imported to break a circular import:
  // previewContent.ts → portals.ts → previewContent.ts. Wrapped in try/catch
  // because a failure here must NEVER break the prospect-facing portal —
  // we degrade to the lighter `enrichment` field + SAMPLE defaults instead.
  let previewContent: PreviewContent | null = null;
  let pages: PreviewWebsitePage[] = [];
  // Fix #77 (audit 2026-05-18) - Replit autoscale kills idle requests at 25s.
  // buildPreviewContent can take 30-40s on a freshly-enriched lead (AI synthesis + page rewrites).
  // Race it against an 18s budget; on timeout we still ship the snapshot-driven response,
  // and the client's next reload picks up the cached AI output.
  try {
    const mod = await import("./previewContent");
    const built = await Promise.race([
      mod.buildPreviewContent(portal.leadId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("buildPreviewContent timeout 18s")), 18_000),
      ),
    ]);
    previewContent = built.content;
    pages = built.pages;
  } catch (err) {
    logger.warn(
      { err, leadId: portal.leadId, slug: portal.slug },
      "buildPreviewContent failed for portal — degrading to enrichment-only",
    );
  }
  // 2026-05-14: rep-set hero image override (audit fix #6). When the
  // enrichment pipeline can't find a PT/Headway/first-party photo, the
  // rep pastes a URL via the LeadDetail dashboard and we honour it here.
  const customHeroImageUrl = (
    portal.customizations as { heroImageUrl?: string } | null
  )?.heroImageUrl;
  if (previewContent && customHeroImageUrl) {
    previewContent = { ...previewContent, heroImage: customHeroImageUrl };
  }
  // If we have no enrichment yet AND at least one source is configured, kick
  // off a fire-and-forget run so the next page-load surfaces real data. We do
  // NOT block the current response — the prospect sees SAMPLE defaults this
  // turn and refreshed personalized data on their next visit (typically
  // seconds later).
  //
  // Gated by `shouldAutoEnrichLead`: if the orchestrator already ran in the
  // last AUTO_ENRICH_COOLDOWN_MS for this lead (success OR fail OR no-match)
  // we skip. This prevents runaway upstream spend for leads where no source
  // ever finds a match — soft-fails persist no enrichment row, so without
  // this gate every page load would re-spawn a fruitless run.
  if (!enrichment && isAnyEnrichmentSourceConfigured()) {
    void shouldAutoEnrichLead(portal.leadId)
      .then((ok) => {
        if (!ok) return;
        return runEnrichmentForLead(portal.leadId, "auto");
      })
      .catch((err) =>
        logger.warn(
          { err, leadId: portal.leadId, slug: portal.slug },
          "auto-enrichment on portal load failed",
        ),
      );
  } else if (
    enrichment &&
    enrichment.fieldsCompleteness.filled <
      enrichment.fieldsCompleteness.total &&
    isAnyEnrichmentSourceConfigured()
  ) {
    // Have some enrichment but not all preview-ready fields. Kick off a
    // targeted refresh limited to the sources most likely to fill the gaps,
    // so we don't waste upstream calls on sources whose contribution is
    // already present.
    const targets = sourcesForMissingCriticalFields(enrichment);
    if (targets.length > 0) {
      void shouldAutoEnrichLead(portal.leadId)
        .then((ok) => {
          if (!ok) return;
          return runEnrichmentForLeadTargeted(portal.leadId, targets, "auto");
        })
        .catch((err) =>
          logger.warn(
            { err, leadId: portal.leadId, slug: portal.slug, targets },
            "targeted auto-enrichment on portal load failed",
          ),
        );
    }
  }

  return {
    slug: portal.slug,
    accessToken: portal.accessToken,
    ogSignature: computeOgSignature(portal.slug),
    practice: lead.practice,
    name: lead.name,
    specialty: lead.specialty,
    city: lead.city,
    state: lead.state,
    phone: lead.phone,
    email: lead.email,
    locale: (lead.locale === "es" ? "es" : "en") as "en" | "es",
    profileBlurb: lead.profileBlurb,
    selectedTemplate: tk,
    customizations: (portal.customizations ?? {}) as PortalCustomizations,
    enrichmentSnapshot: portal.enrichmentSnapshot ?? null,
    enrichment,
    previewContent,
    pages,
    addons: addons.map((a) => ({
      slug: a.slug,
      name: a.name,
      shortDescription: a.shortDescription,
      monthlyCents: a.monthlyCents,
      perPatientCents: a.perPatientCents,
      setupCents: a.setupCents,
      bundleSlug: a.bundleSlug,
      originalMonthlyCents: a.originalMonthlyCents ?? null,
    })),
    cart,
    rep: rep
      ? {
          displayName: rep.displayName,
          // First token of the display name. Used by the portal's
          // "Talk to a human" panel so the rep is a person, not a full name.
          firstName:
            rep.displayName.trim().split(/\s+/)[0] || rep.displayName,
          promoCode: rep.promoCode ?? "",
          phone: rep.phone ?? null,
          email: rep.email ?? null,
          avatarUrl: rep.avatarUrl ?? null,
        }
      : null,
    baseMonthlyCents: 19900,
    baseSetupCents: 0,
  };
};

/**
 * Records an "opened" event and bumps open counters. Called once per fresh
 * portal load; the client may also fire `template_view` etc. as the prospect
 * navigates.
 *
 * Side-effect: after persisting the open, runs `evaluateHotLead` which fires
 * a rep notification when the recent open pattern crosses a hot threshold
 * (≥ HOT_BURST_OPEN_COUNT opens in HOT_BURST_WINDOW_MS, OR a revisit gap
 * > HOT_REVISIT_GAP_MS). The detector is fire-and-forget on errors — open
 * tracking must never fail because of notification logic.
 */
// LOT 2.7 — collapse rapid same-session re-opens. QA Round 6 found 7+
// `opened` events on Gail's portal in a single day, mostly from reload
// noise. The rep-dashboard `visitOpenCount` field continues to bump on
// every hit (it's the canonical visit counter); only the per-event log
// is throttled, since the event stream is what the hot-lead detector +
// daily-digest consume.
export const OPENED_EVENT_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Pure decision function: given the prior opened-event timestamp for the
 * (portal, session) pair (or null if none / no session), return true iff
 * the incoming open should produce a fresh row in `portal_events`.
 *
 * Exported for unit-tests so we can pin the boundary cases without
 * mocking the db.
 */
export const shouldRecordOpenedEvent = (
  priorOccurredAt: Date | null | undefined,
  nowMs: number,
  windowMs: number = OPENED_EVENT_THROTTLE_MS,
): boolean => {
  if (!priorOccurredAt) return true;
  const delta = nowMs - priorOccurredAt.getTime();
  if (delta < 0) return true; // clock skew — fail open, log the event
  return delta >= windowMs;
};

export const recordPortalOpen = async (
  portalId: number,
  sessionId: string | null = null,
) => {
  const now = new Date();

  // Counter side of the bookkeeping ALWAYS runs — the rep dashboard's
  // visitOpenCount must match every real GET, not just the de-duped
  // event stream.
  await db
    .update(prospectPortals)
    .set({
      openCount: sql`${prospectPortals.openCount} + 1`,
      lastOpenedAt: now,
      firstOpenedAt: sql`coalesce(${prospectPortals.firstOpenedAt}, now())`,
      updatedAt: now,
    })
    .where(eq(prospectPortals.id, portalId));

  // Event side — only insert if there's no `opened` row for this
  // (portal, session) in the last 5 minutes. Without a session id we
  // can't dedupe (unknown actor), so we record the event.
  let shouldInsert = true;
  if (sessionId) {
    const [prior] = await db
      .select({ occurredAt: portalEvents.occurredAt })
      .from(portalEvents)
      .where(
        and(
          eq(portalEvents.portalId, portalId),
          eq(portalEvents.eventType, "opened"),
          eq(portalEvents.sessionId, sessionId),
        ),
      )
      .orderBy(desc(portalEvents.id))
      .limit(1);
    shouldInsert = shouldRecordOpenedEvent(prior?.occurredAt, now.getTime());
  }
  if (shouldInsert) {
    await db.insert(portalEvents).values({
      portalId,
      eventType: "opened",
      sessionId: sessionId ?? undefined,
      occurredAt: now,
    });
  }

  try {
    await evaluateHotLead(portalId, now);
  } catch (err) {
    logger.warn({ err, portalId }, "evaluateHotLead failed (non-fatal)");
  }
};

/**
 * After persisting a fresh "opened" event, decide whether this open crosses
 * the "hot lead" threshold and, if so, notify the assigned rep.
 *
 * Triggers (either fires):
 *   - Burst:   ≥ HOT_BURST_OPEN_COUNT opens within HOT_BURST_WINDOW_MS.
 *   - Revisit: gap between this open and the immediately preceding one
 *              exceeds HOT_REVISIT_GAP_MS (e.g. they came back the next day).
 *
 * Dedup:
 *   - Skip silently if `lastHotAlertAt` is within HOT_DEDUPE_COOLDOWN_MS.
 *
 * The detection query is portal-scoped (uses `portal_events_portal_idx`),
 * filters by event type and time, and is bounded with LIMIT — never a full
 * table scan.
 */
const evaluateHotLead = async (
  portalId: number,
  now: Date,
): Promise<void> => {
  // Cheap pre-check: read the portal's existing dedup timestamp + assigned
  // rep in a single small query before doing any analytical work.
  const [portal] = await db
    .select({
      id: prospectPortals.id,
      leadId: prospectPortals.leadId,
      lastHotAlertAt: prospectPortals.lastHotAlertAt,
    })
    .from(prospectPortals)
    .where(eq(prospectPortals.id, portalId))
    .limit(1);
  if (!portal) return;

  if (
    portal.lastHotAlertAt &&
    now.getTime() - portal.lastHotAlertAt.getTime() < HOT_DEDUPE_COOLDOWN_MS
  ) {
    return; // recently alerted — stay out of the rep's way
  }

  // Pull just the recent "opened" events we need to evaluate both rules.
  // LIMIT capped so the query is constant-cost regardless of total opens.
  // Window is the larger of the two thresholds so a single query satisfies
  // both rules.
  const sinceMs = Math.max(HOT_BURST_WINDOW_MS, HOT_REVISIT_GAP_MS) + 1000;
  const since = new Date(now.getTime() - sinceMs);
  const recentOpens = await db
    .select({ occurredAt: portalEvents.occurredAt })
    .from(portalEvents)
    .where(
      and(
        eq(portalEvents.portalId, portalId),
        eq(portalEvents.eventType, "opened"),
        gte(portalEvents.occurredAt, since),
      ),
    )
    .orderBy(desc(portalEvents.occurredAt))
    .limit(20);

  if (recentOpens.length === 0) return;

  // Burst rule: ≥ HOT_BURST_OPEN_COUNT opens within HOT_BURST_WINDOW_MS
  // ending at `now`. recentOpens is already DESC; count items inside window.
  const burstCutoff = now.getTime() - HOT_BURST_WINDOW_MS;
  const opensInBurstWindow = recentOpens.filter(
    (r) => r.occurredAt.getTime() >= burstCutoff,
  ).length;
  const burstFires = opensInBurstWindow >= HOT_BURST_OPEN_COUNT;

  // Revisit rule: this open's gap to the previous open exceeds
  // HOT_REVISIT_GAP_MS. recentOpens[0] is the just-recorded open; [1] is
  // the prior. If we don't see a prior in the window, look one step further
  // back so a 25-hour gap still counts.
  let revisitFires = false;
  let revisitGapMs: number | null = null;
  if (recentOpens.length >= 2) {
    const previousOpen = recentOpens[1].occurredAt.getTime();
    revisitGapMs = recentOpens[0].occurredAt.getTime() - previousOpen;
    revisitFires = revisitGapMs > HOT_REVISIT_GAP_MS;
  } else {
    // Only one open in the wide window — check if there's an even older
    // one to compare against. (Cheap: indexed on portal_id, LIMIT 1.)
    const [olderOpen] = await db
      .select({ occurredAt: portalEvents.occurredAt })
      .from(portalEvents)
      .where(
        and(
          eq(portalEvents.portalId, portalId),
          eq(portalEvents.eventType, "opened"),
          sql`${portalEvents.occurredAt} < ${since}`,
        ),
      )
      .orderBy(desc(portalEvents.occurredAt))
      .limit(1);
    if (olderOpen) {
      revisitGapMs = now.getTime() - olderOpen.occurredAt.getTime();
      revisitFires = revisitGapMs > HOT_REVISIT_GAP_MS;
    }
  }

  if (!burstFires && !revisitFires) return;

  // Resolve the assigned rep + lead context. If the lead isn't claimed, no
  // one to notify.
  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      practice: leads.practice,
      claimedByRepId: leads.claimedByRepId,
    })
    .from(leads)
    .where(eq(leads.id, portal.leadId))
    .limit(1);
  if (!lead?.claimedByRepId) return;

  // Stamp the dedup window FIRST so a parallel open in the same instant
  // (e.g. prospect double-tapped) can't fire a second notification.
  await db
    .update(prospectPortals)
    .set({ lastHotAlertAt: now, updatedAt: now })
    .where(eq(prospectPortals.id, portalId));

  // Compose a body that tells the rep what specifically tripped the alert.
  const firstName = lead.name.split(/\s+/)[0] || lead.name;
  const reasons: string[] = [];
  if (burstFires) {
    reasons.push(
      `${opensInBurstWindow} opens in the last ${Math.round(HOT_BURST_WINDOW_MS / 60000)} minutes`,
    );
  }
  if (revisitFires && revisitGapMs !== null) {
    const hours = Math.round(revisitGapMs / (60 * 60 * 1000));
    reasons.push(`came back after ${hours}h away`);
  }
  const body = `${firstName} just reopened their preview — ${reasons.join(" · ")}.`;

  // Avoid an import cycle by lazy-loading the notifications service.
  const { notify } = await import("./notifications");
  await notify({
    repId: lead.claimedByRepId,
    type: "lead.hot",
    title: `Hot lead: ${lead.name}`,
    body,
    payload: {
      leadId: lead.id,
      portalId,
      reasons: { burstFires, revisitFires, opensInBurstWindow, revisitGapMs },
    },
    linkUrl: `/leads/${lead.id}`,
  });

  logger.info(
    {
      portalId,
      leadId: lead.id,
      repId: lead.claimedByRepId,
      burstFires,
      revisitFires,
      opensInBurstWindow,
      revisitGapMs,
    },
    "hot-lead notification fired",
  );
};

export const patchPortalCustomizations = async (
  slug: string,
  patch: { selectedTemplate?: string; customizations?: PortalCustomizations },
) => {
  const portal = await getPortalBySlug(slug);
  if (!portal) throw notFound("Portal not found");
  // B2 (founder 2026-05-19) — field-lock filter. When a QC-validated
  // lead has fields on its lock list (template_key, headline,
  // primary_language, copy overrides, etc.), the rep can still go
  // through this writer to switch e.g. the template, but the locked
  // names are silently filtered out of the patch so the validated
  // copy / palette / headline survive a template flip.
  const locked = portal.leadId
    ? await getLockedFieldSet(portal.leadId)
    : new Set<string>();
  const skipped: string[] = [];
  const setPatch: Partial<typeof prospectPortals.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.selectedTemplate) {
    // ASH-8: the template *choice* is not locked by QC validation. The lock
    // is meant to protect the validated copy/headline/palette so they survive
    // a template flip (B2) — NOT to block switching templates. Previously
    // `template_key` sat in the lock set, which silently dropped the rep's
    // template change and reverted the lead to its specialty-suggested
    // default (e.g. "constellation"), exactly the ASH-8 complaint. Always
    // apply the template; the per-field copy locks below still protect the
    // validated text/palette.
    setPatch.selectedTemplate = patch.selectedTemplate;
  }
  if (patch.customizations) {
    // Drop any locked keys from the inbound customisation patch before
    // merging on top of the persisted one. The keys we honour map onto
    // the PortalCustomizations Zod schema 1:1.
    const inbound = patch.customizations as Record<string, unknown>;
    const filtered: Record<string, unknown> = {};
    for (const k of Object.keys(inbound)) {
      if (locked.has(k)) {
        skipped.push(k);
      } else {
        filtered[k] = inbound[k];
      }
    }
    setPatch.customizations = {
      ...(portal.customizations ?? {}),
      ...filtered,
    } as PortalCustomizations;
  }
  await db
    .update(prospectPortals)
    .set(setPatch)
    .where(eq(prospectPortals.id, portal.id));
  // Log a customize event so the rep timeline shows the change. The
  // skipped-fields list is appended so an admin can see when the
  // lock list shielded a write.
  const metadata: Record<string, unknown> = patch.customizations
    ? (patch.customizations as Record<string, unknown>)
    : {};
  if (skipped.length > 0) (metadata as Record<string, unknown>).locked_fields_skipped = skipped;
  await db.insert(portalEvents).values({
    portalId: portal.id,
    eventType: patch.selectedTemplate ? "template_selected" : "customize",
    templateKey: patch.selectedTemplate,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });
};

/**
 * Server-internal event types — never accepted from the public POST /events
 * endpoint (those go through the strict zod enum). These are recorded by
 * trusted server code (send-invite handler, re-engagement worker).
 */
export type ServerPortalEventType =
  | "invite_sent"
  | "reengagement_j3_email"
  | "reengagement_j7_email"
  | "reengagement_j14_email"
  | "reengagement_j30_email"
  | "reengagement_sequence_closed"
  // Retained for backwards-compat with portal_events rows written by the
  // pre-Task-#168 implementation. Never emitted by current code.
  | "reengagement_j8_sms"
  | "reengagement_j15_rep_alert";

type RecordPortalEventInput =
  | PortalEventRequest
  | {
      eventType: ServerPortalEventType;
      templateKey?: PortalEventRequest["templateKey"];
      addonSlug?: string;
      metadata?: Record<string, unknown>;
      sessionId?: string;
      durationMs?: number;
    };

export const recordPortalEvent = async (
  slug: string,
  evt: RecordPortalEventInput,
) => {
  const portal = await getPortalBySlug(slug);
  if (!portal) throw notFound("Portal not found");
  await db.insert(portalEvents).values({
    portalId: portal.id,
    eventType: evt.eventType,
    templateKey: evt.templateKey,
    addonSlug: evt.addonSlug,
    metadata: evt.metadata ?? null,
    sessionId: evt.sessionId,
    durationMs: evt.durationMs,
  });
};

export const saveCart = async (
  slug: string,
  cart: PortalCartRequest,
  opts: { source: "prospect" | "rep" } = { source: "prospect" },
) => {
  const portal = await getPortalBySlug(slug);
  if (!portal) throw notFound("Portal not found");
  const addons = await getAddonCatalog();
  const knownSlugs = new Set(addons.map((a) => a.slug));
  // LOT 1.3 — unknown slugs used to be dropped silently here, which
  // both masked client bugs and gave token-holders an undetectable
  // smoke test for whether the cart endpoint was live. Surface them
  // explicitly so the client can self-correct and the rep timeline
  // doesn't include phantom carts that were silently de-junked.
  const offending = cart.addonSlugs.filter((s) => !knownSlugs.has(s));
  if (offending.length > 0) {
    throw badRequest("Unknown add-on slug(s).", {
      code: "unknown_addons",
      offending,
    });
  }
  const selected = addons.filter((a) => cart.addonSlugs.includes(a.slug));
  const monthlyTotalCents =
    19900 + selected.reduce((acc, a) => acc + a.monthlyCents, 0);
  const setupTotalCents = selected.reduce((acc, a) => acc + a.setupCents, 0);
  await db.insert(portalCarts).values({
    portalId: portal.id,
    templateKey: cart.templateKey,
    addonSlugs: cart.addonSlugs,
    monthlyTotalCents,
    setupTotalCents,
    source: opts.source,
  });
  await db.insert(portalEvents).values({
    portalId: portal.id,
    eventType: "cart_update",
    templateKey: cart.templateKey,
    metadata: {
      addonSlugs: cart.addonSlugs,
      monthlyTotalCents,
      setupTotalCents,
      source: opts.source,
    },
  });
  return { monthlyTotalCents, setupTotalCents };
};

export type CartUpdatePayload = {
  templateKey: string;
  addonSlugs: string[];
  monthlyTotalCents: number;
  setupTotalCents: number;
  source: "prospect" | "rep";
};

/**
 * LOT 2.6 — pure comparator. Returns true iff the prior event row's
 * templateKey + metadata match `incoming` byte-for-byte (including
 * addonSlugs order). Exported so the comparison can be unit-tested
 * without the db mock.
 */
export const cartUpdateMatchesPrior = (
  prior: {
    templateKey: string | null;
    metadata: Record<string, unknown> | null;
  } | null | undefined,
  incoming: CartUpdatePayload,
): boolean => {
  if (!prior) return false;
  if (prior.templateKey !== incoming.templateKey) return false;
  const meta = prior.metadata;
  if (!meta) return false;
  if (meta.monthlyTotalCents !== incoming.monthlyTotalCents) return false;
  if (meta.setupTotalCents !== incoming.setupTotalCents) return false;
  if (meta.source !== incoming.source) return false;
  const slugs = meta.addonSlugs;
  if (!Array.isArray(slugs)) return false;
  if (slugs.length !== incoming.addonSlugs.length) return false;
  for (let i = 0; i < incoming.addonSlugs.length; i++) {
    if (slugs[i] !== incoming.addonSlugs[i]) return false;
  }
  return true;
};

/**
 * LOT 2.6 — fetches the most recent cart_update event for `portalId`
 * and compares it to `incoming`. Skipping is one round-trip even on
 * the happy path; on a duplicate we save the insert.
 */
export const isDuplicateCartUpdateEvent = async (
  portalId: number,
  incoming: CartUpdatePayload,
): Promise<boolean> => {
  const [last] = await db
    .select({
      templateKey: portalEvents.templateKey,
      metadata: portalEvents.metadata,
    })
    .from(portalEvents)
    .where(
      and(
        eq(portalEvents.portalId, portalId),
        eq(portalEvents.eventType, "cart_update"),
      ),
    )
    .orderBy(desc(portalEvents.id))
    .limit(1);
  return cartUpdateMatchesPrior(last, incoming);
};

/**
 * Captures waitlist signals for any add-ons in the cart. Each add-on becomes
 * a row in `addon_interest_signals` with locked-in pricing. Idempotent on
 * (leadId, addonSlug, signalKind, createdAt) by virtue of being append-only:
 * we explicitly *want* to know that a prospect raised their hand twice.
 */
export const captureAddonSignals = async (
  leadId: number,
  portalId: number | null,
  addonSlugs: string[],
  signalKind: "waitlist" | "reserved_with",
) => {
  if (addonSlugs.length === 0) return;
  const addons = await getAddonCatalog();
  const map = new Map(addons.map((a) => [a.slug, a]));
  const rows = addonSlugs
    .map((slug) => map.get(slug))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({
      leadId,
      portalId,
      addonSlug: a.slug,
      signalKind,
      lockedMonthlyCents: a.monthlyCents,
      lockedPerPatientCents: a.perPatientCents,
      lockedSetupCents: a.setupCents,
    }));
  if (rows.length > 0) await db.insert(addonInterestSignals).values(rows);
};

export const getLatestPortalActivity = async (portalId: number, limit = 50) =>
  db
    .select()
    .from(portalEvents)
    .where(eq(portalEvents.portalId, portalId))
    .orderBy(desc(portalEvents.occurredAt))
    .limit(limit);

export const getLatestCart = async (portalId: number) => {
  // LOT 1.3 — only surface prospect-sourced cart rows. A rep QA write
  // or a residual tamper artifact (source='rep' or anything other than
  // 'prospect') must never bleed into the prospect-facing GET payload,
  // the pre-call briefing, or the rep dashboard's "what the prospect
  // sees" view.
  const [row] = await db
    .select()
    .from(portalCarts)
    .where(
      and(
        eq(portalCarts.portalId, portalId),
        eq(portalCarts.source, "prospect"),
      ),
    )
    .orderBy(desc(portalCarts.occurredAt))
    .limit(1);
  return row ?? null;
};

export const markInviteSent = async (portalId: number) => {
  await db
    .update(prospectPortals)
    .set({ inviteSentAt: new Date(), updatedAt: new Date() })
    .where(eq(prospectPortals.id, portalId));
};

export const markReserved = async (portalId: number) => {
  await db
    .update(prospectPortals)
    .set({ reservedAt: new Date(), updatedAt: new Date() })
    .where(eq(prospectPortals.id, portalId));
};
