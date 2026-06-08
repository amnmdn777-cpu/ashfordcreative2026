import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import type { Candidate, EnrichmentSource, LeadInput } from "./types";

/**
 * SimilarWeb traffic snapshot for a lead's existing website.
 *
 * Surfaces three signals the rep cares about pre-call:
 *  - Visits/month (rough indicator of "is this a real practice or a parked
 *    domain?")
 *  - Top traffic source (organic vs direct vs referral) — informs whether
 *    they're already getting SEO juice or rely on word-of-mouth.
 *  - Bounce rate / pages-per-visit — proxy for how compelling the current
 *    page is, which is exactly what Ashford fixes.
 *
 * SimilarWeb's official API is paid; the free Digital Rank API
 * (`/v1/SimilarRank/{domain}/rank`) requires a key but has a generous
 * 50k req/month cap. We hit only the rank endpoint by default to stay
 * cheap, and skip the call entirely when no key is set.
 *
 * Soft-fails to null when SIMILARWEB_API_KEY is unset, the domain
 * resolves to nothing, or the upstream returns a non-2xx.
 *
 * Docs: https://docs.similarweb.com/reference/digitalsuite-api
 */
class SimilarWebSource implements EnrichmentSource {
  readonly key = "similarweb";
  readonly label = "SimilarWeb";

  isConfigured(): boolean {
    return !!env.similarwebApiKey;
  }

  private domainFor(lead: LeadInput): string | null {
    const raw = (lead.currentWebsite ?? "").trim();
    if (!raw) return null;
    try {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(withScheme);
      return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
    } catch {
      return null;
    }
  }

  async fetch(lead: LeadInput): Promise<Candidate | null> {
    if (!this.isConfigured()) return null;
    const domain = this.domainFor(lead);
    if (!domain) return null;
    try {
      const url =
        `https://api.similarweb.com/v1/similar-rank/${encodeURIComponent(domain)}/rank` +
        `?api_key=${encodeURIComponent(env.similarwebApiKey!)}`;
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        logger.warn(
          { leadId: lead.id, status: res.status, domain },
          "similarweb: non-2xx",
        );
        return null;
      }
      const json = (await res.json()) as {
        similar_rank?: {
          rank?: number;
          domain?: string;
        };
        meta?: { status?: string };
      };
      const rank = json?.similar_rank?.rank;
      if (typeof rank !== "number" || rank <= 0) return null;
      const tier =
        rank < 100_000
          ? "high traffic"
          : rank < 1_000_000
            ? "moderate traffic"
            : "low traffic";
      return {
        confidence: 50,
        summary: `SimilarWeb rank #${rank.toLocaleString("en-US")} for ${domain} (${tier}).`,
        payload: {
          domain,
          rank,
          tier,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      logger.warn({ err, leadId: lead.id, domain }, "similarweb: fetch failed");
      return null;
    }
  }
}

export const similarwebSource = new SimilarWebSource();
