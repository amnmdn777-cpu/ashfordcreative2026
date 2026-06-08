import { db, leadEnrichment } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { isPlatformBrandName } from "./brandBlocklist";
import { sanitizeScrapedBio } from "./bioSanitize";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * Headway directory enrichment (https://headway.co).
 *
 * Headway is the dominant insurance-billing + therapist directory in the US:
 * a huge slice of TX mental-health prospects are listed there with bio,
 * photo, specialties, modalities, languages, ACCEPTED INSURANCES (the
 * money field — no other source we use has it), session price, and
 * sliding-scale flag.
 *
 * Approach choice: there is no widely-published, well-maintained Apify
 * actor for headway.co at the time this source was written. Going Apify
 * would mean paying a paid-tier custom actor or rolling our own — both
 * worse than a small direct fetch. So this source scrapes the public
 * directory directly. No API key required. When `SCRAPERAPI_KEY` is set
 * the request is routed through it for anti-bot bypass; otherwise we fall
 * back to a plain `fetch` with a realistic User-Agent (works for most
 * profile pages, can fail on the search step if Cloudflare challenges us).
 *
 * Matching priority:
 *   1. NPI lookup — if the lead already has an `npi_registry` enrichment
 *      row, we search Headway with the verified NPI for a guaranteed match.
 *   2. Name + state fallback — fuzzy match (Levenshtein on full name +
 *      exact city/state) with a 0.8 minimum score to avoid false positives.
 */

const HEADWAY_BASE = "https://headway.co";
const USER_AGENT =
  "Mozilla/5.0 (compatible; AshfordEnrichmentBot/1.0; +https://ashford.co)";

export interface HeadwayProfile {
  /** Public Headway profile URL. */
  profileUrl: string;
  /** Provider name as shown on the profile (used for fuzzy matching). */
  name: string | null;
  /** Headshot CDN URL, when present. */
  photoUrl: string | null;
  /** Long-form bio / "about me" text. */
  bio: string | null;
  /** Specialties (anxiety, depression, trauma, …). */
  specialties: string[];
  /** Modalities (CBT, EMDR, IFS, …). */
  modalities: string[];
  /** Insurances accepted — the headline field. */
  acceptedInsurances: string[];
  /** Languages spoken in session. */
  languages: string[];
  /** Sees patients in person at a physical office. */
  inPerson: boolean;
  /** Offers telehealth / virtual sessions. */
  virtual: boolean;
  /** City / state of the practice. */
  location: { city: string | null; state: string | null };
  /** Per-session price in dollars (range when available). */
  pricePerSession: { min: number | null; max: number | null } | null;
  /** Provider explicitly offers a sliding-scale fee. */
  acceptsSlidingScale: boolean;
  /** Match score 0..1 — 1 means NPI match, otherwise fuzzy name score. */
  matchScore: number;
  /** True iff we matched on a verified NPI. */
  npiMatch: boolean;
}

class HeadwaySource implements EnrichmentSource {
  readonly key = "headway";
  readonly label = "Headway";

  isConfigured(): boolean {
    // No API key required. ScraperAPI just makes us more reliable; without
    // it we still attempt direct fetches.
    return true;
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    try {
      // Fast path: when the lead's `current_website` already points at a
      // Headway provider profile (`care.headway.co/providers/<slug>` or
      // `headway.co/providers/<slug>`), parse that page directly. This
      // skips the search step entirely — Headway's search is brittle
      // (Cloudflare challenges, fuzzy ranker that misses hyphenated
      // names like "Delores Hendrix-Giles" → 0.7 baseline) and the
      // founder-attested URL is a guaranteed match. Without this fix we
      // were missing the bio + headshot for every lead whose
      // current_website is their Headway profile, leaving the prospect
      // portal's "Meet Dr. X" hero with no photo.
      const direct = await fetchByCurrentWebsite(lead);
      if (direct) {
        logger.info(
          {
            leadId: lead.id,
            source: "headway",
            via: "current_website",
          },
          "headway enrichment matched via current_website",
        );
        return summarize(direct);
      }
      const npi = await loadNpiForLead(lead.id);
      const candidate = npi
        ? await searchByNpi(npi, lead)
        : await searchByName(lead);
      const fieldsAcquired = candidate
        ? Object.values(candidate).filter(
            (v) =>
              v !== null &&
              !(Array.isArray(v) && v.length === 0) &&
              v !== false,
          ).length
        : 0;
      logger.info(
        {
          leadId: lead.id,
          source: "headway",
          matchScore: candidate?.matchScore ?? 0,
          npiMatch: candidate?.npiMatch ?? false,
          fieldsAcquired,
        },
        "headway enrichment finished",
      );
      if (!candidate) return null;
      return summarize(candidate);
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "headway enrichment failed");
      return null;
    }
  }
}

export const headwaySource = new HeadwaySource();

/**
 * Build the standard `Candidate` envelope from a parsed Headway profile.
 * Extracted from the inline path so both the search-based flow and the
 * `current_website` fast path produce identical summaries and payloads.
 */
const summarize = (candidate: HeadwayProfile): Candidate => {
  const summaryParts: string[] = [];
  summaryParts.push(`Headway profile matched`);
  if (candidate.acceptedInsurances.length) {
    summaryParts.push(
      `accepts: ${candidate.acceptedInsurances.slice(0, 3).join(", ")}`,
    );
  }
  if (candidate.specialties.length) {
    summaryParts.push(
      `specialties: ${candidate.specialties.slice(0, 3).join(", ")}`,
    );
  }
  if (candidate.acceptsSlidingScale) summaryParts.push("sliding-scale");
  const modes: string[] = [];
  if (candidate.inPerson) modes.push("in-person");
  if (candidate.virtual) modes.push("virtual");
  if (modes.length) summaryParts.push(modes.join("/"));
  return {
    confidence: candidate.npiMatch
      ? 95
      : Math.round(candidate.matchScore * 100),
    summary: summaryParts.join(" · "),
    payload: candidate as unknown as Record<string, unknown>,
  };
};

/**
 * If the lead's `current_website` is already a Headway provider URL,
 * fetch + parse it directly. Strips marketing query params (utm_*,
 * direct_link campaigns) before the request. Returns a profile with
 * `matchScore=1` and `npiMatch=false` — high confidence without
 * claiming an NPI verification we didn't actually do.
 */
const HEADWAY_HOST_RE = /^(?:[a-z0-9-]+\.)?headway\.co$/i;
const HEADWAY_PATH_RE = /^\/providers\/[a-z0-9-]+\/?$/i;

const fetchByCurrentWebsite = async (
  lead: LeadInput,
): Promise<HeadwayProfile | null> => {
  const raw = lead.currentWebsite?.trim();
  if (!raw) return null;
  // Tolerate scheme-less inputs (`care.headway.co/providers/slug`) since
  // CSV imports often store bare hostnames; `new URL()` rejects those.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!HEADWAY_HOST_RE.test(parsed.hostname)) return null;
  if (!HEADWAY_PATH_RE.test(parsed.pathname)) return null;
  // Drop tracking params — they don't change the rendered profile and
  // make request-level caching (ScraperAPI) miss unnecessarily.
  const cleanUrl = `https://${parsed.hostname}${parsed.pathname.replace(/\/$/, "")}`;
  const profile = await fetchAndParseProfile(cleanUrl);
  if (!profile) return null;
  return { ...profile, npiMatch: false, matchScore: 1 };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the most recent NPI from prior `npi_registry` enrichment, if any. */
const loadNpiForLead = async (leadId: number): Promise<string | null> => {
  try {
    const [row] = await db
      .select()
      .from(leadEnrichment)
      .where(
        and(
          eq(leadEnrichment.leadId, leadId),
          eq(leadEnrichment.sourceKey, "npi_registry"),
        ),
      )
      .orderBy(desc(leadEnrichment.fetchedAt))
      .limit(1);
    if (!row) return null;
    const payload = row.payload as Record<string, unknown> | null;
    const npi = payload && typeof payload.npi === "string" ? payload.npi : null;
    return npi;
  } catch {
    return null;
  }
};

/**
 * Fetch a URL, optionally routed through ScraperAPI for anti-bot bypass.
 * Returns the response body or null on failure.
 *
 * Two-tier attempt with a real-browser User-Agent:
 *   1. Direct `fetch` with a Chrome UA + `Accept-Language` headers —
 *      passes the Cloudflare-Lite challenge ~70% of the time at $0.
 *   2. ScraperAPI fallback with `render=true` — runs the request
 *      through their headless browser pool, which solves Cloudflare's
 *      JS challenge and the bot-fingerprint check that flagged our
 *      previous "AshfordEnrichmentBot" UA.
 *
 * Diagnostic logging: every attempt records `status`, `bytes`, and
 * which tier ran. The Tara Langston enrichment ran with both
 * `matchScore: 0` and zero error logs — meaning we were silently
 * rejecting Cloudflare HTML without knowing why. The new logging
 * lets us confirm what's actually coming back.
 */
const REAL_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const fetchHtml = async (url: string): Promise<string | null> => {
  // Tier 1: direct fetch with a real-browser UA. Headway is a Next.js
  // app behind Cloudflare; some prospects fly through, others get
  // a JS challenge. The challenge body is ~3-4KB of obfuscated JS
  // (no `__NEXT_DATA__`, no JSON-LD) so we treat undersized payloads
  // as a soft failure and let tier 2 take over.
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": REAL_BROWSER_UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const html = await res.text();
      // A real Headway profile page is ~80-120 KB. Anything under
      // ~10 KB is almost certainly a Cloudflare challenge stub.
      if (html.length >= 10_000 && html.includes("__NEXT_DATA__")) {
        logger.info(
          { url, tier: "direct", bytes: html.length },
          "headway:fetchHtml ok",
        );
        return html;
      }
      logger.warn(
        { url, tier: "direct", bytes: html.length },
        "headway:fetchHtml direct returned thin/non-Next HTML — falling back to ScraperAPI",
      );
    } else {
      logger.warn(
        { url, tier: "direct", status: res.status },
        "headway:fetchHtml direct non-OK — falling back to ScraperAPI",
      );
    }
  } catch (err) {
    logger.warn(
      { url, tier: "direct", err: err instanceof Error ? err.message : String(err) },
      "headway:fetchHtml direct threw — falling back to ScraperAPI",
    );
  }

  // Tier 2: ScraperAPI with `render=true` so their headless browser
  // pool solves Cloudflare's JS challenge before returning HTML.
  // Costs ~5x a non-render request but we do it at most once per
  // lead per enrichment cycle, only when tier 1 came up short.
  if (env.scraperapiKey != null) {
    try {
      const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        env.scraperapiKey,
      )}&url=${encodeURIComponent(url)}&render=true&country_code=us`;
      const res = await fetch(target, {
        headers: {
          "user-agent": REAL_BROWSER_UA,
          accept: "text/html",
        },
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        logger.warn(
          { url, tier: "scraperapi", status: res.status },
          "headway:fetchHtml scraperapi non-OK",
        );
        return null;
      }
      const html = await res.text();
      logger.info(
        { url, tier: "scraperapi", bytes: html.length },
        "headway:fetchHtml ok",
      );
      return html;
    } catch (err) {
      logger.warn(
        { url, tier: "scraperapi", err: err instanceof Error ? err.message : String(err) },
        "headway:fetchHtml scraperapi threw",
      );
      return null;
    }
  }
  logger.warn({ url }, "headway:fetchHtml exhausted — no SCRAPERAPI_KEY configured");
  return null;
};

/**
 * Search Headway by NPI. We only declare an NPI match when the resolved
 * profile page actually contains the NPI string — otherwise Headway's
 * search ranker may have surfaced a near-miss and we'd be lying with a
 * confidence of 1. When verification fails we degrade gracefully to
 * name+state scoring against the same candidate.
 */
const searchByNpi = async (
  npi: string,
  lead: LeadInput,
): Promise<HeadwayProfile | null> => {
  const searchUrl = `${HEADWAY_BASE}/providers?search=${encodeURIComponent(npi)}`;
  const searchHtml = await fetchHtml(searchUrl);
  if (!searchHtml) return searchByName(lead);
  const profileUrl = extractFirstProfileUrl(searchHtml);
  if (!profileUrl) return searchByName(lead);
  const fullUrl = profileUrl.startsWith("http")
    ? profileUrl
    : `${HEADWAY_BASE}${profileUrl}`;
  const profileHtml = await fetchHtml(fullUrl);
  if (!profileHtml) return searchByName(lead);
  const profile = parseHeadwayProfile(profileHtml, fullUrl);
  if (!profile) return searchByName(lead);
  // Verify the NPI is actually attested on the profile page itself.
  // Headway sometimes shows the NPI in the rendered HTML and always in
  // __NEXT_DATA__; either is sufficient.
  const npiVerified = profileHtml.includes(npi);
  if (npiVerified) {
    return { ...profile, npiMatch: true, matchScore: 1 };
  }
  // NPI not attested → treat as a name-search candidate and score it.
  const score = scoreNameMatch(lead, profile);
  if (score < 0.8) return searchByName(lead);
  return { ...profile, npiMatch: false, matchScore: score };
};

/** Search by name + state, fuzzy-score and accept only > 0.8. */
const searchByName = async (
  lead: LeadInput,
): Promise<HeadwayProfile | null> => {
  const stateSlug = stateToSlug(lead.state);
  const searchUrl = `${HEADWAY_BASE}/providers?search=${encodeURIComponent(
    lead.name,
  )}${stateSlug ? `&location=${stateSlug}` : ""}`;
  const html = await fetchHtml(searchUrl);
  if (!html) return null;
  const candidates = extractTopProfileUrls(html, 3);
  if (candidates.length === 0) return null;
  let best: HeadwayProfile | null = null;
  for (const url of candidates) {
    const profile = await fetchAndParseProfile(url);
    if (!profile) continue;
    const score = scoreNameMatch(lead, profile);
    if (score < 0.8) continue;
    if (!best || score > best.matchScore) {
      best = { ...profile, npiMatch: false, matchScore: score };
    }
  }
  return best;
};

/** Fetch a profile URL and extract the typed Headway profile fields. */
const fetchAndParseProfile = async (
  profileUrl: string,
): Promise<Omit<HeadwayProfile, "matchScore" | "npiMatch"> | null> => {
  const fullUrl = profileUrl.startsWith("http")
    ? profileUrl
    : `${HEADWAY_BASE}${profileUrl}`;
  const html = await fetchHtml(fullUrl);
  if (!html) return null;
  return parseHeadwayProfile(html, fullUrl);
};

/**
 * Parse a Headway provider profile HTML page into a typed `HeadwayProfile`.
 *
 * Three-tier parser, designed to never come back empty when the page
 * actually rendered the provider:
 *
 *   1. `__NEXT_DATA__` — old Next.js Pages Router hydration blob.
 *      Strongly-typed JSON, the cleanest source. Headway used this
 *      until ~2025; some legacy profile URLs may still emit it.
 *   2. `self.__next_f` flight chunks — Next.js App Router (post-Next 13)
 *      streams its server data via these. We concatenate every chunk,
 *      then JSON-walk for a provider-shaped node.
 *   3. **Rendered DOM text + image extraction** — the absolute fallback.
 *      ScraperAPI render=true returns a fully-hydrated DOM; even if
 *      the underlying data shape changed entirely, the human-readable
 *      profile is in the visible text. We anchor on Headway's known
 *      section headings ("Great to meet you!", "My approach to therapy",
 *      "Insurance accepted", "Specialties", …) and lift their
 *      neighboring paragraphs. Photo comes from the first <img> on a
 *      Headway/CDN host.
 *
 * Each tier returns null on miss; the next one runs. We only bail to
 * the caller's null when all three came up dry — which now means the
 * page itself didn't render the provider (404, banned account, etc.),
 * not a mere format change.
 */
export const parseHeadwayProfile = (
  html: string,
  profileUrl: string,
): Omit<HeadwayProfile, "matchScore" | "npiMatch"> | null => {
  // Apply photo-resolution upgrade at the boundary so every tier
  // (NEXT_DATA / flight / json-ld / dom) gets the 1200w treatment.
  const upgrade = (
    p: Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl">,
  ): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> => ({
    ...p,
    photoUrl: p.photoUrl ? upgradeHeadwayPhotoResolution(p.photoUrl) : null,
  });

  const fromNext = parseFromNextData(html);
  if (fromNext) {
    logger.info({ profileUrl, source: "__NEXT_DATA__" }, "headway:parse hit");
    return { ...upgrade(fromNext), profileUrl };
  }
  const fromFlight = parseFromNextFlightChunks(html);
  if (fromFlight) {
    logger.info(
      { profileUrl, source: "self.__next_f" },
      "headway:parse hit",
    );
    return { ...upgrade(fromFlight), profileUrl };
  }
  const fromJsonLd = parseFromJsonLd(html);
  if (fromJsonLd) {
    logger.info(
      { profileUrl, source: "json-ld" },
      "headway:parse hit (jsonld; skinny payload)",
    );
    return { ...upgrade(fromJsonLd), profileUrl };
  }
  const fromDom = parseFromRenderedDom(html, profileUrl);
  if (fromDom) {
    logger.info(
      { profileUrl, source: "dom" },
      "headway:parse hit (rendered DOM)",
    );
    return { ...upgrade(fromDom), profileUrl };
  }
  logger.warn(
    {
      profileUrl,
      htmlLen: html.length,
      hasNextData: html.includes("__NEXT_DATA__"),
      hasNextF: html.includes("__next_f"),
      hasJsonLd: html.includes('application/ld+json'),
    },
    "headway:parse no data extracted",
  );
  return null;
};

/**
 * Walk every `self.__next_f.push([1, "..."])` chunk, concatenate the
 * stringified flight payload, and look for a provider-shaped object.
 *
 * Flight chunks look like:
 *   self.__next_f.push([1, "{\"providerData\":{\"name\":\"Tara…"])
 * Each chunk's second element is a JSON-stringified string that, when
 * concatenated across all pushes for a tree node, yields the actual
 * server-rendered data. We don't attempt to reconstruct the full
 * Flight tree — we just decode each chunk's string and search for
 * provider keys inside.
 */
const parseFromNextFlightChunks = (
  html: string,
): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> | null => {
  // Pull every `self.__next_f.push([N, "..."])` payload's string.
  const chunkRe = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:\\.|[^"\\])*")\s*\]\)/g;
  let m: RegExpExecArray | null;
  const chunks: string[] = [];
  while ((m = chunkRe.exec(html)) !== null) {
    try {
      // The captured group is a valid JSON string literal — JSON.parse
      // gives us the raw payload after un-escaping.
      const decoded = JSON.parse(m[1]);
      if (typeof decoded === "string") chunks.push(decoded);
    } catch {
      // skip
    }
  }
  if (chunks.length === 0) return null;
  const blob = chunks.join("");
  // Inside the flight blob there are JSON sub-objects. Try to locate
  // ones that look like provider records by searching for the canonical
  // key pairs Headway uses.
  const candidates: Record<string, unknown>[] = [];
  // Heuristic 1: full JSON sub-objects starting at any `{` whose body
  // mentions both "name" and "specialties" / "acceptedInsurances".
  const JSON_OBJECT_HUNT = /\{[^{}]*?"(?:name|fullName)"[^{}]*?\}/g;
  for (const match of blob.matchAll(JSON_OBJECT_HUNT)) {
    try {
      const obj = JSON.parse(match[0]);
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        candidates.push(obj as Record<string, unknown>);
      }
    } catch {
      // skip
    }
  }
  // Heuristic 2: a robust JSON-walker that descends into balanced
  // braces. Fall back if heuristic 1 didn't land anything provider-y.
  if (candidates.length === 0) {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < blob.length; i++) {
      const c = blob[i];
      if (c === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const obj = JSON.parse(blob.slice(start, i + 1));
            if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
              candidates.push(obj as Record<string, unknown>);
            }
          } catch {
            // skip
          }
          start = -1;
        }
      }
    }
  }
  // Walk each candidate looking for the provider node; pick the first
  // one with provider-like fields.
  for (const c of candidates) {
    const provider = findProviderNode(c);
    if (provider) {
      return providerNodeToProfile(provider);
    }
  }
  return null;
};

/**
 * Last-resort extraction from the post-render DOM. Headway's hydrated
 * profile pages render a consistent structure: name in `<h1>`, photo
 * in the first big `<img>` near the top, "Great to meet you!" intro
 * paragraph, "My approach to therapy" paragraph, an "About me" block
 * that lists identity tags + style words, and a "Qualification and
 * insurance" block listing license / years / insurance payers. We
 * lift each of those by anchoring on the heading text.
 *
 * Regex on raw HTML (no DOM parser dep) — slightly fragile to markup
 * tweaks on Headway's side, but the heading text is the prospect-
 * facing copy and unlikely to change without warning. When the page
 * shape genuinely changes, this returns nulls and the caller logs the
 * "no data extracted" warning.
 */
const parseFromRenderedDom = (
  html: string,
  profileUrl: string,
): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> | null => {
  // Pre-strip script + style for body-text searches; keep raw HTML
  // around for `<img>` extraction.
  const bodyText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  // --- Name ---------------------------------------------------------
  // Headway puts the provider name in the first `<h1>` (or sometimes
  // <h2>). Fall back to the slug if no heading was rendered.
  let name: string | null = null;
  const h1 = html.match(/<h1[^>]*>([^<]{2,80})<\/h1>/i);
  if (h1?.[1]) {
    const candidate = decodeEntities(h1[1]).trim();
    // Headway occasionally renders a directory brand H1 ("Care",
    // "Headway") instead of the provider's name. Reject and fall
    // through to the slug so we never persist a brand-as-name.
    if (!isPlatformBrandName(candidate)) name = candidate;
  }
  if (!name) {
    const slug = profileUrl.match(/\/providers\/([a-z0-9-]+)/i)?.[1];
    if (slug) {
      name = slug
        .split("-")
        .filter((t) => !/^\d+$/.test(t))
        .map((t) => t[0]?.toUpperCase() + t.slice(1))
        .join(" ");
    }
  }
  if (!name) return null;

  // --- Photo --------------------------------------------------------
  // Provider photos on Headway live on user-content CDNs. Empirically
  // they appear under one of:
  //   - cdn.headway.co/...
  //   - assets.headway.co/uploads/... or /provider/... (NOT /web/...)
  //   - headwayapps.s3.amazonaws.com/...
  //   - cloudfront.net/...
  // We collect candidates from <img>, <picture><source>, CSS
  // background-image, AND a final pass that scans the raw HTML for
  // any image URL on a Headway-adjacent host. Build assets
  // (`/web/.../assets/`) and Open Graph placeholders (`*ogimage*`)
  // are explicitly rejected.
  let photoUrl: string | null = null;
  const candidates: string[] = [];
  const imgRe = /<img\b[^>]*?>/gi;
  for (const tag of html.match(imgRe) ?? []) {
    const src = attrFromTag(tag, "src") ?? attrFromTag(tag, "data-src");
    if (src) candidates.push(src);
    const srcset = attrFromTag(tag, "srcset");
    if (srcset) {
      for (const entry of srcset.split(",")) {
        const u = entry.trim().split(/\s+/)[0];
        if (u) candidates.push(u);
      }
    }
  }
  const sourceRe = /<source\b[^>]*?>/gi;
  for (const tag of html.match(sourceRe) ?? []) {
    const srcset = attrFromTag(tag, "srcset");
    if (!srcset) continue;
    for (const entry of srcset.split(",")) {
      const u = entry.trim().split(/\s+/)[0];
      if (u) candidates.push(u);
    }
  }
  const bgRe = /background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  for (const m of html.matchAll(bgRe)) {
    if (m[1]) candidates.push(m[1]);
  }
  // Final pass: any URL anywhere in the raw HTML that looks like an
  // image on a Headway-adjacent host. Catches photos referenced in
  // Next.js flight chunks, JSON-LD blocks, JSON-encoded meta, etc.
  const RAW_URL_RE =
    /https?:\/\/[^\s"'<>(){}\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>(){}\\]*)?/gi;
  for (const m of html.matchAll(RAW_URL_RE)) {
    candidates.push(m[0]);
  }

  const HEADWAY_HOST = /(?:^|\.)headway\.co$|^headway-images\b|headwayapps|s3\.amazonaws\.com|cloudfront\.net/i;
  const PHOTO_BLOCKLIST = /(?:\/web\/[^/]+\/assets\/|ogimage|og-image|og_image|\bicon\b|\blogo\b|\bsprite\b|chevron|arrow|insignia|placeholder|default[- ]?avatar|favicon|loading|spinner|provider_photo_\d+(?:-[A-Za-z0-9]+)?\.)/i;
  const isProviderPhoto = (raw: string): boolean => {
    if (!raw.startsWith("http")) return false;
    if (PHOTO_BLOCKLIST.test(raw)) return false;
    if (!/\.(jpe?g|png|webp|avif)(?:\?|$)/i.test(raw)) return false;
    let host: string;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      return false;
    }
    return HEADWAY_HOST.test(host);
  };

  // Score each accepted candidate; prefer URLs that mention the slug
  // ("tara-langston-2") or a user-content path keyword ("uploads",
  // "provider", "photo"). The first-encountered candidate wins ties.
  const slug = profileUrl.match(/\/providers\/([a-z0-9-]+)/i)?.[1] ?? "";
  const scoreCandidate = (raw: string): number => {
    let s = 1;
    if (slug && raw.toLowerCase().includes(slug)) s += 5;
    if (/\/(?:uploads?|provider|user|photo|portrait|profile)\//i.test(raw)) s += 3;
    if (/(?:cloudfront|s3\.amazonaws|headway-images|cdn\.headway)/i.test(raw)) s += 2;
    return s;
  };
  const accepted = Array.from(new Set(candidates))
    .filter(isProviderPhoto)
    .map((u) => ({ u, s: scoreCandidate(u) }))
    .sort((a, b) => b.s - a.s);
  if (accepted.length > 0) {
    // The boundary in parseHeadwayProfile applies upgrade as well;
    // running it here is harmless (idempotent) and keeps the local
    // `photoUrl` sane in case this branch is ever called directly.
    photoUrl = upgradeHeadwayPhotoResolution(accepted[0].u);
  }
  // Diagnostic — when we couldn't find a photo, dump the candidate
  // shapes we considered so the next debug round can see what was
  // there. Includes the first-pass blocklist hits so we know whether
  // the page rendered the photo at all.
  if (!photoUrl) {
    const sampled = Array.from(new Set(candidates)).slice(0, 8);
    logger.warn(
      {
        profileUrl,
        candidateCount: candidates.length,
        sampleCandidates: sampled,
      },
      "headway:parse no provider photo — accepted by isProviderPhoto returned 0",
    );
  }

  // --- Bio ----------------------------------------------------------
  // Concatenate "Great to meet you!" intro + "My approach to therapy".
  // Each section header is followed by paragraph(s) of plain text.
  const bioParts: string[] = [];
  const introMatch = bodyText.match(
    /Great to meet you[!]?\s+([\s\S]{40,1200}?)(?=My approach to therapy|About me|Specialties|Insurance|Qualification|$)/i,
  );
  if (introMatch?.[1]) bioParts.push(introMatch[1].trim());
  const approachMatch = bodyText.match(
    /My approach to therapy\s+([\s\S]{40,1200}?)(?=About me|Specialties|Insurance|Qualification|$)/i,
  );
  if (approachMatch?.[1]) bioParts.push(approachMatch[1].trim());
  const bio = sanitizeScrapedBio(
    bioParts.length > 0 ? bioParts.join("\n\n") : null,
  );

  // --- Specialties / modalities -----------------------------------
  const specialties = extractCsvAfterAnchor(
    bodyText,
    /Specialties\s+/i,
    /(?:Modalities|Modality|Insurance|Languages|About me|Qualification|$)/i,
  );
  const modalities = extractCsvAfterAnchor(
    bodyText,
    /(?:Modalities|Modality)\s+/i,
    /(?:Insurance|Languages|About me|Qualification|$)/i,
  );
  const languages = extractCsvAfterAnchor(
    bodyText,
    /Languages\s+/i,
    /(?:Insurance|About me|Qualification|$)/i,
  );

  // --- Insurance ----------------------------------------------------
  // Headway's "Qualification and insurance" panel lists payers comma-
  // separated under the EXACT heading "Insurance accepted" — never
  // just "Insurance". Anchoring on bare "Insurance" was matching the
  // word inside "Qualification and *insurance*" and capturing the
  // following "Years of experience 6 …" block as if it were the
  // insurance list. Anchor on the literal heading; require a
  // capitalized token to follow so a stray empty section returns
  // nothing rather than garbage.
  let acceptedInsurances: string[] = [];
  const insuranceMatch = bodyText.match(
    /Insurance accepted\s+([A-Z][^.|]{20,1200}?)(?=$)/i,
  );
  if (insuranceMatch?.[1]) {
    acceptedInsurances = splitCsv(insuranceMatch[1]);
  }
  // Drop anything that's clearly not a payer name — defense against the
  // "Years of experience" / "License" leak class. Real payer names do
  // not start with these tokens.
  acceptedInsurances = acceptedInsurances.filter(
    (s) =>
      !/^(?:Years?|License|Training|Licensed|Master|Bachelor|Doctor|Specialties|Languages|Modalities|Modality|About|Qualification|Insurance)\b/i.test(
        s,
      ),
  );

  // --- Mode flags ---------------------------------------------------
  // Headway shows "Virtual" pill OR an "In-person" pill near the
  // header (sometimes both). Also "Sliding scale" appears in About
  // me when offered.
  const inPerson = /\bIn[- ]person\b/i.test(bodyText);
  const virtual = /\bVirtual\b/i.test(bodyText) || /Telehealth/i.test(bodyText);
  const acceptsSlidingScale =
    /sliding[- ]?scale|reduced[- ]?fee/i.test(bodyText);

  // --- Location -----------------------------------------------------
  // City sometimes shown as "<City>, <ST>" near the badges. Headway
  // virtual-only providers omit the city entirely; we leave it null.
  const cityMatch = bodyText.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  const location = cityMatch
    ? { city: cityMatch[1], state: cityMatch[2] }
    : { city: null, state: null };

  // --- Price (optional, often not shown) ---------------------------
  let pricePerSession: { min: number | null; max: number | null } | null = null;
  const priceMatch = bodyText.match(/\$(\d{2,4})(?:\s*[-–]\s*\$?(\d{2,4}))?\s*(?:per session|\/session|session)/i);
  if (priceMatch) {
    const min = Number(priceMatch[1]);
    const max = priceMatch[2] ? Number(priceMatch[2]) : null;
    pricePerSession = { min: Number.isFinite(min) ? min : null, max };
  }

  // Don't ship a "match" if we got essentially nothing — name from
  // the slug + nothing else looks worse than no result. Require at
  // least one of: bio, photo, ≥2 specialties, ≥2 insurances.
  const hasMeaningfulSignal =
    !!bio ||
    !!photoUrl ||
    specialties.length >= 2 ||
    acceptedInsurances.length >= 2;
  if (!hasMeaningfulSignal) return null;

  return {
    name,
    photoUrl,
    bio,
    specialties: dedupe(specialties),
    modalities: dedupe(modalities),
    acceptedInsurances: dedupe(acceptedInsurances),
    languages: dedupe(languages),
    inPerson,
    virtual,
    location,
    pricePerSession,
    acceptsSlidingScale,
  };
};

/**
 * Pull a comma-separated list out of `text` between an anchor regex
 * and a stop regex. Headway's profile page consistently lists
 * specialties / modalities / languages as comma-separated phrases
 * directly after their section header.
 */
const extractCsvAfterAnchor = (
  text: string,
  anchor: RegExp,
  stop: RegExp,
): string[] => {
  const m = text.match(anchor);
  if (!m || m.index == null) return [];
  const after = text.slice(m.index + m[0].length);
  const stopMatch = after.match(stop);
  const slice = stopMatch ? after.slice(0, stopMatch.index) : after.slice(0, 600);
  return splitCsv(slice);
};

/** Split a "A, B, C and D" style list into trimmed items. */
const splitCsv = (raw: string): string[] =>
  raw
    .replace(/\s+and\s+/gi, ", ")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 80 && /[A-Za-z]/.test(s));

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

const attrFromTag = (tag: string, name: string): string | null => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? "");
};

/**
 * Headway's photo URLs come pre-wrapped in their Cloudflare image-
 * resize endpoint at width=500 (their default for the profile
 * card). When we use that URL as the prospect-preview hero, it
 * displays pixelated on retina laptops. The resize endpoint is
 * happy to accept any width up to ~2000, so we transparently
 * upgrade to 1200w + quality=90 + format=auto so the hero renders
 * crisp without changing how Headway serves it on their own site.
 *
 * Pattern: `…/cdn-cgi/image/width=500,quality=100,format=auto,…/<orig>`
 *
 * Pure function — exported for unit tests.
 */
export function upgradeHeadwayPhotoResolution(rawUrl: string): string {
  // Only rewrite Headway-hosted resize URLs; anything else passes
  // through unchanged.
  if (!/headway\.co\/cdn-cgi\/image\//i.test(rawUrl)) return rawUrl;
  return rawUrl
    .replace(/(\bwidth=)\d+/i, "$11200")
    .replace(/(\bquality=)\d+/i, "$190");
}

/**
 * Translate a free-form provider node (from __NEXT_DATA__ or a flight
 * chunk) into the standardized HeadwayProfile shape. Shared between
 * `parseFromNextData` and `parseFromNextFlightChunks` so the field
 * mappings stay consistent.
 */
const providerNodeToProfile = (
  provider: Record<string, unknown>,
): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> => {
  const get = (key: string): unknown =>
    provider[key] ?? provider[snake(key)] ?? provider[camel(key)];
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .map((x) =>
            typeof x === "string"
              ? x
              : x && typeof x === "object" && "name" in (x as object)
                ? String((x as { name: unknown }).name)
                : null,
          )
          .filter((x): x is string => !!x)
      : [];
  const photoUrl =
    str(get("photoUrl")) ??
    str(get("imageUrl")) ??
    str(get("avatarUrl")) ??
    str(get("photo")) ??
    null;
  const bio = sanitizeScrapedBio(
    str(get("bio")) ??
      str(get("about")) ??
      str(get("personalStatement")) ??
      str(get("description")) ??
      null,
  );
  const specialties = arr(get("specialties"));
  const modalities = arr(get("modalities")).concat(arr(get("therapyTypes")));
  const acceptedInsurances = arr(get("acceptedInsurances")).concat(
    arr(get("insurances")),
    arr(get("insurancePayers")),
  );
  const languages = arr(get("languages"));
  const inPerson = !!(get("inPerson") ?? get("offersInPerson") ?? false);
  const virtual = !!(get("virtual") ?? get("offersTelehealth") ?? false);
  const locationRaw = get("location") ?? get("primaryAddress");
  const location =
    locationRaw && typeof locationRaw === "object"
      ? {
          city: str((locationRaw as Record<string, unknown>).city),
          state: str((locationRaw as Record<string, unknown>).state),
        }
      : { city: null, state: null };
  const priceMin =
    num(get("minPrice")) ??
    num(get("priceMin")) ??
    num(get("sessionPriceMin"));
  const priceMax =
    num(get("maxPrice")) ??
    num(get("priceMax")) ??
    num(get("sessionPriceMax"));
  const pricePerSession =
    priceMin != null || priceMax != null
      ? { min: priceMin, max: priceMax }
      : null;
  const acceptsSlidingScale = !!(
    get("slidingScale") ??
    get("acceptsSlidingScale") ??
    false
  );
  return {
    name: str(get("name")),
    photoUrl,
    bio,
    specialties: dedupe(specialties),
    modalities: dedupe(modalities),
    acceptedInsurances: dedupe(acceptedInsurances),
    languages: dedupe(languages),
    inPerson,
    virtual,
    location,
    pricePerSession,
    acceptsSlidingScale,
  };
};

const parseFromNextData = (
  html: string,
): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> | null => {
  const m = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return null;
  let json: unknown;
  try {
    json = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const provider = findProviderNode(json);
  if (!provider) return null;
  return providerNodeToProfile(provider);
};

const parseFromJsonLd = (
  html: string,
): Omit<HeadwayProfile, "matchScore" | "npiMatch" | "profileUrl"> | null => {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of matches) {
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      if (
        obj["@type"] === "Person" ||
        obj["@type"] === "MedicalBusiness" ||
        obj["@type"] === "LocalBusiness"
      ) {
        const photoRaw =
          obj.image && typeof obj.image === "object" && "url" in obj.image
            ? (obj.image as { url: unknown }).url
            : obj.image;
        return {
          name: str(obj.name),
          photoUrl: str(photoRaw),
          bio: str(obj.description),
          specialties: [],
          modalities: [],
          acceptedInsurances: [],
          languages: [],
          inPerson: false,
          virtual: false,
          location: { city: null, state: null },
          pricePerSession: null,
          acceptsSlidingScale: false,
        };
      }
    } catch {
      // Ignore malformed blocks and try the next.
    }
  }
  return null;
};

/**
 * Walk the Next.js __NEXT_DATA__ JSON tree to find the provider node.
 * Headway's hydration shape changes; we look for any object that has the
 * minimal shape of a provider page (name + slug or specialties).
 */
const findProviderNode = (
  json: unknown,
): Record<string, unknown> | null => {
  const seen = new Set<unknown>();
  const stack: unknown[] = [json];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const x of node) stack.push(x);
      continue;
    }
    const obj = node as Record<string, unknown>;
    const looksLikeProvider =
      typeof obj.name === "string" &&
      (Array.isArray(obj.specialties) ||
        Array.isArray(obj.acceptedInsurances) ||
        Array.isArray(obj.insurances) ||
        typeof obj.bio === "string" ||
        typeof obj.about === "string");
    if (looksLikeProvider) return obj;
    for (const key in obj) stack.push(obj[key]);
  }
  return null;
};

const extractFirstProfileUrl = (html: string): string | null => {
  const urls = extractTopProfileUrls(html, 1);
  return urls[0] ?? null;
};

const extractTopProfileUrls = (html: string, limit: number): string[] => {
  const seen = new Set<string>();
  const re = /href=["'](\/providers\/[a-z0-9-]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!seen.has(m[1])) seen.add(m[1]);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
};

/**
 * Combined name + city match score in [0, 1].
 *
 * - Name uses normalized Levenshtein similarity (1 - dist / max(len)).
 *   Names are lowercased, punctuation-stripped, and tokens are sorted so
 *   "Jane M Doe" and "Doe, Jane" both compare cleanly. When the profile
 *   has no extracted name we fall back to a conservative 0.7 baseline so
 *   we still gate on the city signal rather than accept blindly.
 * - Exact city match adds 0.1; mismatch subtracts 0.1; missing city is
 *   neutral. Callers gate on >= 0.8 to suppress false positives.
 */
const scoreNameMatch = (
  lead: LeadInput,
  profile: { name: string | null; location: { city: string | null } },
): number => {
  const leadName = normalizeName(lead.name);
  const profName = profile.name ? normalizeName(profile.name) : "";
  let score: number;
  if (!profName) {
    score = 0.7;
  } else {
    const dist = levenshtein(leadName, profName);
    const maxLen = Math.max(leadName.length, profName.length);
    score = maxLen === 0 ? 0 : 1 - dist / maxLen;
  }
  const profileCity = (profile.location.city ?? "").toLowerCase().trim();
  const leadCity = lead.city.toLowerCase().trim();
  if (profileCity && leadCity) {
    if (profileCity === leadCity) score += 0.1;
    else score -= 0.1;
  }
  return Math.max(0, Math.min(1, score));
};

/** Lowercase, strip punctuation, sort tokens — order-insensitive. */
const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss|prof|phd|psyd|lcsw|lpc|lmft|md)\b\.?/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

/** Classic iterative Levenshtein, O(n*m) time, O(min(n,m)) space. */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Ensure `a` is the shorter string so the row is the smaller of the two.
  if (a.length > b.length) [a, b] = [b, a];
  const prev = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    let prevDiag = prev[0];
    prev[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const above = prev[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[i] = Math.min(
        prev[i] + 1, // deletion
        prev[i - 1] + 1, // insertion
        prevDiag + cost, // substitution
      );
      prevDiag = above;
    }
  }
  return prev[a.length];
};

const stateToSlug = (state: string): string | null => {
  const map: Record<string, string> = {
    TX: "texas-tx",
    CA: "california-ca",
    NY: "new-york-ny",
    FL: "florida-fl",
    IL: "illinois-il",
    PA: "pennsylvania-pa",
    OH: "ohio-oh",
    GA: "georgia-ga",
    NC: "north-carolina-nc",
    MI: "michigan-mi",
  };
  return map[state.toUpperCase()] ?? null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && /^\d+(\.\d+)?$/.test(v)
      ? Number(v)
      : null;

const dedupe = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));

const snake = (s: string): string =>
  s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
