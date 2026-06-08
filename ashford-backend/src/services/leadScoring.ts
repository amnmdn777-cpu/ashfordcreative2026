/**
 * Lead quality scoring (#212).
 *
 * Computes a 0-100 score for each lead by walking the latest enrichment
 * payloads and the lead row itself, awarding points for each "this lead
 * is worth a rep's time" signal we have evidence of:
 *
 *   - Google Places: review count + average rating (proves real, established practice)
 *   - Lead row:      has email, has current website, profile blurb completeness
 *   - Lead row:      provenance (`source`) — inbound contact-form is gold,
 *                    apify scrape is decent, recycled is suspicious
 *   - Website scrape: tech stack tier — Wix/Squarespace owners tend to upgrade
 *                    faster than custom-built sites
 *   - Healthgrades:  presence proves the practice is licensed + real
 *
 * Each signal is bounded so a single noisy data source can't dominate.
 * The total is clamped to [0, 100] and bucketed into tier A ≥ 70, B ≥ 40,
 * C otherwise (A = best, C = lowest — neutral labels chosen by the rep
 * team to avoid temperature words). Both the total and a per-signal
 * breakdown are persisted
 * onto `leads.lead_score` and `leads.score_breakdown` so the rep dashboard
 * can show "why this is hot" in a tooltip without a second round-trip.
 *
 * This service NEVER throws — a missing enrichment row, a malformed
 * payload, a deleted lead — all become a NULL score, which sorts to the
 * end of the available pool. Safe to call fire-and-forget from the
 * enrichment orchestrator.
 */

import { db, leads, leadEnrichment } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

export type ScoreSignal = {
  key: string;
  label: string;
  points: number;
  max: number;
  note?: string;
};

export type ScoreTier = "A" | "B" | "C";

export type ScoreBreakdown = {
  total: number;
  tier: ScoreTier;
  signals: ScoreSignal[];
};

// Tier cutoffs are calibrated against the live prod distribution
// (median ≈ 32, P85 ≈ 37 — scores cluster tightly because most signals
// behave near-binary). With A≥70/B≥40 basically everyone collapsed into
// tier C, defeating the badge. New cutoffs target a Gaussian-ish split
// of roughly 25-30% A / 45-55% B / 20-25% C against the current scoring
// surface. Revisit when scoring discrimination improves (e.g. when
// review-density / web-stack signals get more bands).
export const tierForScore = (score: number | null | undefined): ScoreTier | null => {
  if (score == null) return null;
  if (score >= 37) return "A";
  if (score >= 28) return "B";
  return "C";
};

const MAX_SCORE = 100;

// --- Signal scorers --------------------------------------------------------
// Each scorer returns 0..max points and the optional note shown in the
// tooltip. They each accept the union of the lead row + the latest
// payload by source key, and pull only what they need.

type Ctx = {
  lead: typeof leads.$inferSelect;
  payloads: Map<string, Record<string, unknown>>;
};

const numFromUnknown = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const strFromUnknown = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const googleReviewsSignal = (ctx: Ctx): ScoreSignal => {
  const p = ctx.payloads.get("google_places") ?? {};
  const count = numFromUnknown(p.user_ratings_total) ?? numFromUnknown(p.userRatingsTotal);
  if (count == null) {
    return { key: "google_reviews", label: "Google review volume", points: 0, max: 15, note: "no Google data" };
  }
  let pts = 0;
  if (count >= 51) pts = 15;
  else if (count >= 11) pts = 10;
  else if (count >= 1) pts = 5;
  return {
    key: "google_reviews",
    label: "Google review volume",
    points: pts,
    max: 15,
    note: `${count} review${count === 1 ? "" : "s"}`,
  };
};

const googleRatingSignal = (ctx: Ctx): ScoreSignal => {
  const p = ctx.payloads.get("google_places") ?? {};
  const rating = numFromUnknown(p.rating);
  if (rating == null) {
    return { key: "google_rating", label: "Google star rating", points: 0, max: 15, note: "no rating" };
  }
  let pts = 0;
  if (rating >= 4.5) pts = 15;
  else if (rating >= 4.0) pts = 10;
  else if (rating >= 3.5) pts = 5;
  return {
    key: "google_rating",
    label: "Google star rating",
    points: pts,
    max: 15,
    note: `${rating.toFixed(1)}★`,
  };
};

const hasEmailSignal = (ctx: Ctx): ScoreSignal => {
  const has = !!ctx.lead.email && ctx.lead.email.includes("@");
  return {
    key: "has_email",
    label: "Direct email on file",
    points: has ? 10 : 0,
    max: 10,
    note: has ? ctx.lead.email! : "missing",
  };
};

const hasWebsiteSignal = (ctx: Ctx): ScoreSignal => {
  const has = !!ctx.lead.currentWebsite && /^https?:\/\//i.test(ctx.lead.currentWebsite);
  return {
    key: "has_website",
    label: "Current website on file",
    points: has ? 5 : 0,
    max: 5,
    note: has ? "yes" : "no site listed",
  };
};

// LOT 2.4 — exact-match generator strings that immediately identify a
// DIY builder. These are prime Ashford prospects (built their own site,
// usually unhappy with the result, already used to paying a monthly).
// Anything not in this list still falls through to the legacy regex
// heuristic below so we don't lose existing coverage.
const KNOWN_BUILDER_GENERATORS = [
  "Hostinger Horizons",
  "Wix.com Website Builder",
  "Squarespace",
  "Showit",
  "Sitebuilder",
  "Webflow",
  "WordPress with Elementor",
] as const;

const matchKnownBuilderGenerator = (raw: string | null): string | null => {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  if (!norm) return null;
  for (const known of KNOWN_BUILDER_GENERATORS) {
    if (norm === known.toLowerCase()) return known;
  }
  return null;
};

const webStackSignal = (ctx: Ctx): ScoreSignal => {
  // Higher score for visible "I built this myself on a hosted platform"
  // tells — those owners already pay monthly and tend to upgrade faster.
  // No website at all also scores high (12) because they urgently need
  // what we sell. Custom modern stacks score lowest because they
  // typically have a webmaster who'll resist a switch.
  const noSite = !ctx.lead.currentWebsite;
  if (noSite) {
    return {
      key: "web_stack",
      label: "Web stack opportunity",
      points: 12,
      max: 15,
      note: "no site — urgent need",
    };
  }
  // LOT 2.4 — `<meta name="generator">` is the strongest builder
  // fingerprint: Hostinger/Wix/etc. write their own name into the page
  // head. When it matches a known DIY builder, award full points
  // regardless of what the other "stack" heuristics say.
  const websiteMeta = ctx.payloads.get("website_meta") ?? {};
  const generator = strFromUnknown(websiteMeta.generator);
  const knownBuilder = matchKnownBuilderGenerator(generator);
  if (knownBuilder) {
    return {
      key: "web_stack",
      label: "Web stack opportunity",
      points: 15,
      max: 15,
      note: `${knownBuilder} (generator meta)`,
    };
  }
  const p = ctx.payloads.get("website_scraping") ?? {};
  const stack = strFromUnknown(p.stack) ?? strFromUnknown(p.platform) ?? strFromUnknown(p.cms);
  const stackLc = stack?.toLowerCase() ?? "";
  if (/wix|squarespace|godaddy|wordpress\.com/.test(stackLc)) {
    return { key: "web_stack", label: "Web stack opportunity", points: 15, max: 15, note: stack ?? "hosted SaaS" };
  }
  if (/wordpress|weebly|jimdo/.test(stackLc)) {
    return { key: "web_stack", label: "Web stack opportunity", points: 10, max: 15, note: stack ?? "WordPress" };
  }
  if (stackLc.length > 0) {
    return { key: "web_stack", label: "Web stack opportunity", points: 4, max: 15, note: stack ?? "custom" };
  }
  return { key: "web_stack", label: "Web stack opportunity", points: 6, max: 15, note: "stack unknown" };
};

const SOURCE_POINTS: Record<string, { pts: number; note: string }> = {
  contact_form: { pts: 15, note: "inbound · contact form" },
  inbound_phone: { pts: 15, note: "inbound · phone" },
  rep_referral: { pts: 12, note: "rep referral" },
  apify: { pts: 10, note: "Apify scrape" },
  apify_psychologytoday: { pts: 10, note: "Apify · Psychology Today" },
  rep_manual: { pts: 8, note: "rep typed in" },
  self_serve_template: { pts: 14, note: "self-serve checkout" },
  recycled: { pts: 2, note: "recycled — handle with care" },
};

const sourceSignal = (ctx: Ctx): ScoreSignal => {
  const src = (ctx.lead.source ?? "").trim();
  const hit = SOURCE_POINTS[src];
  if (hit) {
    return { key: "source_quality", label: "Lead source quality", points: hit.pts, max: 15, note: hit.note };
  }
  return {
    key: "source_quality",
    label: "Lead source quality",
    points: 6,
    max: 15,
    note: src ? `source: ${src}` : "no source tag",
  };
};

const healthgradesSignal = (ctx: Ctx): ScoreSignal => {
  const p = ctx.payloads.get("healthgrades");
  const present = !!p && Object.keys(p).length > 0;
  return {
    key: "healthgrades_present",
    label: "Healthgrades profile",
    points: present ? 10 : 0,
    max: 10,
    note: present ? "verified provider" : "no Healthgrades match",
  };
};

const blurbSignal = (ctx: Ctx): ScoreSignal => {
  const len = (ctx.lead.profileBlurb ?? "").trim().length;
  if (len >= 120) {
    return { key: "blurb_quality", label: "Profile bio depth", points: 10, max: 10, note: `${len} chars` };
  }
  if (len >= 40) {
    return { key: "blurb_quality", label: "Profile bio depth", points: 5, max: 10, note: `${len} chars (thin)` };
  }
  return { key: "blurb_quality", label: "Profile bio depth", points: 0, max: 10, note: "no bio" };
};

const SCORERS: Array<(ctx: Ctx) => ScoreSignal> = [
  googleReviewsSignal,
  googleRatingSignal,
  hasEmailSignal,
  hasWebsiteSignal,
  webStackSignal,
  sourceSignal,
  healthgradesSignal,
  blurbSignal,
];

/**
 * Pure scoring function — exposed for tests + the backfill script. Does
 * NOT touch the database. Pass in the lead row and a map of latest
 * enrichment payloads keyed by source.
 */
export const scoreLeadFromInputs = (
  lead: typeof leads.$inferSelect,
  payloads: Map<string, Record<string, unknown>>,
): ScoreBreakdown => {
  const ctx: Ctx = { lead, payloads };
  const signals = SCORERS.map((s) => s(ctx));
  const raw = signals.reduce((acc, s) => acc + Math.max(0, Math.min(s.points, s.max)), 0);
  const total = Math.max(0, Math.min(raw, MAX_SCORE));
  // Cutoffs mirror tierForScore — keep both in sync.
  const tier: ScoreTier = total >= 37 ? "A" : total >= 28 ? "B" : "C";
  return { total, tier, signals };
};

/**
 * Compute the score for a single lead and persist it. Always resolves
 * (never throws) — caller decides whether to await or fire-and-forget.
 * Returns the breakdown for use by the orchestrator's logger.
 */
export const computeLeadScore = async (
  leadId: number,
): Promise<ScoreBreakdown | null> => {
  try {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) {
      logger.warn({ leadId }, "computeLeadScore: lead not found");
      return null;
    }
    const enrichRows = await db
      .select()
      .from(leadEnrichment)
      .where(eq(leadEnrichment.leadId, leadId))
      .orderBy(desc(leadEnrichment.fetchedAt));
    const payloads = new Map<string, Record<string, unknown>>();
    for (const row of enrichRows) {
      // First-write-wins because rows are sorted newest-first above; the
      // latest payload per source is the one we score against.
      if (!payloads.has(row.sourceKey)) {
        payloads.set(row.sourceKey, row.payload as Record<string, unknown>);
      }
    }
    const breakdown = scoreLeadFromInputs(lead, payloads);
    await db
      .update(leads)
      .set({
        leadScore: breakdown.total,
        scoreBreakdown: breakdown,
        scoredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));
    return breakdown;
  } catch (err) {
    logger.error({ err, leadId }, "computeLeadScore: failed");
    return null;
  }
};
