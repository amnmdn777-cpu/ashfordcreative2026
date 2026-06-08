import { logger } from "../../lib/logger";
import type { EnrichmentSource, FetchResult, LeadInput } from "./types";
import { rejectMatch } from "./types";

/**
 * Clearbit Autocomplete — keyless public endpoint that returns up to 10
 * company suggestions (name, domain, logo) for a free-text query.
 *
 * We use it as a "what's the canonical web presence for this practice?"
 * lookup. If the lead has no `currentWebsite` on file, the top suggestion
 * (when it isn't a directory like Psychology Today / Yelp / Healthgrades)
 * gives us a candidate domain + a logo URL we can show in the rep briefing.
 *
 * No API key required, no rate-limit headers documented; we still cap to
 * 1 request per call and a 10s timeout to stay polite.
 *
 * Docs: https://dashboard.clearbit.com/docs#autocomplete-api
 */

const KNOWN_DIRECTORY_DOMAINS = new Set([
  "psychologytoday.com",
  "yelp.com",
  "healthgrades.com",
  "zocdoc.com",
  "headway.co",
  "alma.org",
  "betterhelp.com",
  "talkspace.com",
  "goodtherapy.org",
  "therapyden.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "google.com",
  "vagaro.com",
]);

class ClearbitAutocompleteSource implements EnrichmentSource {
  readonly key = "clearbit_autocomplete";
  readonly label = "Clearbit Autocomplete";

  isConfigured(): boolean {
    // Public endpoint, no key needed — always configured.
    return true;
  }

  async fetch(lead: LeadInput): Promise<FetchResult> {
    try {
      const query = (lead.practice || lead.name).trim();
      if (!query) return null;
      const url =
        "https://autocomplete.clearbit.com/v1/companies/suggest?query=" +
        encodeURIComponent(query);
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        logger.warn(
          { leadId: lead.id, status: res.status },
          "clearbit_autocomplete: non-2xx",
        );
        return null;
      }
      const items = (await res.json()) as Array<{
        name?: string;
        domain?: string;
        logo?: string;
      }>;
      if (!Array.isArray(items) || items.length === 0) return null;
      const ranked = items
        .filter((c) => c.domain && c.name)
        .map((c) => ({
          name: c.name!,
          domain: c.domain!,
          logo: c.logo ?? null,
          isDirectory: KNOWN_DIRECTORY_DOMAINS.has(
            (c.domain ?? "").toLowerCase(),
          ),
        }));
      const independent = ranked.find((c) => !c.isDirectory);
      const top = independent ?? ranked[0] ?? null;
      if (!top) return null;
      // Identity gate (#noise-2, Tara/CareerBuilder case): Clearbit
      // autocomplete is meant for COMPANY names, not people. Querying
      // it with a generic practice name like "Care" or "Counseling"
      // returns nearest match (CareerBuilder for Tara), which then
      // pollutes AI synthesis with an unrelated brand. Accept the
      // suggestion only when its domain corroborates the lead's
      // actual web presence — `lead.currentWebsite` host or a
      // segment of the practice/name slug.
      const verdict = verifyClearbitMatch(lead, top.domain, top.name);
      if (verdict.kind === "reject") {
        return rejectMatch(
          `clearbit suggestion ${top.domain} unrelated to lead — ${verdict.reason}`,
        );
      }
      return {
        confidence: independent ? 60 : 30,
        summary: top.isDirectory
          ? `Top Clearbit match is a directory (${top.domain}); no independent web presence found.`
          : `Likely web presence: ${top.name} (${top.domain})`,
        payload: {
          query,
          totalSuggestions: ranked.length,
          top,
          allSuggestions: ranked.slice(0, 5),
        },
      };
    } catch (err) {
      logger.warn(
        { err, leadId: lead.id },
        "clearbit_autocomplete: fetch failed",
      );
      return null;
    }
  }
}

export const clearbitAutocompleteSource = new ClearbitAutocompleteSource();

/**
 * Identity verification for a Clearbit autocomplete suggestion.
 * Accept when the suggestion domain plausibly belongs to the lead:
 *   - matches the lead's `currentWebsite` host (strong signal), OR
 *   - the suggestion name shares a substring with the practice name
 *     beyond a generic stopword (the practice "Care" alone shouldn't
 *     greenlight "CareerBuilder").
 *
 * Pure function — exported for unit tests.
 */
export function verifyClearbitMatch(
  lead: LeadInput,
  suggestionDomain: string,
  suggestionName: string,
):
  | { kind: "accept"; reason: string }
  | { kind: "reject"; reason: string } {
  const dom = suggestionDomain.toLowerCase();
  const name = suggestionName.toLowerCase();
  // 1. Domain match against currentWebsite.
  const leadHost = hostOf(lead.currentWebsite);
  if (leadHost) {
    if (leadHost === dom || dom.endsWith(`.${leadHost}`) || leadHost.endsWith(`.${dom}`)) {
      return { kind: "accept", reason: "domain matches currentWebsite" };
    }
  }
  // 2. Practice-name substring overlap, beyond generic words.
  const practice = (lead.practice ?? "").toLowerCase().trim();
  const GENERIC_WORDS = new Set([
    "care",
    "therapy",
    "counseling",
    "wellness",
    "health",
    "mental",
    "behavioral",
    "the",
    "and",
    "of",
    "for",
    "group",
    "associates",
    "clinic",
    "center",
    "practice",
  ]);
  const practiceTokens = practice
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !GENERIC_WORDS.has(t));
  for (const tok of practiceTokens) {
    if (dom.includes(tok) || name.includes(tok)) {
      return { kind: "accept", reason: `practice token "${tok}" appears in suggestion` };
    }
  }
  // 3. Last-name token of the lead — accept solo practice case.
  const last = lastNameToken(lead.name);
  if (last && (dom.includes(last) || name.includes(last))) {
    return { kind: "accept", reason: "last-name token matches" };
  }
  return {
    kind: "reject",
    reason: `no overlap (lead: practice="${lead.practice}" website="${lead.currentWebsite ?? ""}", suggestion: "${suggestionName}" @ ${suggestionDomain})`,
  };
}

const hostOf = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const lastNameToken = (name: string): string => {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 2 && !/^(?:dr|mr|mrs|ms|miss|prof)$/.test(s));
  return parts[parts.length - 1] ?? "";
};
