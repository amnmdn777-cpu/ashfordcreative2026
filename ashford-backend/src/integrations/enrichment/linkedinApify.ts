import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { EnrichmentSource, FetchResult, LeadInput } from "./types";
import { rejectMatch } from "./types";

/**
 * LinkedIn discovery via the Apify "google-search-scraper" actor.
 *
 * We don't have a profile URL on lead intake, so we run a focused Google
 * query (`site:linkedin.com/in <name> <city>`) and surface the first 3
 * matching profile URLs + snippet text. The rep briefing layer then has a
 * direct LinkedIn entry point per lead, and the prospect-portal personalisation
 * layer can pick credentials / tagline language straight from the snippet.
 *
 * Why google-search-scraper and not a direct LinkedIn profile scraper:
 * - Profile scrapers cost ~$5/1000 calls and require a known profile URL.
 * - Google search via Apify is ~$0.001/query and works from name+city alone.
 * - We never call LinkedIn directly — only Apify, which handles UA rotation.
 *
 * Soft-fails (returns null) when APIFY_API_TOKEN is missing or the actor
 * returns no items.
 *
 * Apify docs:
 *   https://apify.com/apify/google-search-scraper/api/run-sync-get-dataset-items
 */
class LinkedInApifySource implements EnrichmentSource {
  readonly key = "linkedin_apify";
  readonly label = "LinkedIn (via Apify Google Search)";

  isConfigured(): boolean {
    return !!env.apifyApiToken;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    if (!this.isConfigured()) return null;
    const query = `site:linkedin.com/in "${lead.name}" "${lead.city}"`;
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
      if (!res.ok) {
        logger.warn(
          { leadId: lead.id, status: res.status },
          "linkedin_apify: actor returned non-2xx",
        );
        return null;
      }
      const items = (await res.json()) as Array<{
        organicResults?: Array<{
          title?: string;
          url?: string;
          displayedUrl?: string;
          description?: string;
        }>;
      }>;
      const organic = items?.[0]?.organicResults ?? [];
      const allCandidates = organic
        .filter((r) => (r.url ?? "").includes("linkedin.com/in/"))
        .slice(0, 5)
        .map((r) => ({
          title: r.title ?? null,
          url: r.url ?? null,
          snippet: r.description ?? null,
        }));
      if (allCandidates.length === 0) return null;
      // Identity gate (#noise-1, Tara Langston / "Skincare Entrepreneur"
      // case): the first Google hit was a same-name LinkedIn profile of
      // a completely different industry. Without a gate it polluted AI
      // synthesis, which then fabricated a bilingual-trauma-EMDR bio
      // under Tara's name. Filter to profiles where the title or
      // snippet looks therapy/medical-adjacent for therapy leads.
      const verified = allCandidates.filter((c) =>
        verifyLinkedInMatch(lead, c.title ?? "", c.snippet ?? ""),
      );
      if (verified.length === 0) {
        const sample = allCandidates[0];
        return rejectMatch(
          `no LinkedIn result with therapy/medical signal — sample: "${sample.title}"`,
        );
      }
      const top = verified[0];
      return {
        confidence: 60,
        summary: top.title
          ? `LinkedIn: ${top.title}${top.url ? ` (${top.url})` : ""}`
          : `Found ${verified.length} LinkedIn profile candidate(s).`,
        payload: {
          query,
          totalFound: verified.length,
          profiles: verified,
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id }, "linkedin_apify: fetch failed");
      return null;
    }
  }
}

export const linkedinApifySource = new LinkedInApifySource();

/**
 * Identity verification for a LinkedIn search hit. The lead's
 * specialty is mental-health (Anxiety, Depression, Couples, etc.) —
 * a same-name LinkedIn profile that says "Skincare Entrepreneur" or
 * "Software Engineer" is a different person. We accept a profile
 * when:
 *
 *  - the lead's name tokens overlap the profile title, AND
 *  - the title or snippet contains a therapy/medical-adjacent
 *    keyword (license code, "therapy", "counseling", "psych*",
 *    "social work*", "mental health", etc.)
 *
 *  When the lead has a non-therapy specialty (rare), we relax the
 *  domain-keyword check and accept on name overlap alone.
 *
 * Pure function — exported for unit tests.
 */
export function verifyLinkedInMatch(
  lead: LeadInput,
  title: string,
  snippet: string,
): boolean {
  const haystack = `${title} ${snippet}`.toLowerCase();
  const last = lastNameToken(lead.name);
  if (last && !haystack.includes(last)) return false;
  // Off-domain keyword check applies only to mental-health-vertical
  // leads. Other specialties (dentist, MD, etc.) get name-only gating.
  const specialty = (lead.specialty ?? "").toLowerCase();
  const isMentalHealth =
    /(?:anxiety|depression|trauma|emdr|couples|teen|adolescent|family|substance|addiction|grief|psych|therapy|counsel|mental health|behavior)/i.test(
      specialty,
    );
  if (!isMentalHealth) {
    return true;
  }
  // Therapy/medical-adjacent keywords accepted in title or snippet.
  const DOMAIN_KEYWORDS =
    /(?:therap|counsel|psycholog|psychiatr|social work|mental health|behavior|wellness|clinical|\blcsw\b|\blpc\b|\blmft\b|\blmhc\b|\bphd\b|\bpsyd\b|\bmd\b|\bma\b,|\blcpc\b|\blpcc\b|\blcsw-c\b|\bnp\b)/i;
  return DOMAIN_KEYWORDS.test(haystack);
}

const lastNameToken = (name: string): string => {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 2 && !/^(?:dr|mr|mrs|ms|miss|prof)$/.test(s));
  return parts[parts.length - 1] ?? "";
};
