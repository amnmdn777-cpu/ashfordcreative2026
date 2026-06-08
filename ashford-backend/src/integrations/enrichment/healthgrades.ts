import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { EnrichmentSource, FetchResult, LeadInput } from "./types";
import { rejectMatch } from "./types";

/**
 * Healthgrades practitioner profile enrichment.
 *
 * Healthgrades is a national directory of US clinicians with strong SEO and
 * a relatively stable profile schema. Profiles surface fields the rest of
 * our sources don't carry well: medical school / training, board
 * certifications, awards, accepted insurance plans, and an editorial bio.
 * For mental-health leads it's especially useful for psychiatrists (MD/DO)
 * who are less likely to be on Headway / Psychology Today.
 *
 * Discovery: there is no public Healthgrades search API. We use the same
 * Apify "google-search-scraper" trick we use for LinkedIn — a focused
 * `site:healthgrades.com/provider` query returns the canonical profile URL
 * within 1-3 results — then fetch the profile HTML (via ScraperAPI when a
 * key is set, otherwise directly with a realistic User-Agent) and pull
 * structured data from the embedded JSON-LD `<script>` block plus a few
 * regex fallbacks for the editorial bio.
 *
 * Soft-fails to null when:
 *   - APIFY_API_TOKEN is unset (no way to find the profile URL),
 *   - Google returns no Healthgrades hit for the lead,
 *   - the profile fetch returns non-2xx, or
 *   - parsing finds no usable signal.
 *
 * Apify docs:
 *   https://apify.com/apify/google-search-scraper/api/run-sync-get-dataset-items
 */
// Real-browser UA — Healthgrades sits behind Cloudflare Lite which
// flags bot-shaped UAs (the previous "AshfordEnrichmentBot" string).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEALTHGRADES_HOST_RE = /^(?:www\.)?healthgrades\.com$/i;
const HEALTHGRADES_PATH_RE = /^\/(?:provider|physician)\/.+/i;

export interface HealthgradesProfile {
  /** Canonical Healthgrades profile URL. */
  profileUrl: string;
  /** Provider name as printed on the page. */
  name: string | null;
  /** Headshot CDN URL when present. */
  photoUrl: string | null;
  /** Long-form bio when present. */
  bio: string | null;
  /** Aggregated star rating (0-5). */
  rating: number | null;
  /** Number of patient reviews. */
  reviewCount: number | null;
  /** Specialties (e.g. "Psychiatry"). */
  specialties: string[];
  /** Medical schools / residencies / fellowships when listed. */
  education: string[];
  /** Board certifications and awards. */
  awards: string[];
  /** Years in practice when shown. */
  yearsExperience: number | null;
}

class HealthgradesSource implements EnrichmentSource {
  readonly key = "healthgrades";
  readonly label = "Healthgrades";

  isConfigured(): boolean {
    // Direct path doesn't need Apify; only the search-discovery
    // fallback does. Treat the source as configured whenever EITHER
    // path can run so leads with an HG URL in `currentWebsite` get
    // enriched on deploys without an Apify token.
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    try {
      // Fast path — direct profile URL on the lead record.
      const directUrl = directProfileUrl(lead);
      let profileUrl = directUrl;
      if (profileUrl) {
        logger.info(
          { leadId: lead.id, source: "healthgrades", via: "current_website" },
          "healthgrades: matched via current_website",
        );
      } else {
        // Fallback — Apify Google search discovery.
        if (!env.apifyApiToken) {
          logger.warn(
            { leadId: lead.id },
            "healthgrades: no APIFY_API_TOKEN and currentWebsite is not an HG URL — skipping",
          );
          return null;
        }
        profileUrl = await findProfileUrl(lead);
        if (!profileUrl) {
          logger.info(
            { leadId: lead.id },
            "healthgrades: no match via apify search",
          );
          return null;
        }
      }
      const html = await fetchProfileHtml(profileUrl);
      if (!html) return null;
      const profile = parseHealthgradesProfile(html, profileUrl);
      if (!profile || !hasUsefulSignal(profile)) return null;
      // Identity gate (#noise-3): same-name same-city Healthgrades
      // hits exist (e.g. two MDs both named "Sarah Johnson" in
      // greater Dallas). Verify the parsed profile name actually
      // contains the lead's last-name token before accepting.
      const verdict = verifyHealthgradesMatch(lead, profile.name);
      if (verdict.kind === "reject") {
        logger.warn(
          {
            leadId: lead.id,
            profileUrl,
            profileName: profile.name,
            reason: verdict.reason,
          },
          "healthgrades: rejecting match (identity mismatch)",
        );
        return rejectMatch(verdict.reason);
      }
      const summaryParts: string[] = [];
      summaryParts.push(`Healthgrades: ${profile.name ?? lead.name}`);
      if (profile.rating != null) {
        summaryParts.push(
          `${profile.rating}★${
            profile.reviewCount != null ? ` on ${profile.reviewCount} reviews` : ""
          }`,
        );
      }
      if (profile.specialties.length) {
        summaryParts.push(profile.specialties.slice(0, 2).join(", "));
      }
      if (profile.awards.length) {
        summaryParts.push(`${profile.awards.length} award(s)`);
      }
      return {
        confidence: profile.rating != null && profile.bio ? 75 : 55,
        summary: summaryParts.join(" · "),
        payload: profile as unknown as Record<string, unknown>,
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "healthgrades enrichment failed");
      return null;
    }
  }
}

export const healthgradesSource = new HealthgradesSource();

// ---------------------------------------------------------------------------
// Direct URL detection — if the rep saved an HG profile URL on the lead.
// ---------------------------------------------------------------------------

const directProfileUrl = (lead: LeadInput): string | null => {
  const raw = lead.currentWebsite?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!HEALTHGRADES_HOST_RE.test(parsed.hostname)) return null;
  if (!HEALTHGRADES_PATH_RE.test(parsed.pathname)) return null;
  // Strip query/fragment — utm tracking, return-from-search anchors.
  return `https://www.healthgrades.com${parsed.pathname.replace(/\/$/, "")}`;
};

// ---------------------------------------------------------------------------
// Discovery — find the canonical profile URL via Apify Google Search.
// ---------------------------------------------------------------------------

const findProfileUrl = async (lead: LeadInput): Promise<string | null> => {
  const query = `site:healthgrades.com/provider "${lead.name}" "${lead.city}"`;
  const url =
    "https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items" +
    `?token=${encodeURIComponent(env.apifyApiToken!)}&timeout=60`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: query,
        resultsPerPage: 5,
        maxPagesPerQuery: 1,
        countryCode: "us",
        languageCode: "en",
        mobileResults: false,
        saveHtml: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as Array<{
      organicResults?: Array<{ url?: string }>;
    }>;
    const organic = items?.[0]?.organicResults ?? [];
    for (const r of organic) {
      const u = r.url ?? "";
      if (/healthgrades\.com\/provider\//i.test(u)) return u;
    }
    return null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Profile fetch — ScraperAPI when configured, plain fetch otherwise.
// ---------------------------------------------------------------------------

const fetchProfileHtml = async (profileUrl: string): Promise<string | null> => {
  // Tier 1 — direct fetch with a real-browser UA. Cloudflare-Lite
  // protected; passes ~70% of the time at $0.
  try {
    const res = await fetch(profileUrl, {
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length >= 10_000) {
        logger.info(
          { url: profileUrl, tier: "direct", bytes: html.length },
          "healthgrades:fetchHtml ok",
        );
        return html;
      }
      logger.warn(
        { url: profileUrl, tier: "direct", bytes: html.length },
        "healthgrades:fetchHtml direct returned thin HTML — falling back",
      );
    } else {
      logger.warn(
        { url: profileUrl, tier: "direct", status: res.status },
        "healthgrades:fetchHtml direct non-OK — falling back",
      );
    }
  } catch (err) {
    logger.warn(
      {
        url: profileUrl,
        tier: "direct",
        err: err instanceof Error ? err.message : String(err),
      },
      "healthgrades:fetchHtml direct threw — falling back",
    );
  }

  // Tier 2 — ScraperAPI render=true (handles the Cloudflare challenge).
  if (env.scraperapiKey != null) {
    try {
      const target = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        env.scraperapiKey,
      )}&url=${encodeURIComponent(profileUrl)}&render=true&country_code=us`;
      const res = await fetch(target, {
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        logger.warn(
          { url: profileUrl, tier: "scraperapi", status: res.status },
          "healthgrades:fetchHtml scraperapi non-OK",
        );
        return null;
      }
      const html = await res.text();
      logger.info(
        { url: profileUrl, tier: "scraperapi", bytes: html.length },
        "healthgrades:fetchHtml ok",
      );
      return html;
    } catch (err) {
      logger.warn(
        {
          url: profileUrl,
          tier: "scraperapi",
          err: err instanceof Error ? err.message : String(err),
        },
        "healthgrades:fetchHtml scraperapi threw",
      );
      return null;
    }
  }
  logger.warn(
    { url: profileUrl },
    "healthgrades:fetchHtml exhausted — no SCRAPERAPI_KEY configured",
  );
  return null;
};

// ---------------------------------------------------------------------------
// Profile parsing — JSON-LD first, regex fallbacks.
// ---------------------------------------------------------------------------

const stripTags = (html: string): string =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`;

const dedupe = (xs: string[]): string[] =>
  Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));

export const parseHealthgradesProfile = (
  html: string,
  profileUrl: string,
): HealthgradesProfile | null => {
  const out: HealthgradesProfile = {
    profileUrl,
    name: null,
    photoUrl: null,
    bio: null,
    rating: null,
    reviewCount: null,
    specialties: [],
    education: [],
    awards: [],
    yearsExperience: null,
  };
  // JSON-LD blocks — Healthgrades emits Physician / Person / MedicalBusiness
  // entries with stable keys for name, image, aggregateRating, etc.
  const ldMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of ldMatches) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const blocks = Array.isArray(parsed) ? parsed : [parsed];
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const obj = block as Record<string, unknown>;
      const t = obj["@type"];
      const types = Array.isArray(t) ? t : [t];
      if (
        !types.some(
          (x) =>
            typeof x === "string" &&
            ["Physician", "Person", "MedicalBusiness"].includes(x),
        )
      ) {
        continue;
      }
      if (!out.name && typeof obj.name === "string") out.name = obj.name;
      if (!out.photoUrl) {
        const img = obj.image;
        if (typeof img === "string") out.photoUrl = img;
        else if (
          img &&
          typeof img === "object" &&
          typeof (img as { url?: unknown }).url === "string"
        ) {
          out.photoUrl = (img as { url: string }).url;
        }
      }
      if (!out.bio && typeof obj.description === "string") {
        out.bio = obj.description;
      }
      const agg = obj.aggregateRating;
      if (agg && typeof agg === "object") {
        const a = agg as Record<string, unknown>;
        if (out.rating == null) {
          const r =
            typeof a.ratingValue === "number"
              ? a.ratingValue
              : typeof a.ratingValue === "string"
                ? Number(a.ratingValue)
                : NaN;
          if (Number.isFinite(r)) out.rating = r;
        }
        if (out.reviewCount == null) {
          const c =
            typeof a.reviewCount === "number"
              ? a.reviewCount
              : typeof a.reviewCount === "string"
                ? Number(a.reviewCount)
                : NaN;
          if (Number.isFinite(c)) out.reviewCount = c;
        }
      }
      if (out.specialties.length === 0) {
        const sp = obj.medicalSpecialty;
        if (typeof sp === "string") out.specialties = [sp];
        else if (Array.isArray(sp)) {
          out.specialties = sp.filter(
            (x): x is string => typeof x === "string",
          );
        }
      }
      if (out.education.length === 0 && Array.isArray(obj.alumniOf)) {
        out.education = obj.alumniOf
          .map((x) =>
            typeof x === "string"
              ? x
              : x &&
                  typeof x === "object" &&
                  typeof (x as { name?: unknown }).name === "string"
                ? (x as { name: string }).name
                : null,
          )
          .filter((x): x is string => !!x);
      }
    }
  }
  // Fallbacks — bio paragraph in the "About" section, awards list, years
  // experience marker. These keep us useful when JSON-LD changes.
  if (!out.bio) {
    const aboutMatch = html.match(
      /<section[^>]*(?:about|biography)[^>]*>([\s\S]*?)<\/section>/i,
    );
    if (aboutMatch) {
      const text = decodeEntities(stripTags(aboutMatch[1]));
      if (text.length > 60) out.bio = truncate(text, 1200);
    }
  }
  if (out.awards.length === 0) {
    const awardsMatch = html.match(
      /<(?:section|div)[^>]*award[^>]*>([\s\S]*?)<\/(?:section|div)>/i,
    );
    if (awardsMatch) {
      const items = Array.from(
        awardsMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
      )
        .map((m) => decodeEntities(stripTags(m[1])))
        .filter((s) => s.length > 2 && s.length < 200);
      out.awards = dedupe(items).slice(0, 8);
    }
  }
  if (out.yearsExperience == null) {
    const yrs = html.match(/(\d{1,2})\+?\s+years\s+experience/i);
    if (yrs) {
      const n = Number(yrs[1]);
      if (Number.isFinite(n) && n > 0 && n < 80) out.yearsExperience = n;
    }
  }
  out.specialties = dedupe(out.specialties);
  out.education = dedupe(out.education);
  out.awards = dedupe(out.awards);
  return out;
};

const hasUsefulSignal = (p: HealthgradesProfile): boolean =>
  !!(
    p.name ||
    p.photoUrl ||
    p.bio ||
    p.rating != null ||
    p.specialties.length > 0 ||
    p.education.length > 0 ||
    p.awards.length > 0
  );

/**
 * Identity verification for a parsed Healthgrades profile. Accept
 * when the profile name contains the lead's last-name token; reject
 * otherwise. We deliberately do NOT gate on city — Healthgrades
 * profiles often list a primary practice address that's a different
 * city than the lead (a therapist in Plano with a Dallas hospital
 * affiliation), which is fine. Name overlap is the load-bearing
 * signal.
 *
 * Pure function — exported for unit tests.
 */
export function verifyHealthgradesMatch(
  lead: LeadInput,
  profileName: string | null,
):
  | { kind: "accept"; reason: string }
  | { kind: "reject"; reason: string } {
  if (!profileName) {
    return {
      kind: "reject",
      reason: "no profile name extracted",
    };
  }
  const last = lastNameToken(lead.name);
  if (!last) {
    return {
      kind: "reject",
      reason: `lead name has no usable last-name token (${lead.name})`,
    };
  }
  if (profileName.toLowerCase().includes(last)) {
    return {
      kind: "accept",
      reason: `last-name token "${last}" found in profile name`,
    };
  }
  return {
    kind: "reject",
    reason: `profile name "${profileName}" missing last-name token "${last}"`,
  };
}

const lastNameToken = (name: string): string => {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 2 && !/^(?:dr|mr|mrs|ms|miss|prof)$/.test(s));
  return parts[parts.length - 1] ?? "";
};
